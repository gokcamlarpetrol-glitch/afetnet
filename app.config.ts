import { ConfigContext, ExpoConfig } from "@expo/config";
import * as dotenv from 'dotenv';

// CRITICAL: Load .env file before reading environment variables
dotenv.config();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "AfetNet - Şebekesiz Acil İletişim",
  slug: "afetnet",
  scheme: "afetnet",
  owner: "gokhancamci1",
  version: "1.0.3",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#C62828",
  },
  primaryColor: "#C62828",
  updates: { fallbackToCacheTimeout: 0 },
  assetBundlePatterns: ["**/*"],
  plugins: [
    "expo-secure-store",
    "expo-location",
    "expo-notifications",
    "expo-web-browser",
    [
      "expo-camera",
      {
        cameraPermission: "AfetNet, QR kodları okumak için kameraya erişir.",
      }
    ],
    "expo-font",
    "expo-localization",
    // SDK 54: expo-av replacement packages
    "expo-audio",
    "expo-video",
    // SDK 54: expo-background-fetch replacement
    "expo-background-task",
    // NOTE: react-native-ble-plx now works natively in SDK 54+ without config plugin
    // "expo-torch", // NOTE: expo-torch doesn't have a config plugin, but works as native module
    // "expo-maps", // Disabled - react-native-maps kullanılıyor (development build gerekli)
    [
      "expo-build-properties",
      {
        "ios": {
          "deploymentTarget": "15.1",
          "useFrameworks": "static", // Critical for some native modules
          "jsEngine": "hermes" // ELITE SECURITY: Bytecode compilation
        },
        "android": {
          "compileSdkVersion": 34,
          "targetSdkVersion": 34,
          "buildToolsVersion": "34.0.0",
          "jsEngine": "hermes", // ELITE SECURITY: Bytecode compilation
          "kotlinVersion": "1.9.23",
          "enableProguardInReleaseBuilds": true, // ELITE SECURITY: Obfuscation
        }
      },
    ],
    // ELITE: Google Sign-In Plugin
    "@react-native-google-signin/google-signin",
  ],
  ios: {
    ...config.ios,
    buildNumber: "13", // Incremented for crash fix
    bundleIdentifier: "com.gokhancamci.afetnetapp",
    supportsTablet: true,
    usesAppleSignIn: true, // ELITE: Apple Sign-In için gerekli entitlement
    jsEngine: "hermes", // Redundant but explicit

    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSLocationWhenInUseUsageDescription: "AfetNet, acil durum sinyali gönderirken konumunuzu kurtarma ekiplerine iletmek için konum kullanır.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "AfetNet, aile üyelerinizin gerçek zamanlı konumunu takip etmek için arka planda konum erişimi gerektirir.",
      NSBluetoothAlwaysUsageDescription: "AfetNet, şebeke olmadan offline mesajlaşma ve acil durum yardım çağrısı için Bluetooth kullanır.",
      NSBluetoothPeripheralUsageDescription: "AfetNet, yakındaki kişilere şebekesiz SOS sinyali göndermek için Bluetooth kullanır.",
      NSMicrophoneUsageDescription: "AfetNet, acil durum sesli yönlendirme vermek için mikrofon kullanır.",
      NSCameraUsageDescription: "AfetNet, aile üyeleri eklemek için kamera kullanır.",
      NSMotionUsageDescription: "AfetNet, deprem sarsıntısını algılayarak erken uyarı vermek için hareket sensörlerini kullanır.",
      NSContactsUsageDescription: "AfetNet, acil durum kişilerinize hızlı erişim için kişilerinize erişir.",
      NSPhotoLibraryUsageDescription: "AfetNet, acil durum fotoğraflarını görüntülemek için fotoğraf kütüphanenize erişir.",
      NSPhotoLibraryAddUsageDescription: "AfetNet, acil durum fotoğraflarını kaydetmek için fotoğraf kütüphanenize erişir.",
      NSFaceIDUsageDescription: "AfetNet, uygulama güvenliği için Face ID kullanır.",
      NSLocationAlwaysUsageDescription: "AfetNet, aile üyelerinizin gerçek zamanlı konumunu takip etmek için arka planda konum erişimi gerektirir.",
      UIBackgroundModes: [
        "fetch",
        "remote-notification",
        "location",
        "bluetooth-central",
        "bluetooth-peripheral",
      ],
      ITSAppUsesNonExemptEncryption: false,
      // ELITE: Required URL schemes for WebView and deep linking
      LSApplicationQueriesSchemes: [
        "about",
        "tel",
        "mailto",
        "sms",
        "http",
        "https",
        "maps",
        "comgooglemaps",
      ],
    },
    // Entitlements - Development için minimal
    // Apple Developer Portal'da capabilities aktif edilmedikçe çoğu entitlement hata verir
    // Background modes Info.plist'te UIBackgroundModes ile tanımlı (yeterli)
    entitlements: {
      "aps-environment": "production", // CRITICAL: Production için "production" (App Store için zorunlu)
      // IAP kaldırıldı - uygulama tamamen ücretsiz
    },
    googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    ...config.android,
    package: "com.gokhancamci.afetnetapp",
    versionCode: 3,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon-foreground.png",
      backgroundImage: "./assets/adaptive-icon-background.png",
    },
    permissions: [
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.INTERNET",
    ],
    googleServicesFile: "./google-services.json",
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID || "072f1217-172a-40ce-af23-3fc0ad3f7f09" },
    devClient: true,
    EEW_ENABLED: process.env.EEW_ENABLED === 'true' ? true : false,
    EEW_NATIVE_ALARM: process.env.EEW_NATIVE_ALARM === 'true' ? true : false,
    EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
    RC_IOS_KEY: process.env.RC_IOS_KEY || '',
    RC_ANDROID_KEY: process.env.RC_ANDROID_KEY || '',
    // CRITICAL: Firebase API Key from .env file (loaded via dotenv.config() above)
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    ORG_SECRET: process.env.ORG_SECRET || '',
    API_BASE_URL: process.env.API_BASE_URL || '', // DEPRECATED: Using Firebase
    privacyPolicyUrl: "https://raw.githubusercontent.com/gokcamlarpetrol-glitch/afetnet/main/docs/privacy-policy.html",
    termsOfServiceUrl: "https://raw.githubusercontent.com/gokcamlarpetrol-glitch/afetnet/main/docs/terms-of-service.html",
    supportEmail: "support@afetnet.app",
  },
});