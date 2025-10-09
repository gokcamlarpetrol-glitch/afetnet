import { ConfigContext, ExpoConfig } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "AfetNet",
  slug: "afetnet",
  scheme: "afetnet",
  owner: undefined,
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
    "expo-camera",
    "expo-media-library",
    "expo-contacts",
    "expo-barcode-scanner",
    "expo-localization"
  ],
  ios: {
    ...config.ios,
    bundleIdentifier: "org.afetnet.app",
    supportsTablet: true,
    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSBluetoothAlwaysUsageDescription: "Yakın cihazlarla şebekesiz mesajlaşma ve kurtarma ağı için Bluetooth kullanılır.",
      NSBluetoothPeripheralUsageDescription: "Bluetooth yakınlık yayını ve mesaj aktarımı için gereklidir.",
      NSLocationWhenInUseUsageDescription: "Konumunuzu deprem ve acil durum için kullanır.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "Acil durumlarda arka planda konum takibi için gerekli.",
      NSMicrophoneUsageDescription: "Enkaz altında sesli yönlendirme, yakınlık ping dinleme ve kısa ses notları için mikrofon kullanılır.",
      NSCameraUsageDescription: "QR kod taramak için kamera erişimi gerekir.",
      NSMotionUsageDescription: "PDR (adım izleme) ve sarsıntı algısı için hareket sensörlerine ihtiyaç var.",
      UIBackgroundModes: [
        "bluetooth-central",
        "bluetooth-peripheral",
        "processing",
        "audio",
        "location",
        "background-fetch"
      ]
    }
  },
  android: {
    ...config.android,
    package: "org.afetnet.app",
    versionCode: 1,
    // googleServicesFile: "./google-services.json", // Commented out until file is provided
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon-foreground.png",
      backgroundImage: "./assets/adaptive-icon-background.png"
    },
    permissions: Array.from(new Set([...(config.android?.permissions || []),
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.BLUETOOTH_ADVERTISE",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.WAKE_LOCK",
      "android.permission.INTERNET"
    ])),
  },
  plugins: [
    ["expo-notifications"],
    ["expo-location"],
    "expo-font",
    "react-native-ble-plx",
    "expo-barcode-scanner",
    [
      "@stripe/stripe-react-native",
      {
        merchantIdentifier: "merchant.com.afetnet.app",
        enableGooglePay: true,
      }
    ]
  ],
  newArchEnabled: true,
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID || "072f1217-172a-40ce-af23-3fc0ad3f7f09" },
    privacyPolicyUrl: "https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html",
    termsOfServiceUrl: "https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html",
    supportEmail: "support@afetnet.app",
    privacyEmail: "privacy@afetnet.app"
  }
});