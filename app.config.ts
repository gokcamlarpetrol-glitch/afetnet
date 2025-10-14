import { ConfigContext, ExpoConfig } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "AfetNet",
  slug: "afetnet",
  scheme: "afetnet",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: { 
    image: "./assets/splash.png", 
    resizeMode: "contain", 
    backgroundColor: "#C62828" 
  },
  primaryColor: "#C62828",
  updates: { fallbackToCacheTimeout: 0 },
  assetBundlePatterns: ["**/*"],
  plugins: [
    "expo-secure-store",
    "expo-location",
    "expo-notifications",
    "expo-barcode-scanner",
    "expo-font",
    "expo-localization",
    [
      "expo-build-properties",
      {
        "ios": {
          "deploymentTarget": "15.1"
        }
      }
    ]
  ],
  ios: {
    ...config.ios,
    bundleIdentifier: "org.afetnet.app",
    supportsTablet: true,
    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSLocationWhenInUseUsageDescription: "AfetNet, acil durum sinyali gönderirken konumunuzu kurtarma ekiplerine iletmek için konum kullanır.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "AfetNet, aile üyelerinizin gerçek zamanlı konumunu takip etmek için arka planda konum erişimi gerektirir.",
      NSMicrophoneUsageDescription: "AfetNet, acil durum sesli yönlendirme vermek için mikrofon kullanır.",
      NSCameraUsageDescription: "AfetNet, aile üyeleri eklemek için kamera kullanır.",
      NSMotionUsageDescription: "AfetNet, deprem sarsıntısını algılayarak erken uyarı vermek için hareket sensörlerini kullanır.",
      UIBackgroundModes: [
        "bluetooth-central",
        "bluetooth-peripheral",
        "processing",
        "location"
      ],
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    ...config.android,
    package: "org.afetnet.app",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon-foreground.png",
      backgroundImage: "./assets/adaptive-icon-background.png"
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
      "android.permission.INTERNET"
    ],
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID || "072f1217-172a-40ce-af23-3fc0ad3f7f09" },
    privacyPolicyUrl: "https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html",
    termsOfServiceUrl: "https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html",
    supportEmail: "support@afetnet.app"
  }
});