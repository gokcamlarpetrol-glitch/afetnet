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
      NSBluetoothAlwaysUsageDescription: "AfetNet, internet olmadığında acil durum mesajları göndermek ve kurtarma ekipleriyle iletişim kurmak için yakındaki cihazlarla Bluetooth mesh ağı oluşturur. Bu hayat kurtarıcıdır.",
      NSBluetoothPeripheralUsageDescription: "AfetNet, enkaz altındaki kişilere ulaşmak için Bluetooth beacon olarak çalışır ve acil yardım sinyali yayar. Bu hayat kurtarıcıdır.",
      NSLocationWhenInUseUsageDescription: "AfetNet, SOS sinyali gönderirken konumunuzu kurtarma ekiplerine iletmek, güvenli toplanma noktalarını göstermek ve aile üyelerinizi takip etmek için konum kullanır.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "AfetNet, aile üyelerinizin gerçek zamanlı konumunu takip etmek, deprem erken uyarısı vermek ve uygulama kapalıyken bile acil durum bildirimleri almak için arka planda konum erişimi gerektirir. Bu hayat kurtarıcıdır.",
      NSMicrophoneUsageDescription: "AfetNet, enkaz altında kalan kişilere sesli yönlendirme vermek, kurtarma ekiplerinin ses sinyallerini algılamak ve acil ses notları kaydetmek için mikrofon kullanır. Bu hayat kurtarıcıdır.",
      NSCameraUsageDescription: "AfetNet, aile üyeleri eklemek ve kurtarma ekipleriyle QR kod üzerinden bilgi paylaşmak için kamera kullanır.",
      NSMotionUsageDescription: "AfetNet, enkaz altında hareket algılamak, kapalı alanlarda navigasyon yapmak ve deprem sarsıntısını algılayarak erken uyarı vermek için hareket sensörlerini kullanır. Bu hayat kurtarıcıdır.",
      UIBackgroundModes: [
        "bluetooth-central",
        "bluetooth-peripheral",
        "processing",
        "audio",
        "location",
        "background-fetch"
      ],
      ITSAppUsesNonExemptEncryption: false
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
    "expo-barcode-scanner"
    // "react-native-maps" - temporarily disabled for Expo Go compatibility
  ],
  newArchEnabled: true,
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID || "072f1217-172a-40ce-af23-3fc0ad3f7f09" },
    privacyPolicyUrl: "https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html",
    termsOfServiceUrl: "https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html",
    supportEmail: "support@afetnet.app",
    privacyEmail: "privacy@afetnet.app",
    // Firebase configuration
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || "afetnet-app",
      apiKey: process.env.FIREBASE_API_KEY || "demo-api-key",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "afetnet-app.firebaseapp.com",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "afetnet-app.appspot.com",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
      appId: process.env.FIREBASE_APP_ID || "1:123456789:ios:abcdef123456"
    }
  }
});