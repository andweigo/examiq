# React Native & ExamIQ Platform ProGuard / R8 Keep Rules
-keepclassmembers class com.examiq.app.platform.** {
    @com.facebook.react.bridge.ReactMethod *;
    @com.facebook.react.uimanager.annotations.ReactProp *;
    @com.facebook.react.uimanager.annotations.ReactPropGroup *;
}
-keep class com.examiq.app.platform.ExamIQNativePackage { *; }
