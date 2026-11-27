package com.examiq.app.platform

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import org.json.JSONArray
import java.io.File
import java.io.FileOutputStream
import java.util.ArrayDeque
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Paper-size-aware on-device Android OMR verification, alignment & bubble-checking engine:
 * 1. Verifies 4 genuine solid-square corner fiducial marks with bright white quiet-zone halos
 * 2. Warps onto exact A4 / Short / Long canonical sheet coordinates (OmrGeometry)
 * 3. Runs offline ML Kit QR verification directly on the captured sheet to prove legitimacy
 *    (rejects non-ExamIQ sheets, detects upside-down pages, and surfaces embedded QR payload)
 * 4. Measures adaptive dark-pixel area coverage + quadrant solidity + row-relative baseline delta
 *    so unshaded printed letters (A/B/C/D) are ignored while genuine pen/pencil shading is scored
 */
class ExamIQOmrModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val TAG = "ExamIQOmr"
  }

  private val qrScanner by lazy {
    val options = BarcodeScannerOptions.Builder()
      .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
      .build()
    BarcodeScanning.getClient(options)
  }

  override fun getName(): String = "ExamIQOmr"

  @ReactMethod
  fun capturePaperPhoto(promise: Promise) {
    val cam = ExamIQCameraView.activeInstance
    if (cam == null) {
      promise.reject("CAMERA_INACTIVE", "Live camera view is not mounted.")
      return
    }
    cam.captureStillPhoto(
      onSuccess = { uri ->
        val map = Arguments.createMap().apply {
          putString("rawImageUri", uri)
        }
        promise.resolve(map)
      },
      onError = { msg ->
        promise.reject("CAPTURE_FAILED", msg)
      }
    )
  }

  @ReactMethod
  fun alignAndAnalyzeSheet(
    rawImageUri: String,
    paperSizeCode: String,
    itemCount: Int,
    sensitivity: String,
    flagDoubleShade: Boolean,
    answerKeyJson: String,
    promise: Promise
  ) {
    try {
      val spec = PaperSpec.fromCode(paperSizeCode)
      val path = rawImageUri.removePrefix("file://")
      val rawFile = File(path)
      if (!rawFile.exists()) {
        promise.reject("IMAGE_NOT_FOUND", "Captured image not found at $path")
        return
      }

      val opts = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
      val rawBitmap = BitmapFactory.decodeFile(rawFile.absolutePath, opts)
        ?: run {
          promise.reject("DECODE_ERROR", "Unable to decode captured sheet image.")
          return
        }

      val w = rawBitmap.width
      val h = rawBitmap.height

      // Step 1: Detect 4 solid black square fiducial marks with bright white quiet-zone halos
      val tl = findSolidCornerSquare(rawBitmap, 0, (w * 0.34).toInt(), 0, (h * 0.28).toInt(), w)
      val tr = findSolidCornerSquare(rawBitmap, (w * 0.66).toInt(), w, 0, (h * 0.28).toInt(), w)
      val bl = findSolidCornerSquare(rawBitmap, 0, (w * 0.34).toInt(), (h * 0.72).toInt(), h, w)
      val br = findSolidCornerSquare(rawBitmap, (w * 0.66).toInt(), w, (h * 0.72).toInt(), h, w)

      val markersDetected = listOf(tl, tr, bl, br).count { it.found }

      val pTL = if (tl.found) Pair(tl.x, tl.y) else Pair(w * 0.08f, h * 0.06f)
      val pTR = if (tr.found) Pair(tr.x, tr.y) else Pair(w * 0.92f, h * 0.06f)
      val pBL = if (bl.found) Pair(bl.x, bl.y) else Pair(w * 0.08f, h * 0.94f)
      val pBR = if (br.found) Pair(br.x, br.y) else Pair(w * 0.92f, h * 0.94f)

      val rotationDeg = (atan2(
        (pTR.second - pTL.second).toDouble(),
        (pTR.first - pTL.first).toDouble()
      ) * 180.0 / Math.PI)
      val roundedRotation = (rotationDeg * 10.0).roundToInt() / 10.0

      val scaleX = spec.warpWidthPx / spec.widthPt
      val scaleY = spec.warpHeightPx / spec.heightPt

      val srcPts = floatArrayOf(
        pTL.first, pTL.second,
        pTR.first, pTR.second,
        pBL.first, pBL.second,
        pBR.first, pBR.second
      )
      val cTL = OmrGeometry.tlCenterPt()
      val cTR = OmrGeometry.trCenterPt(spec)
      val cBL = OmrGeometry.blCenterPt(spec)
      val cBR = OmrGeometry.brCenterPt(spec)

      val dstPts = floatArrayOf(
        cTL.first * scaleX, cTL.second * scaleY,
        cTR.first * scaleX, cTR.second * scaleY,
        cBL.first * scaleX, cBL.second * scaleY,
        cBR.first * scaleX, cBR.second * scaleY
      )

      val warpMatrix = Matrix()
      warpMatrix.setPolyToPoly(srcPts, 0, dstPts, 0, 4)

      val alignedBitmap = Bitmap.createBitmap(
        spec.warpWidthPx,
        spec.warpHeightPx,
        Bitmap.Config.ARGB_8888
      )
      val canvas = Canvas(alignedBitmap)
      canvas.drawColor(Color.WHITE)
      canvas.drawBitmap(rawBitmap, warpMatrix, Paint(Paint.FILTER_BITMAP_FLAG))

      // Step 2: Lighting & Sharpness Diagnostics (gates tighten with OMR sensitivity)
      val dimLumaCutoff: Double
      val minSharpness: Double
      when (sensitivity.lowercase()) {
        "strict" -> {
          dimLumaCutoff = 105.0
          minSharpness = 0.28
        }
        "lenient" -> {
          dimLumaCutoff = 70.0
          minSharpness = 0.14
        }
        else -> {
          dimLumaCutoff = 85.0
          minSharpness = 0.20
        }
      }
      val (lightingStatus, sharpnessScore) = assessLightingAndSharpness(alignedBitmap, dimLumaCutoff)

      // Step 3: On-Sheet Offline ML Kit QR Legitimacy Verification
      val qrCheck = verifyExamIqQrOnSheet(alignedBitmap, rawBitmap, spec, scaleX, scaleY)

      // Step 4: Shaded Bubble Detection (adaptive dark-pixel coverage + quadrant fill + outside-rim bleed)
      val answerKey = JSONArray(answerKeyJson)
      val clampedItems = itemCount.coerceIn(1, 60)
      val absThreshold: Double
      val deltaThreshold: Double
      val bleedThreshold: Double
      val partialMinCoverage: Double
      when (sensitivity.lowercase()) {
        "strict" -> {
          absThreshold = 0.46
          deltaThreshold = 0.24
          bleedThreshold = 0.20
          partialMinCoverage = 0.16
        }
        "lenient" -> {
          absThreshold = 0.28
          deltaThreshold = 0.14
          bleedThreshold = 0.34
          partialMinCoverage = 0.15
        }
        else -> {
          absThreshold = 0.36
          deltaThreshold = 0.18
          bleedThreshold = 0.26
          partialMinCoverage = 0.18
        }
      }

      val ringCorrect = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#8BC419")
        style = Paint.Style.STROKE
        strokeWidth = 4.5f
      }
      val ringWrong = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#F67D56")
        style = Paint.Style.STROKE
        strokeWidth = 4.5f
      }
      val ringConflict = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#958BFF")
        style = Paint.Style.STROKE
        strokeWidth = 4.5f
      }

      val annotatedBitmap = alignedBitmap.copy(Bitmap.Config.ARGB_8888, true)
      val overlayCanvas = Canvas(annotatedBitmap)

      val choices = arrayOf("A", "B", "C", "D")
      val itemsArray = Arguments.createArray()
      var earnedCorrect = 0
      var flaggedCount = 0
      var halfShadedCount = 0
      var overShadedCount = 0

      val outerRimRadiusPx = (OmrGeometry.BUBBLE_RADIUS_PT * scaleX).toInt().coerceAtLeast(8)
      val innerRadiusPx = (outerRimRadiusPx * 0.72f).toInt().coerceAtLeast(5)
      val rowStepPx = (OmrGeometry.rowStepPt(spec, clampedItems) * scaleY).toInt()
      val maxVerticalBleedPx = ((rowStepPx / 2) - 2).coerceAtLeast(outerRimRadiusPx + 3)
      val ringR = OmrGeometry.BUBBLE_RADIUS_PT * scaleX * 1.15f
      val rowsPerCol = OmrGeometry.rowsPerColumn(clampedItems)

      for (itemNum in 1..clampedItems) {
        val expectedKey = if (itemNum - 1 < answerKey.length()) {
          answerKey.optString(itemNum - 1, "A")
        } else {
          "A"
        }

        // Sample clean local paper white brightness from 3 gaps near this row (75th percentile)
        val (lx, ly) = OmrGeometry.itemRowBaselinePt(spec, itemNum, clampedItems)
        val paperLuma = sampleLocalPaperWhite(
          alignedBitmap,
          lx,
          ly,
          scaleX,
          scaleY
        )
        val darkCutoff = (paperLuma * 0.64).coerceIn(52.0, 165.0)

        // Snap row Y coordinate to the printed row timing tick (handles folded/creased sheets!)
        val zeroIdx = itemNum - 1
        val isRightCol = zeroIdx >= rowsPerCol
        val rowIdx = if (isRightCol) zeroIdx - rowsPerCol else zeroIdx
        val (tickXPt, tickYPt) = OmrGeometry.timingTickCenterPt(spec, rowIdx, isRightCol, clampedItems)
        val rowDeltaYPx = refineRowYFromTimingTick(
          alignedBitmap,
          (tickXPt * scaleX).toInt(),
          (tickYPt * scaleY).toInt(),
          darkCutoff
        )

        // Measure all 4 bubbles first so we can compute row-relative unshaded baseline
        val metrics = Array(4) { cIdx ->
          val (cxPt, cyPt) = OmrGeometry.bubbleCenterPt(spec, itemNum, cIdx, clampedItems)
          measureBubbleShading(
            alignedBitmap,
            (cxPt * scaleX).toInt(),
            (cyPt * scaleY).toInt() + rowDeltaYPx,
            innerRadiusPx,
            outerRimRadiusPx,
            maxVerticalBleedPx,
            darkCutoff
          )
        }

        // Row empty baseline = average of the 2 lightest (unshaded) bubbles in this row
        val sortedCoverages = metrics.map { it.darkCoverage }.sorted()
        val rowEmptyBaseline = (sortedCoverages[0] + sortedCoverages[1]) / 2.0

        val shadedIndices = mutableListOf<Int>()
        val halfShadedIndices = mutableListOf<Int>()
        val overShadedIndices = mutableListOf<Int>()
        val ratiosMap = Arguments.createMap()
        val bleedMap = Arguments.createMap()

        for (cIdx in 0..3) {
          val m = metrics[cIdx]
          val relDelta = (m.darkCoverage - rowEmptyBaseline).coerceAtLeast(0.0)
          ratiosMap.putDouble(choices[cIdx], (m.darkCoverage * 100.0).roundToInt() / 100.0)
          bleedMap.putDouble(choices[cIdx], (m.outsideBleed * 100.0).roundToInt() / 100.0)

          // Genuine full shading requires dark-pixel coverage, contrast over row empty baseline,
          // and solid fill across at least 3 of 4 bubble quadrants (rejects thin letters / half marks).
          val isFullyShaded =
            m.darkCoverage >= absThreshold &&
            relDelta >= deltaThreshold &&
            m.quadrantsFilled >= 3

          // Over-shaded ("lagpas-lagpas"): heavy ink bleeding outside the bubble circle border
          val isOverShaded =
            m.outsideBleed >= bleedThreshold &&
            (isFullyShaded || m.darkCoverage >= partialMinCoverage)

          // Half-shaded / incomplete mark (only 1-2 quadrants filled, checkmark, dot, or light fill)
          val isHalfShaded =
            !isFullyShaded &&
            !isOverShaded &&
            ((m.darkCoverage >= partialMinCoverage && relDelta >= 0.09) ||
              (m.darkCoverage >= absThreshold * 0.72 && m.quadrantsFilled in 1..2))

          if (isOverShaded) {
            overShadedIndices.add(cIdx)
          }
          if (isFullyShaded) {
            shadedIndices.add(cIdx)
          } else if (isHalfShaded) {
            halfShadedIndices.add(cIdx)
          }
        }

        val itemMap = Arguments.createMap().apply {
          putInt("num", itemNum)
          putString("key", expectedKey)
          putMap("fillRatios", ratiosMap)
          putMap("bleedRatios", bleedMap)
        }

        when {
          overShadedIndices.isNotEmpty() -> {
            flaggedCount++
            overShadedCount++
            val messyIdx = overShadedIndices.maxByOrNull { metrics[it].outsideBleed } ?: overShadedIndices.first()
            val messyChoice = choices[messyIdx]
            itemMap.putString("detected", "$messyChoice (Messy)")
            itemMap.putString("type", "flagged")
            itemMap.putString("flagReason", "over_shaded")
            itemMap.putString("label", "$messyChoice · Messy")
            for (idx in overShadedIndices) {
              val (bx, by) = OmrGeometry.bubbleCenterPt(spec, itemNum, idx, clampedItems)
              overlayCanvas.drawCircle(bx * scaleX, by * scaleY + rowDeltaYPx, ringR, ringConflict)
            }
          }
          shadedIndices.size > 1 && flagDoubleShade -> {
            flaggedCount++
            val joined = shadedIndices.joinToString(" + ") { choices[it] }
            itemMap.putString("detected", joined)
            itemMap.putString("type", "flagged")
            itemMap.putString("flagReason", "double_shaded")
            itemMap.putString("label", joined)
            for (idx in shadedIndices) {
              val (bx, by) = OmrGeometry.bubbleCenterPt(spec, itemNum, idx, clampedItems)
              overlayCanvas.drawCircle(bx * scaleX, by * scaleY + rowDeltaYPx, ringR, ringConflict)
            }
          }
          shadedIndices.isEmpty() && halfShadedIndices.isNotEmpty() -> {
            flaggedCount++
            halfShadedCount++
            val halfIdx = halfShadedIndices.maxByOrNull { metrics[it].darkCoverage } ?: halfShadedIndices.first()
            val halfChoice = choices[halfIdx]
            itemMap.putString("detected", "$halfChoice (Half)")
            itemMap.putString("type", "flagged")
            itemMap.putString("flagReason", "half_shaded")
            itemMap.putString("label", "$halfChoice · Half")
            val (bx, by) = OmrGeometry.bubbleCenterPt(spec, itemNum, halfIdx, clampedItems)
            overlayCanvas.drawCircle(bx * scaleX, by * scaleY + rowDeltaYPx, ringR, ringConflict)
          }
          shadedIndices.isEmpty() -> {
            flaggedCount++
            itemMap.putString("detected", "Blank")
            itemMap.putString("type", "blank")
            itemMap.putString("flagReason", "blank")
            itemMap.putString("label", "Blank")
            val keyIdx = choices.indexOf(expectedKey).coerceAtLeast(0)
            val (kx, ky) = OmrGeometry.bubbleCenterPt(spec, itemNum, keyIdx, clampedItems)
            overlayCanvas.drawCircle(kx * scaleX, ky * scaleY + rowDeltaYPx, ringR, ringConflict)
          }
          else -> {
            // If flagDoubleShade is off and multiple passed, pick highest darkCoverage
            val chosenIdx = shadedIndices.maxByOrNull { metrics[it].darkCoverage } ?: shadedIndices.first()
            val chosen = choices[chosenIdx]
            itemMap.putString("detected", chosen)
            val (bx, by) = OmrGeometry.bubbleCenterPt(spec, itemNum, chosenIdx, clampedItems)
            if (chosen == expectedKey) {
              earnedCorrect++
              itemMap.putString("type", "correct")
              itemMap.putString("label", chosen)
              overlayCanvas.drawCircle(bx * scaleX, by * scaleY + rowDeltaYPx, ringR, ringCorrect)
            } else {
              itemMap.putString("type", "wrong")
              itemMap.putString("label", "$chosen → $expectedKey")
              overlayCanvas.drawCircle(bx * scaleX, by * scaleY + rowDeltaYPx, ringR, ringWrong)
              val keyIdx = choices.indexOf(expectedKey).coerceAtLeast(0)
              val (kx, ky) = OmrGeometry.bubbleCenterPt(spec, itemNum, keyIdx, clampedItems)
              overlayCanvas.drawCircle(kx * scaleX, ky * scaleY + rowDeltaYPx, ringR, ringCorrect)
            }
          }
        }
        itemsArray.pushMap(itemMap)
      }

      val scansDir = File(reactContext.filesDir, "scans").apply { mkdirs() }
      val alignedFile = File(scansDir, "aligned_scan_${System.currentTimeMillis()}.jpg")
      FileOutputStream(alignedFile).use { out ->
        annotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
      }

      rawBitmap.recycle()
      alignedBitmap.recycle()
      annotatedBitmap.recycle()

      val spanW = abs(pTR.first - pTL.first)
      val spanH = abs(pBL.second - pTL.second)
      val (errorCode, errorMessage) = when {
        qrCheck.isUpsideDown -> Pair(
          "UPSIDE_DOWN",
          "Printed sheet appears upside down. Rotate the paper 180° so the QR code is at the top-right."
        )
        !qrCheck.hasExamIqQr && markersDetected < 4 -> Pair(
          "NOT_EXAMIQ_SHEET",
          "Not a recognized ExamIQ printed sheet ($markersDetected/4 corner squares, no ExamIQ QR found). Scan an official ExamIQ answer sheet."
        )
        markersDetected < 4 -> Pair(
          "NO_MARKERS",
          "Only $markersDetected/4 printed corner squares locked. Fit all 4 solid black corner marks inside the green targets."
        )
        !qrCheck.hasExamIqQr -> Pair(
          "NOT_EXAMIQ_SHEET",
          "Could not verify the printed ExamIQ QR code on this page. Ensure the top-right QR is sharp, flat, and uncovered."
        )
        spanW < w * 0.34f || spanH < h * 0.34f || abs(roundedRotation) > 22.0 -> Pair(
          "POOR_ALIGNMENT",
          "Sheet is too tilted or far away (${roundedRotation}°). Hold phone flat above the ${spec.code} (${clampedItems}-item) sheet."
        )
        lightingStatus == "Dim" -> Pair(
          "LOW_LIGHT",
          "Lighting is too dark for reliable OMR reading. Enable Flash and retry."
        )
        sharpnessScore < minSharpness -> Pair(
          "BLURRY",
          "Captured photo is blurry. Tap the screen to focus and hold steady."
        )
        else -> Pair("OK", "")
      }

      Log.d(
        TAG,
        "OMR result: valid=${errorCode == "OK"}, code=$errorCode, marks=$markersDetected/4, qr=${qrCheck.hasExamIqQr}, score=$earnedCorrect/$clampedItems"
      )

      val result = Arguments.createMap().apply {
        putBoolean("sheetValid", errorCode == "OK")
        putString("errorCode", errorCode)
        putString("errorMessage", errorMessage)
        putBoolean("qrVerifiedOnSheet", qrCheck.hasExamIqQr)
        if (qrCheck.payload != null) {
          putString("detectedQrPayload", qrCheck.payload)
        }
        putInt("markersDetected", markersDetected)
        putDouble("rotationAngleDeg", roundedRotation)
        putString("lightingStatus", lightingStatus)
        putDouble("sharpnessScore", sharpnessScore)
        putString("rawImageUri", "file://${rawFile.absolutePath}")
        putString("alignedImageUri", "file://${alignedFile.absolutePath}")
        putInt("score", earnedCorrect)
        putInt("total", clampedItems)
        putInt("flaggedCount", flaggedCount)
        putInt("halfShadedCount", halfShadedCount)
        putInt("overShadedCount", overShadedCount)
        putArray("items", itemsArray)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("OMR_ANALYZE_ERROR", e.message, e)
    }
  }

  private data class SheetQrCheck(
    val hasExamIqQr: Boolean,
    val payload: String?,
    val isUpsideDown: Boolean
  )

  private fun verifyExamIqQrOnSheet(
    alignedBitmap: Bitmap,
    rawBitmap: Bitmap,
    spec: PaperSpec,
    scaleX: Float,
    scaleY: Float
  ): SheetQrCheck {
    // 1. Check canonical right-side QR header box on the aligned sheet first (fast + de-skewed)
    val cropLeft = ((spec.widthPt - OmrGeometry.QR_CARD_RIGHT_INSET_PT - OmrGeometry.QR_CARD_SIZE_PT - 28f) * scaleX)
      .toInt().coerceIn(0, alignedBitmap.width - 1)
    val cropTop = ((OmrGeometry.HEADER_TOP_PT - 24f) * scaleY)
      .toInt().coerceIn(0, alignedBitmap.height - 1)
    val cropRight = ((spec.widthPt - OmrGeometry.QR_CARD_RIGHT_INSET_PT + 28f) * scaleX)
      .toInt().coerceIn(cropLeft + 1, alignedBitmap.width)
    val cropBottom = ((OmrGeometry.HEADER_TOP_PT + OmrGeometry.QR_CARD_SIZE_PT + 28f) * scaleY)
      .toInt().coerceIn(cropTop + 1, alignedBitmap.height)

    try {
      val headerCrop = Bitmap.createBitmap(
        alignedBitmap,
        cropLeft,
        cropTop,
        cropRight - cropLeft,
        cropBottom - cropTop
      )
      val barcodes = Tasks.await(
        qrScanner.process(InputImage.fromBitmap(headerCrop, 0)),
        1500L,
        TimeUnit.MILLISECONDS
      )
      headerCrop.recycle()
      val hit = barcodes.firstOrNull { it.rawValue?.startsWith("EXAMIQ|") == true }
      if (hit?.rawValue != null) {
        return SheetQrCheck(hasExamIqQr = true, payload = hit.rawValue, isUpsideDown = false)
      }
    } catch (_: Exception) {
    }

    // 2. Fallback: scan full raw image to detect ExamIQ QR even if sheet was cropped or upside down
    return try {
      val barcodes = Tasks.await(
        qrScanner.process(InputImage.fromBitmap(rawBitmap, 0)),
        1800L,
        TimeUnit.MILLISECONDS
      )
      val hit = barcodes.firstOrNull { it.rawValue?.startsWith("EXAMIQ|") == true }
      if (hit?.rawValue != null) {
        val box = hit.boundingBox
        val upsideDown = box != null &&
          box.centerY() > rawBitmap.height * 0.60 &&
          box.centerX() < rawBitmap.width * 0.45
        SheetQrCheck(hasExamIqQr = true, payload = hit.rawValue, isUpsideDown = upsideDown)
      } else {
        SheetQrCheck(hasExamIqQr = false, payload = null, isUpsideDown = false)
      }
    } catch (_: Exception) {
      SheetQrCheck(hasExamIqQr = false, payload = null, isUpsideDown = false)
    }
  }

  private data class CornerHit(val found: Boolean, val x: Float, val y: Float)

  /**
   * Connected-component solid-square fiducial detector with white quiet-zone halo verification.
   * Rejects text strokes, thin borders, and dark shadows that fool simple dark-pixel counters.
   */
  private fun findSolidCornerSquare(
    bmp: Bitmap,
    xStart: Int,
    xEnd: Int,
    yStart: Int,
    yEnd: Int,
    fullWidth: Int
  ): CornerHit {
    val step = max(2, fullWidth / 320)
    val minX = xStart.coerceAtLeast(0)
    val maxX = xEnd.coerceAtMost(bmp.width - 1)
    val minY = yStart.coerceAtLeast(0)
    val maxY = yEnd.coerceAtMost(bmp.height - 1)
    val gw = ((maxX - minX) / step).coerceAtLeast(1)
    val gh = ((maxY - minY) / step).coerceAtLeast(1)

    // Estimate local bright paper luma in this quadrant (80th percentile)
    val lumaGrid = IntArray(gw * gh)
    val histogram = IntArray(256)
    var totalSamples = 0
    for (gy in 0 until gh) {
      val py = minY + gy * step
      for (gx in 0 until gw) {
        val px = minX + gx * step
        val p = bmp.getPixel(px, py)
        val luma = (Color.red(p) * 30 + Color.green(p) * 59 + Color.blue(p) * 11) / 100
        lumaGrid[gy * gw + gx] = luma
        histogram[luma.coerceIn(0, 255)]++
        totalSamples++
      }
    }

    var acc = 0
    var p80Luma = 200
    val target80 = (totalSamples * 0.80).toInt()
    for (v in 0..255) {
      acc += histogram[v]
      if (acc >= target80) {
        p80Luma = v
        break
      }
    }
    if (p80Luma < 105) {
      return CornerHit(false, 0f, 0f)
    }

    val darkThreshold = (p80Luma * 0.50).toInt().coerceIn(45, 115)
    val visited = BooleanArray(gw * gh)
    val queue = ArrayDeque<Int>()

    val minSidePx = (fullWidth * 0.015f).coerceAtLeast(8f)
    val maxSidePx = (fullWidth * 0.115f).coerceAtLeast(36f)

    var bestScore = -1.0
    var bestX = 0f
    var bestY = 0f

    for (gy in 0 until gh) {
      for (gx in 0 until gw) {
        val idx = gy * gw + gx
        if (visited[idx] || lumaGrid[idx] > darkThreshold) continue

        visited[idx] = true
        queue.clear()
        queue.add(idx)

        var count = 0
        var sumX = 0.0
        var sumY = 0.0
        var sumCoreLuma = 0.0
        var bMinX = gx
        var bMaxX = gx
        var bMinY = gy
        var bMaxY = gy

        while (queue.isNotEmpty()) {
          val cur = queue.removeFirst()
          val cx = cur % gw
          val cy = cur / gw
          count++
          sumX += minX + cx * step
          sumY += minY + cy * step
          sumCoreLuma += lumaGrid[cur]
          if (cx < bMinX) bMinX = cx
          if (cx > bMaxX) bMaxX = cx
          if (cy < bMinY) bMinY = cy
          if (cy > bMaxY) bMaxY = cy

          val neighbors = intArrayOf(cur - 1, cur + 1, cur - gw, cur + gw)
          for (n in neighbors) {
            if (n < 0 || n >= gw * gh || visited[n]) continue
            val nx = n % gw
            val ny = n / gw
            if (abs(nx - cx) + abs(ny - cy) != 1) continue
            if (lumaGrid[n] <= darkThreshold) {
              visited[n] = true
              queue.add(n)
            }
          }
        }

        if (count < 4) continue
        val bwCells = bMaxX - bMinX + 1
        val bhCells = bMaxY - bMinY + 1
        val bwPx = bwCells * step.toFloat()
        val bhPx = bhCells * step.toFloat()

        if (bwPx < minSidePx || bhPx < minSidePx || bwPx > maxSidePx || bhPx > maxSidePx) continue
        val aspect = bwPx / bhPx
        if (aspect < 0.58f || aspect > 1.72f) continue

        val fillRatio = count.toDouble() / (bwCells * bhCells).toDouble()
        if (fillRatio < 0.56) continue

        // Verify bright white paper quiet-zone halo immediately surrounding the square
        val pad = max(2, (max(bwCells, bhCells) * 0.45f).toInt())
        val hMinX = (bMinX - pad).coerceAtLeast(0)
        val hMaxX = (bMaxX + pad).coerceAtMost(gw - 1)
        val hMinY = (bMinY - pad).coerceAtLeast(0)
        val hMaxY = (bMaxY + pad).coerceAtMost(gh - 1)

        var haloSum = 0.0
        var haloCount = 0
        for (hy in hMinY..hMaxY) {
          for (hx in hMinX..hMaxX) {
            val insideBlobBox = hx in (bMinX - 1)..(bMaxX + 1) && hy in (bMinY - 1)..(bMaxY + 1)
            if (!insideBlobBox) {
              haloSum += lumaGrid[hy * gw + hx]
              haloCount++
            }
          }
        }
        if (haloCount < 6) continue

        val coreLuma = sumCoreLuma / count
        val haloLuma = haloSum / haloCount
        val contrast = haloLuma - coreLuma
        if (haloLuma < 118.0 || contrast < 50.0) continue

        val squareness = 1.0 - abs(1.0 - aspect.toDouble())
        val score = fillRatio * squareness * contrast
        if (score > bestScore) {
          bestScore = score
          bestX = (sumX / count).toFloat()
          bestY = (sumY / count).toFloat()
        }
      }
    }

    return if (bestScore > 0.0) {
      CornerHit(true, bestX, bestY)
    } else {
      CornerHit(false, 0f, 0f)
    }
  }

  private fun sampleLocalPaperWhite(
    bmp: Bitmap,
    lxPt: Float,
    lyPt: Float,
    scaleX: Float,
    scaleY: Float
  ): Double {
    val samples = mutableListOf<Double>()
    val offsetsPt = floatArrayOf(18f, 26f, 160f)
    for (ox in offsetsPt) {
      val cx = ((lxPt + ox) * scaleX).toInt().coerceIn(6, bmp.width - 7)
      val cy = (lyPt * scaleY).toInt().coerceIn(6, bmp.height - 7)
      for (dy in -4..4 step 4) {
        for (dx in -4..4 step 4) {
          val p = bmp.getPixel(cx + dx, cy + dy)
          samples.add((Color.red(p) * 30 + Color.green(p) * 59 + Color.blue(p) * 11) / 100.0)
        }
      }
    }
    if (samples.isEmpty()) return 230.0
    samples.sort()
    return samples[(samples.size * 0.75).toInt().coerceIn(0, samples.lastIndex)]
  }

  private data class BubbleShadingMetrics(
    val darkCoverage: Double,
    val quadrantsFilled: Int,
    val outsideBleed: Double
  )

  /**
   * Measures genuine pen/pencil shading inside a bubble using adaptive dark-pixel area
   * coverage, 4-quadrant fill distribution (detects half-shaded / checkmarks), and
   * outer-rim halo bleed (detects messy "lagpas-lagpas" shading outside the circle).
   */
  private fun measureBubbleShading(
    bmp: Bitmap,
    cx: Int,
    cy: Int,
    innerRadius: Int,
    outerRimRadius: Int,
    maxVerticalBleedPx: Int,
    darkCutoff: Double
  ): BubbleShadingMetrics {
    // Micro-search (+/- 2px) to absorb slight 1mm printer margin shifts
    var best = evaluateBubbleAt(
      bmp,
      cx,
      cy,
      innerRadius,
      outerRimRadius,
      maxVerticalBleedPx,
      darkCutoff
    )
    val shifts = intArrayOf(-2, 2)
    for (sy in shifts) {
      for (sx in shifts) {
        val candidate = evaluateBubbleAt(
          bmp,
          cx + sx,
          cy + sy,
          innerRadius,
          outerRimRadius,
          maxVerticalBleedPx,
          darkCutoff
        )
        if (candidate.darkCoverage > best.darkCoverage) {
          best = candidate
        }
      }
    }
    return best
  }

  private fun evaluateBubbleAt(
    bmp: Bitmap,
    cx: Int,
    cy: Int,
    innerRadius: Int,
    outerRimRadius: Int,
    maxVerticalBleedPx: Int,
    darkCutoff: Double
  ): BubbleShadingMetrics {
    val r2 = innerRadius * innerRadius
    val bleedInnerR = (outerRimRadius * 1.30f).toInt().coerceAtLeast(outerRimRadius + 3)
    val bleedInnerR2 = bleedInnerR * bleedInnerR
    val bleedOuterRx = (outerRimRadius * 1.88f).toInt().coerceAtLeast(bleedInnerR + 3)
    val bleedOuterRy = minOf(
      (outerRimRadius * 1.55f).toInt().coerceAtLeast(bleedInnerR + 2),
      maxVerticalBleedPx
    )

    val minX = (cx - bleedOuterRx).coerceAtLeast(0)
    val maxX = (cx + bleedOuterRx).coerceAtMost(bmp.width - 1)
    val minY = (cy - bleedOuterRy).coerceAtLeast(0)
    val maxY = (cy + bleedOuterRy).coerceAtMost(bmp.height - 1)

    var darkCount = 0
    var totalCount = 0
    var bleedDark = 0
    var bleedTotal = 0
    val quadDark = IntArray(4)
    val quadTotal = IntArray(4)

    val invRx2 = 1.0 / (bleedOuterRx * bleedOuterRx).toDouble()
    val invRy2 = 1.0 / (bleedOuterRy * bleedOuterRy).toDouble()

    for (y in minY..maxY step 2) {
      val dy = y - cy
      val dy2 = dy * dy
      for (x in minX..maxX step 2) {
        val dx = x - cx
        val d2 = dx * dx + dy2
        if (d2 <= r2) {
          val p = bmp.getPixel(x, y)
          val luma = (Color.red(p) * 30 + Color.green(p) * 59 + Color.blue(p) * 11) / 100.0
          val q = (if (dy >= 0) 2 else 0) + (if (dx >= 0) 1 else 0)
          quadTotal[q]++
          totalCount++
          if (luma < darkCutoff) {
            darkCount++
            quadDark[q]++
          }
        } else if (d2 >= bleedInnerR2 && (dx * dx * invRx2 + dy2 * invRy2) <= 1.0) {
          val p = bmp.getPixel(x, y)
          val luma = (Color.red(p) * 30 + Color.green(p) * 59 + Color.blue(p) * 11) / 100.0
          bleedTotal++
          if (luma < darkCutoff) {
            bleedDark++
          }
        }
      }
    }

    if (totalCount == 0) return BubbleShadingMetrics(0.0, 0, 0.0)
    var filledQuads = 0
    for (q in 0..3) {
      if (quadTotal[q] > 0 && (quadDark[q].toDouble() / quadTotal[q].toDouble()) >= 0.28) {
        filledQuads++
      }
    }
    val outsideBleed = if (bleedTotal > 0) bleedDark.toDouble() / bleedTotal.toDouble() else 0.0
    return BubbleShadingMetrics(
      darkCoverage = darkCount.toDouble() / totalCount.toDouble(),
      quadrantsFilled = filledQuads,
      outsideBleed = outsideBleed
    )
  }

  private fun assessLightingAndSharpness(bmp: Bitmap, dimLumaCutoff: Double = 85.0): Pair<String, Double> {
    var sumLuma = 0.0
    var edgeEnergy = 0.0
    var count = 0
    val step = 18

    var y = 120
    while (y < bmp.height - 120) {
      var x = 120
      while (x < bmp.width - 120) {
        val p = bmp.getPixel(x, y)
        val pRight = bmp.getPixel(x + 2, y)
        val l1 = (Color.red(p) * 30 + Color.green(p) * 59 + Color.blue(p) * 11) / 100.0
        val l2 = (Color.red(pRight) * 30 + Color.green(pRight) * 59 + Color.blue(pRight) * 11) / 100.0
        sumLuma += l1
        edgeEnergy += abs(l1 - l2)
        count++
        x += step
      }
      y += step
    }

    val avgLuma = if (count > 0) sumLuma / count else 200.0
    val sharpness = ((if (count > 0) edgeEnergy / count else 12.0) / 18.0).coerceIn(0.1, 1.0)
    val lighting = when {
      avgLuma < dimLumaCutoff -> "Dim"
      avgLuma > 248.0 -> "Glare"
      else -> "Clear"
    }
    return Pair(lighting, (sharpness * 100.0).roundToInt() / 100.0)
  }

  /**
   * Locates the printed black row timing tick within +/- 10px vertically of its expected
   * position and returns the vertical correction offset (in pixels) for that exact row.
   */
  private fun refineRowYFromTimingTick(
    bmp: Bitmap,
    expectedX: Int,
    expectedY: Int,
    darkCutoff: Double
  ): Int {
    val searchHalfY = 10
    val searchHalfX = 8
    val minX = (expectedX - searchHalfX).coerceAtLeast(0)
    val maxX = (expectedX + searchHalfX).coerceAtMost(bmp.width - 1)
    val minY = (expectedY - searchHalfY).coerceAtLeast(0)
    val maxY = (expectedY + searchHalfY).coerceAtMost(bmp.height - 1)

    var sumY = 0.0
    var darkCount = 0
    for (y in minY..maxY) {
      for (x in minX..maxX step 2) {
        val p = bmp.getPixel(x, y)
        val luma = (Color.red(p) * 30 + Color.green(p) * 59 + Color.blue(p) * 11) / 100.0
        if (luma < darkCutoff) {
          sumY += y
          darkCount++
        }
      }
    }
    if (darkCount < 5) return 0
    val detectedY = (sumY / darkCount).roundToInt()
    return (detectedY - expectedY).coerceIn(-10, 10)
  }
}
