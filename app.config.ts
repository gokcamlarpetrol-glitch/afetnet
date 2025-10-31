import { ConfigContext, ExpoConfig } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "AfetNet",
  slug: "afetnet",
  scheme: "afetnet",
  owner: "gokhancamci1",
  version: "1.0.1",
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
    [
      "expo-camera",
      {
        cameraPermission: "AfetNet, QR kodları okumak için kameraya erişir.",
      }
    ],
    "expo-font",
    "expo-localization",
    "expo-maps",
    [
      "expo-build-properties",
      {
        "ios": {
          "deploymentTarget": "15.1",
        },
      },
    ],
  ],
  ios: {
    ...config.ios,
    buildNumber: "1",
          bundleIdentifier: "com.gokhancamci.afetnetapp",
    supportsTablet: true,
    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSLocationWhenInUseUsageDescription: "AfetNet, acil durum sinyali gönderirken konumunuzu kurtarma ekiplerine iletmek için konum kullanır.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "AfetNet, aile üyelerinizin gerçek zamanlı konumunu takip etmek için arka planda konum erişimi gerektirir.",
      NSMicrophoneUsageDescription: "AfetNet, acil durum sesli yönlendirme vermek için mikrofon kullanır.",
      NSCameraUsageDescription: "AfetNet, aile üyeleri eklemek için kamera kullanır.",
      NSMotionUsageDescription: "AfetNet, deprem sarsıntısını algılayarak erken uyarı vermek için hareket sensörlerini kullanır.",
      UIBackgroundModes: [
        "fetch",
        "remote-notification",
        "processing",
        "location",
        "bluetooth-central",
        "bluetooth-peripheral",
      ],
      ITSAppUsesNonExemptEncryption: false,
    },
    // Entitlements - Development için minimal
    // Apple Developer Portal'da capabilities aktif edilmedikçe çoğu entitlement hata verir
    // Background modes Info.plist'te UIBackgroundModes ile tanımlı (yeterli)
    entitlements: {
      "aps-environment": "development", // Development için "development"
      "com.apple.developer.in-app-payments": ["merchant.com.gokhancamci.afetnetapp"],
      // Push notifications - Apple Developer Portal'da aktif edildiyse true yapın
      // "com.apple.developer.push-notifications": true,
    },
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
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID || "072f1217-172a-40ce-af23-3fc0ad3f7f09" },
    devClient: true,
    EEW_ENABLED: process.env.EEW_ENABLED === 'true' ? true : false,
    EEW_NATIVE_ALARM: process.env.EEW_NATIVE_ALARM === 'true' ? true : false,
    privacyPolicyUrl: "https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html",
    termsOfServiceUrl: "https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html",
    supportEmail: "support@afetnet.app",
  },
});