package com.examiq.app.platform

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Log
import android.view.MotionEvent
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCase
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.findViewTreeLifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Live CameraX preview view supporting React Native Fabric / Bridgeless mode:
 * - Offline QR detection via bundled ML Kit Barcode Scanner (mode = "qr")
 * - Live 4-corner fiducial marker readiness check + high-res photo capture (mode = "paper")
 * - Tap-to-focus metering and physical LED torch control
 */
class ExamIQCameraView(context: Context) : FrameLayout(context) {

  companion object {
    private const val TAG = "ExamIQCamera"

    @Volatile
    var activeInstance: ExamIQCameraView? = null
  }

  private val previewView = PreviewView(context).apply {
    layoutParams = LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    // TextureView mode ensures reliable rendering & rounded clipping inside React Native Fabric views.
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }

  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val barcodeScannerLazy = lazy {
    val options = BarcodeScannerOptions.Builder()
      .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
      .build()
    BarcodeScanning.getClient(options)
  }
  private val barcodeScanner by barcodeScannerLazy

  private var cameraProvider: ProcessCameraProvider? = null
  private var camera: Camera? = null
  private var imageCapture: ImageCapture? = null
  private var boundUseCases: List<UseCase> = emptyList()

  private var scanMode: String = "qr"
  private var torchEnabled: Boolean = false
  private var cameraActive: Boolean = true
  private var isBound: Boolean = false
  private var isBinding: Boolean = false
  private var isDestroyed: Boolean = false
  private var lastQrEmitMs: Long = 0L
  private var lastQrValue: String = ""
  private var lastMarkerEmitMs: Long = 0L

  init {
    addView(previewView)
    previewView.setOnTouchListener { view, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> true
        MotionEvent.ACTION_UP -> {
          view.performClick()
          try {
            val point = previewView.meteringPointFactory.createPoint(event.x, event.y)
            val action = FocusMeteringAction.Builder(point).build()
            camera?.cameraControl?.startFocusAndMetering(action)
          } catch (_: Exception) {
          }
          true
        }
        else -> false
      }
    }
  }

  private fun reactContextOrNull(): ReactContext? = context as? ReactContext

  private fun resolveLifecycleOwner(): LifecycleOwner? {
    findViewTreeLifecycleOwner()?.let { return it }
    (reactContextOrNull()?.currentActivity as? LifecycleOwner)?.let { return it }
    var current: Context? = context
    while (current is ContextWrapper) {
      if (current is LifecycleOwner) return current
      current = current.baseContext
    }
    return null
  }

  private fun emitEvent(name: String, params: com.facebook.react.bridge.WritableMap) {
    val rc = reactContextOrNull() ?: return
    try {
      if (rc.hasActiveReactInstance() || rc.isBridgeless) {
        rc.emitDeviceEvent(name, params)
      }
    } catch (e: Exception) {
      Log.w(TAG, "Failed to emit $name: ${e.message}")
    }
  }

  fun setScanMode(mode: String) {
    scanMode = mode
  }

  fun setTorchEnabled(enabled: Boolean) {
    torchEnabled = enabled
    try {
      camera?.cameraControl?.enableTorch(enabled)
    } catch (_: Exception) {
    }
  }

  fun setCameraActive(active: Boolean) {
    cameraActive = active
    if (active && !isDestroyed) {
      activeInstance = this
      startCameraIfPermitted()
    } else {
      stopCamera()
      if (activeInstance === this) {
        activeInstance = null
      }
    }
  }

  fun destroy() {
    if (isDestroyed) return
    isDestroyed = true
    stopCamera()
    if (activeInstance === this) {
      activeInstance = null
    }
    try {
      analysisExecutor.shutdownNow()
    } catch (_: Exception) {
    }
    if (barcodeScannerLazy.isInitialized()) {
      try {
        barcodeScanner.close()
      } catch (_: Exception) {
      }
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (cameraActive) {
      activeInstance = this
      post { startCameraIfPermitted() }
    }
  }

  override fun onDetachedFromWindow() {
    stopCamera()
    if (activeInstance === this) {
      activeInstance = null
    }
    super.onDetachedFromWindow()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (w > 0 && h > 0) {
      previewView.measure(
        MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
      )
      previewView.layout(0, 0, w, h)
      if (cameraActive && !isBound && !isBinding) {
        post { startCameraIfPermitted() }
      }
    }
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  private val measureAndLayout = Runnable {
    if (width > 0 && height > 0) {
      measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
      )
      layout(left, top, right, bottom)
    }
  }

  fun startCameraIfPermitted() {
    if (isBound || isBinding || !cameraActive || !isAttachedToWindow) return

    val granted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED
    if (!granted) {
      Log.w(TAG, "CAMERA permission not granted yet")
      return
    }

    isBinding = true
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      try {
        if (!cameraActive || !isAttachedToWindow) {
          isBinding = false
          return@addListener
        }

        val provider = future.get()
        cameraProvider = provider
        val lifecycleOwner = resolveLifecycleOwner()
        if (lifecycleOwner == null) {
          Log.e(TAG, "No LifecycleOwner available to bind CameraX")
          isBinding = false
          return@addListener
        }

        val preview = Preview.Builder().build().also {
          it.surfaceProvider = previewView.surfaceProvider
        }

        val capture = ImageCapture.Builder()
          .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
          .build()
        imageCapture = capture

        val analysis = ImageAnalysis.Builder()
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .build()
          .also {
            it.setAnalyzer(analysisExecutor) { proxy ->
              analyzeFrame(proxy)
            }
          }

        provider.unbindAll()
        camera = provider.bindToLifecycle(
          lifecycleOwner,
          CameraSelector.DEFAULT_BACK_CAMERA,
          preview,
          capture,
          analysis
        )
        boundUseCases = listOf(preview, capture, analysis)
        activeInstance = this
        camera?.cameraControl?.enableTorch(torchEnabled)
        isBound = true
        isBinding = false
        post(measureAndLayout)
        Log.d(TAG, "CameraX bound cleanly in mode=$scanMode (${width}x${height})")
      } catch (e: Exception) {
        isBinding = false
        isBound = false
        Log.e(TAG, "CameraX bind failed: ${e.message}", e)
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun stopCamera() {
    try {
      camera?.cameraControl?.enableTorch(false)
      val provider = cameraProvider
      if (provider != null && boundUseCases.isNotEmpty()) {
        provider.unbind(*boundUseCases.toTypedArray())
      }
    } catch (e: Exception) {
      Log.w(TAG, "Error stopping CameraX: ${e.message}")
    }
    boundUseCases = emptyList()
    camera = null
    imageCapture = null
    isBound = false
    isBinding = false
  }

  @SuppressLint("UnsafeOptInUsageError")
  private fun analyzeFrame(imageProxy: ImageProxy) {
    if (scanMode == "qr") {
      val mediaImage = imageProxy.image
      if (mediaImage == null) {
        imageProxy.close()
        return
      }
      val inputImage = InputImage.fromMediaImage(
        mediaImage,
        imageProxy.imageInfo.rotationDegrees
      )
      barcodeScanner.process(inputImage)
        .addOnSuccessListener { barcodes ->
          val qr = barcodes.firstOrNull { !it.rawValue.isNullOrBlank() }
          if (qr?.rawValue != null) {
            val now = System.currentTimeMillis()
            val value = qr.rawValue!!
            if (value != lastQrValue || now - lastQrEmitMs > 1400L) {
              lastQrValue = value
              lastQrEmitMs = now
              val map = Arguments.createMap().apply {
                putString("rawValue", value)
              }
              emitEvent("ExamIQ_OnQrDetected", map)
            }
          }
        }
        .addOnCompleteListener {
          imageProxy.close()
        }
    } else {
      val now = System.currentTimeMillis()
      if (now - lastMarkerEmitMs > 320L) {
        lastMarkerEmitMs = now
        val cornerStatus = estimateCornerMarksFromYPlane(imageProxy)
        val cornersArray = Arguments.createArray()
        for (c in cornerStatus.corners) {
          val cMap = Arguments.createMap().apply {
            putString("slot", c.slot)
            putBoolean("found", c.found)
            putDouble("x", c.normX)
            putDouble("y", c.normY)
            putDouble("w", c.normW)
            putDouble("h", c.normH)
          }
          cornersArray.pushMap(cMap)
        }
        val map = Arguments.createMap().apply {
          putInt("detectedCount", cornerStatus.detectedCount)
          putBoolean("ready", cornerStatus.detectedCount >= 4)
          putArray("corners", cornersArray)
        }
        emitEvent("ExamIQ_OnMarkersStatus", map)
      }
      imageProxy.close()
    }
  }

  private data class LiveCornerBox(
    val slot: String,
    val found: Boolean,
    val normX: Double,
    val normY: Double,
    val normW: Double,
    val normH: Double
  )

  private data class LiveCornerStatus(
    val detectedCount: Int,
    val corners: List<LiveCornerBox>
  )

  /**
   * Stricter live corner-mark check: looks for a compact dark square patch surrounded by
   * a bright paper quiet-zone halo in each of the 4 corner quadrants, returning normalized
   * portrait display coordinates for live camera highlight boxes.
   */
  private fun estimateCornerMarksFromYPlane(proxy: ImageProxy): LiveCornerStatus {
    return try {
      val plane = proxy.planes[0]
      val buffer = plane.buffer
      val rowStride = plane.rowStride
      val w = proxy.width
      val h = proxy.height
      if (w < 120 || h < 120) return LiveCornerStatus(0, emptyList())

      val rotation = proxy.imageInfo.rotationDegrees
      val zones = arrayOf(
        Pair("TL", intArrayOf((w * 0.03).toInt(), (w * 0.30).toInt(), (h * 0.03).toInt(), (h * 0.28).toInt())),
        Pair("TR", intArrayOf((w * 0.70).toInt(), (w * 0.97).toInt(), (h * 0.03).toInt(), (h * 0.28).toInt())),
        Pair("BL", intArrayOf((w * 0.03).toInt(), (w * 0.30).toInt(), (h * 0.72).toInt(), (h * 0.97).toInt())),
        Pair("BR", intArrayOf((w * 0.70).toInt(), (w * 0.97).toInt(), (h * 0.72).toInt(), (h * 0.97).toInt()))
      )

      var count = 0
      val step = 4
      val outBoxes = mutableListOf<LiveCornerBox>()

      for ((rawSlot, z) in zones) {
        var darkPixels = 0
        var brightPixels = 0
        var minX = Int.MAX_VALUE
        var maxX = Int.MIN_VALUE
        var minY = Int.MAX_VALUE
        var maxY = Int.MIN_VALUE

        var y = z[2]
        while (y < z[3]) {
          var x = z[0]
          while (x < z[1]) {
            val idx = y * rowStride + x
            if (idx in 0 until buffer.limit()) {
              val luma = buffer.get(idx).toInt() and 0xFF
              if (luma < 72) {
                darkPixels++
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
              } else if (luma > 145) {
                brightPixels++
              }
            }
            x += step
          }
          y += step
        }

        var found = false
        var cxNorm = 0.0
        var cyNorm = 0.0
        var bwNorm = 0.0
        var bhNorm = 0.0

        if (darkPixels >= 6 && brightPixels >= 20 && maxX > minX && maxY > minY) {
          val bw = (maxX - minX + step).toFloat()
          val bh = (maxY - minY + step).toFloat()
          val ratio = bw / bh
          val expectedSamples = (bw / step) * (bh / step)
          val fillDensity = if (expectedSamples > 0f) darkPixels / expectedSamples else 0f
          if (ratio in 0.45f..2.2f && fillDensity >= 0.35f && bw < w * 0.16f && bh < h * 0.16f) {
            found = true
            count++
            val rawCx = ((minX + maxX) / 2.0) / w.toDouble()
            val rawCy = ((minY + maxY) / 2.0) / h.toDouble()
            val rawW = bw.toDouble() / w.toDouble()
            val rawH = bh.toDouble() / h.toDouble()

            when (rotation) {
              90 -> {
                cxNorm = 1.0 - rawCy
                cyNorm = rawCx
                bwNorm = rawH
                bhNorm = rawW
              }
              270 -> {
                cxNorm = rawCy
                cyNorm = 1.0 - rawCx
                bwNorm = rawH
                bhNorm = rawW
              }
              180 -> {
                cxNorm = 1.0 - rawCx
                cyNorm = 1.0 - rawCy
                bwNorm = rawW
                bhNorm = rawH
              }
              else -> {
                cxNorm = rawCx
                cyNorm = rawCy
                bwNorm = rawW
                bhNorm = rawH
              }
            }
          }
        }

        // Map slot name to portrait viewport quadrant so TL/TR/BL/BR match screen corners
        val displaySlot = if (found) {
          when {
            cxNorm < 0.5 && cyNorm < 0.5 -> "TL"
            cxNorm >= 0.5 && cyNorm < 0.5 -> "TR"
            cxNorm < 0.5 && cyNorm >= 0.5 -> "BL"
            else -> "BR"
          }
        } else {
          rawSlot
        }

        outBoxes.add(LiveCornerBox(displaySlot, found, cxNorm, cyNorm, bwNorm, bhNorm))
      }
      LiveCornerStatus(count, outBoxes)
    } catch (_: Exception) {
      LiveCornerStatus(0, emptyList())
    }
  }

  fun captureStillPhoto(onSuccess: (String) -> Unit, onError: (String) -> Unit) {
    val capture = imageCapture
    if (capture == null) {
      onError("Camera is not active yet.")
      return
    }
    val scansDir = File(context.filesDir, "scans").apply { mkdirs() }
    val outFile = File(scansDir, "raw_scan_${System.currentTimeMillis()}.jpg")
    val outputOptions = ImageCapture.OutputFileOptions.Builder(outFile).build()

    capture.takePicture(
      outputOptions,
      analysisExecutor,
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
          normalizeExifRotation(outFile)
          onSuccess("file://${outFile.absolutePath}")
        }

        override fun onError(exception: ImageCaptureException) {
          onError(exception.message ?: "Failed to capture paper photo.")
        }
      }
    )
  }

  private fun normalizeExifRotation(file: File) {
    var bmp: Bitmap? = null
    var rotated: Bitmap? = null
    try {
      val exif = ExifInterface(file.absolutePath)
      val orientation = exif.getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )
      val deg = when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
      if (deg == 0f) return
      bmp = BitmapFactory.decodeFile(file.absolutePath) ?: return
      val matrix = Matrix().apply { postRotate(deg) }
      rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
      val temp = File(file.parentFile, "${file.name}.tmp")
      FileOutputStream(temp).use { out ->
        rotated.compress(Bitmap.CompressFormat.JPEG, 92, out)
      }
      if (temp.exists() && temp.length() > 0) {
        temp.renameTo(file)
      } else {
        temp.delete()
      }
    } catch (_: Exception) {
    } finally {
      rotated?.recycle()
      bmp?.recycle()
    }
  }
}
