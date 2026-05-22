# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-ble-plx — BLE JNI/reflection erişimi
-keep class com.polidea.rxandroidble2.** { *; }
-keep class com.polidea.rxandroidble2.internal.** { *; }
-keepclassmembers class com.polidea.rxandroidble2.** { *; }

# AfetNet özel BLE Peripheral modülü — Expo native modül reflection
-keep class expo.modules.afetnetbleperipheral.** { *; }
-keepclassmembers class expo.modules.afetnetbleperipheral.** { *; }

# Firebase — FCM, Firestore, Auth, Analytics
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keepclassmembers class com.google.firebase.** { *; }
-keepclassmembers class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
