package com.examiq.app.platform

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ExamIQNativePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(
      ExamIQSqliteModule(reactContext),
      ExamIQPdfModule(reactContext),
      ExamIQOmrModule(reactContext),
      ExamIQFilePickerModule(reactContext)
    )

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(
      ExamIQCameraViewManager()
    )
}
