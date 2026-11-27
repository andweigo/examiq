package com.examiq.app.platform

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class ExamIQCameraViewManager : SimpleViewManager<ExamIQCameraView>() {

  override fun getName(): String = "ExamIQCameraView"

  override fun createViewInstance(reactContext: ThemedReactContext): ExamIQCameraView {
    return ExamIQCameraView(reactContext)
  }

  @ReactProp(name = "mode")
  fun setMode(view: ExamIQCameraView, mode: String?) {
    view.setScanMode(mode ?: "qr")
  }

  @ReactProp(name = "torchEnabled", defaultBoolean = false)
  fun setTorchEnabled(view: ExamIQCameraView, enabled: Boolean) {
    view.setTorchEnabled(enabled)
  }

  @ReactProp(name = "active", defaultBoolean = true)
  fun setActive(view: ExamIQCameraView, active: Boolean) {
    view.setCameraActive(active)
  }

  override fun onDropViewInstance(view: ExamIQCameraView) {
    view.destroy()
    super.onDropViewInstance(view)
  }
}
