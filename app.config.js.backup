const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  expo: {
    name: IS_DEV ? 'AfetNet Dev' : 'AfetNet',
    slug: 'afetnet',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icons/icon.png',
    userInterfaceStyle: 'dark',
    displayName: 'AfetNet',
    splash: {
      image: './assets/icons/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1a1a1a'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? 'org.afetnet.app.dev' : 'org.afetnet.app',
      buildNumber: '1',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Yardım çağrısında konumunuzu paylaşmak için kullanılır.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Yardım çağrısında konumunuzu paylaşmak için kullanılır.',
        NSBluetoothAlwaysUsageDescription: 'Yakındaki cihazlarla afet bilgisini iletmek için kullanılır.',
        NSBluetoothPeripheralUsageDescription: 'Yakındaki cihazlarla afet bilgisini iletmek için kullanılır.',
        NSUserNotificationsUsageDescription: 'Acil uyarılar ve bilgilendirmeler için.',
        UIBackgroundModes: [
          'bluetooth-central',
          'bluetooth-peripheral',
          'location',
          'background-fetch',
          'background-processing'
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/icons/adaptive-icon.png',
        backgroundColor: '#1a1a1a'
      },
      package: IS_DEV ? 'org.afetnet.app.dev' : 'org.afetnet.app',
      versionCode: 1,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'BLUETOOTH',
        'BLUETOOTH_ADMIN',
        'BLUETOOTH_CONNECT',
        'BLUETOOTH_SCAN',
        'ACCESS_WIFI_STATE',
        'CHANGE_WIFI_STATE',
        'INTERNET',
        'ACCESS_NETWORK_STATE',
        'VIBRATE',
        'RECEIVE_BOOT_COMPLETED',
        'WAKE_LOCK',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'FOREGROUND_SERVICE_CONNECTED_DEVICE',
        'POST_NOTIFICATIONS'
      ]
    },
    web: {
      favicon: './assets/icons/favicon.png'
    },
    plugins: [
      'expo-location',
      'expo-battery',
      'expo-notifications',
      'expo-task-manager',
      [
        'expo-sms',
        {
          smsPermission: 'AfetNet internet bağlantısı olmadığında SMS mesajları gönderebilir.'
        }
      ]
    ],
    extra: {
      eas: {
        projectId: 'your-eas-project-id'
      },
      // Environment variables injected at build time
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000',
      backendWsUrl: process.env.EXPO_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000/ws',
      remoteConfigUrl: process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL,
      remoteConfigPublicKey: process.env.EXPO_PUBLIC_REMOTE_CONFIG_PUBLIC_KEY,
      eewFeedUrls: process.env.EXPO_PUBLIC_EEW_FEED_URLS,
      fcmSenderId: process.env.EXPO_PUBLIC_FCM_SENDER_ID,
      apnsBundleId: process.env.EXPO_PUBLIC_APNS_BUNDLE_ID,
      smsGatewayUrl: process.env.EXPO_PUBLIC_SMS_GATEWAY_URL,
      smsGatewayApiKey: process.env.EXPO_PUBLIC_SMS_GATEWAY_API_KEY,
      tilesUpdateUrl: process.env.EXPO_PUBLIC_TILES_UPDATE_URL,
      telemetryEndpoint: process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT,
      debug: process.env.EXPO_PUBLIC_DEBUG === 'true',
      logLevel: process.env.EXPO_PUBLIC_LOG_LEVEL || 'info'
    }
  }
};
