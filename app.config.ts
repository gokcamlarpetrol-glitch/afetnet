import { ConfigContext, ExpoConfig } from "@expo/config";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// CRITICAL: Load .env file before reading environment variables
dotenv.config();

const PROJECT_ROOT = __dirname;
const IOS_GOOGLE_SERVICES_CANDIDATES = [
  'ios/AfetNetAcilletiim/GoogleService-Info.plist',
  'GoogleService-Info.plist',
];
const ANDROID_GOOGLE_SERVICES_CANDIDATES = [
  'android/app/google-services.json',
  'google-services.json',
];

const toExpoRelativePath = (relativePath: string): string => {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith('./') ? normalized : `./${normalized}`;
};

const findFirstExistingPath = (candidates: string[]): string | null => {
  for (const candidate of candidates) {
    const absolutePath = path.resolve(PROJECT_ROOT, candidate);
    if (fs.existsSync(absolutePath)) {
      return candidate;
    }
  }
  return null;
};

const readFileSafe = (relativePath: string | null): string => {
  if (!relativePath) return '';
  try {
    return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf8');
  } catch {
    return '';
  }
};

const extractPlistStringValue = (plistText: string, key: string): string => {
  if (!plistText) return '';
  const match = plistText.match(new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`, 'm'));
  return match?.[1]?.trim() || '';
};

const extractAndroidApiKey = (googleServicesJson: string): string => {
  if (!googleServicesJson) return '';
  try {
    const parsed = JSON.parse(googleServicesJson) as {
      client?: Array<{ api_key?: Array<{ current_key?: string }> }>;
    };
    const clients = Array.isArray(parsed.client) ? parsed.client : [];
    for (const client of clients) {
      const apiKeys = Array.isArray(client.api_key) ? client.api_key : [];
      for (const apiKeyEntry of apiKeys) {
        const key = typeof apiKeyEntry?.current_key === 'string' ? apiKeyEntry.current_key.trim() : '';
        if (key.length > 0) {
          return key;
        }
      }
    }
  } catch { /* ignore parse errors */ }
  return '';
};

const foundIosPath = findFirstExistingPath(IOS_GOOGLE_SERVICES_CANDIDATES);
const foundAndroidPath = findFirstExistingPath(ANDROID_GOOGLE_SERVICES_CANDIDATES);

const resolvedIosGoogleServicesFile = toExpoRelativePath(
  foundIosPath || IOS_GOOGLE_SERVICES_CANDIDATES[0],
);
const resolvedAndroidGoogleServicesFile = toExpoRelativePath(
  foundAndroidPath || ANDROID_GOOGLE_SERVICES_CANDIDATES[0],
);

const resolveFirebaseApiKey = (): string => {
  const envKey = (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').trim();
  if (envKey.length > 0) {
    return envKey;
  }

  const iosKey = extractPlistStringValue(readFileSafe(foundIosPath), 'API_KEY');
  if (iosKey.length > 0) {
    return iosKey;
  }

  const androidKey = extractAndroidApiKey(readFileSafe(foundAndroidPath));
  if (androidKey.length > 0) {
    return androidKey;
  }

  return '';
};

const resolvedFirebaseApiKey = resolveFirebaseApiKey();
if (!resolvedFirebaseApiKey) {
  console.warn('[app.config] Firebase API key could not be resolved from env, plist, or google-services.json');
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "AfetNet - Acil İletişim",
  slug: "afetnet",
  scheme: "afetnet",
  owner: "gokhancamci1",
  version: "1.5.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "cover",
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
        cameraPermission: "AfetNet kameranızı sohbette paylaşmak için fotoğraf çekmek, aile üyesi eklerken QR kod taramak ve afet raporuna fotoğraf eklemek için kullanır. Örneğin, deprem sonrası hasar fotoğrafı çekip siz paylaşmayı seçtiğinizde rapor olarak gönderebilirsiniz.",
      }
    ],
    "expo-font",
    "expo-localization",
    // Audio & Video (migrated from deprecated expo-av)
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
          "kotlinVersion": "2.1.20",
          "enableProguardInReleaseBuilds": true, // ELITE SECURITY: Obfuscation
        }
      },
    ],
    // ELITE: Google Sign-In Plugin
    "@react-native-google-signin/google-signin",
    // NOTE: react-native-webrtc doesn't have an Expo config plugin
    // VoiceCallService uses graceful fallback if native module unavailable
    // AfetNet BLE Peripheral: autolinked via expo-module.config.json (no config plugin needed)
  ],
  ios: {
    ...config.ios,
    buildNumber: "32",
    bundleIdentifier: "com.gokhancamci.afetnetapp",
    supportsTablet: true,
    // APPLE REJECTION FIX: requireFullScreen must be true because the app:
    // 1. Uses portrait-only orientation (no landscape support)
    // 2. Uses static Dimensions.get('window') at module level in many screens
    // 3. Does not handle iPad Split View / Slide Over resize events
    // Without this, Apple tests Split View on iPad and the UI breaks.
    requireFullScreen: true,
    usesAppleSignIn: true, // ELITE: Apple Sign-In için gerekli entitlement
    jsEngine: "hermes", // Redundant but explicit

    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSLocationWhenInUseUsageDescription: "AfetNet, SOS sinyali gönderirken, sohbette konum paylaşırken, deprem yakınlık hesabı yaparken, toplanma alanlarını gösterirken ve afet haritasını kullanırken konumunuza erişir.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "AfetNet, aile üyelerinizle gerçek zamanlı konum paylaşımı ve arka planda deprem erken uyarısı için sürekli konum erişimi gerektirir.",
      NSBluetoothAlwaysUsageDescription: "AfetNet, internet olmadan mesh ağı ile mesaj göndermek, SOS yardım çağrısı yaymak ve yakındaki kullanıcıları keşfetmek için Bluetooth kullanır.",
      NSBluetoothPeripheralUsageDescription: "AfetNet, mesh ağında yakındaki cihazlara mesaj ve SOS sinyali iletmek için Bluetooth çevre birimi olarak çalışır.",
      NSMicrophoneUsageDescription: "AfetNet, sohbette sesli mesaj göndermek, sesli arama yapmak ve acil durum SOS sinyalinde ortam sesi kaydı almak için mikrofon kullanır.",
      NSCameraUsageDescription: "AfetNet kameranızı sohbette paylaşmak için fotoğraf çekmek, aile üyesi eklerken QR kod taramak ve afet raporuna fotoğraf eklemek için kullanır. Örneğin, deprem sonrası hasar fotoğrafı çekip siz paylaşmayı seçtiğinizde rapor olarak gönderebilirsiniz.",
      NSMotionUsageDescription: "AfetNet, deprem sarsıntısını algılayarak erken uyarı vermek, düşme/çarpışma tespiti yapmak ve kullanıcı aktivitesini değerlendirmek için hareket sensörlerini kullanır.",
      NSPhotoLibraryUsageDescription: "AfetNet, sohbette ve afet raporlarında paylaşmak üzere fotoğraf kütüphanenizden görsel seçmek için erişir.",
      NSPhotoLibraryAddUsageDescription: "AfetNet, acil durum fotoğraflarını cihazınıza kaydetmek için fotoğraf kütüphanenize erişir.",
      NSFaceIDUsageDescription: "AfetNet, hesabınıza yetkisiz erişimi engellemek ve oturum açma işlemini hızlandırmak için Face ID ile kimlik doğrulaması yapar.",
      // Apple Guideline 2.5.4: Each background mode is justified:
      // fetch: BackgroundTaskService + BackgroundEEWService (earthquake data polling)
      // remote-notification: Push notifications (SOS alerts, messages, EEW warnings)
      // location: FamilyTrackingService + BackgroundEEWService location keep-alive + BackgroundLocationTask
      // bluetooth-central: HighPerformanceBle BLE scanning for offline mesh networking
      // bluetooth-peripheral: AfetNetBlePeripheral GATT server for mesh peer discovery
      // processing: expo-background-task BGProcessingTask (mesh sync, seismic monitoring)
      UIBackgroundModes: [
        "fetch",
        "remote-notification",
        "location",
        "bluetooth-central",
        "bluetooth-peripheral",
        "processing",
      ],
      ITSAppUsesNonExemptEncryption: false,
      // CRITICAL: ATS — only allow specific HTTP exceptions (Apple Review compliant)
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {},
      },
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
        "whatsapp",
      ],
    },
    // Entitlements - Development için minimal
    // Apple Developer Portal'da capabilities aktif edilmedikçe çoğu entitlement hata verir
    // Background modes Info.plist'te UIBackgroundModes ile tanımlı (yeterli)
    entitlements: {
      "aps-environment": "production", // CRITICAL: Production için "production" (App Store için zorunlu)
      // IAP kaldırıldı - uygulama tamamen ücretsiz
    },
    googleServicesFile: resolvedIosGoogleServicesFile,
  },
  android: {
    ...config.android,
    package: "com.gokhancamci.afetnetapp",
    versionCode: 32,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon-foreground.png",
      backgroundImage: "./assets/adaptive-icon-background.png",
    },
    permissions: [
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.BLUETOOTH_ADVERTISE",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.INTERNET",
      "android.permission.VIBRATE",
    ],
    googleServicesFile: resolvedAndroidGoogleServicesFile,
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID || "072f1217-172a-40ce-af23-3fc0ad3f7f09" },
    devClient: false,
    // EEW should default to enabled in release unless explicitly disabled.
    EEW_ENABLED: process.env.EEW_ENABLED ? process.env.EEW_ENABLED === 'true' : true,
    EEW_NATIVE_ALARM: process.env.EEW_NATIVE_ALARM === 'true' ? true : false,
    OPENAI_PROXY_URL: process.env.OPENAI_PROXY_URL || process.env.EXPO_PUBLIC_OPENAI_PROXY_URL || '',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    // CRITICAL: Firebase API Key from .env file (loaded via dotenv.config() above)
    EXPO_PUBLIC_FIREBASE_API_KEY: resolvedFirebaseApiKey,
    FIREBASE_API_KEY: resolvedFirebaseApiKey,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    // SECURITY FIX: ORG_SECRET removed — must never be in client bundle
    // Use only server-side (Cloud Functions environment config)
    API_BASE_URL: process.env.API_BASE_URL || '', // DEPRECATED: Using Firebase
    privacyPolicyUrl: "https://gokcamlarpetrol-glitch.github.io/afetnet/privacy-policy.html",
    termsOfServiceUrl: "https://gokcamlarpetrol-glitch.github.io/afetnet/terms-of-service.html",
    supportEmail: "support@afetnet.app",
  },
});
