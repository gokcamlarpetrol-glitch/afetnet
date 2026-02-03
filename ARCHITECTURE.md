# AfetNet Mimari Dokümantasyonu

## 🏗 Genel Bakış

AfetNet, React Native ve Expo ile geliştirilmiş, modüler mimari prensiplerine dayanan bir afet hazırlık uygulamasıdır.

```
┌─────────────────────────────────────────────────────────────┐
│                        AfetNet App                          │
├─────────────────────────────────────────────────────────────┤
│  Screens    │  Components   │  Hooks      │  Navigation     │
├─────────────────────────────────────────────────────────────┤
│                    State Management (Zustand)               │
├─────────────────────────────────────────────────────────────┤
│  Services   │  Security     │  i18n       │  Utils          │
├─────────────────────────────────────────────────────────────┤
│        Firebase  │  Notifications  │  BLE Mesh             │
├─────────────────────────────────────────────────────────────┤
│                  React Native / Expo                        │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Core Modules

### 1. Notifications Module (`services/notifications/`)

Modüler bildirim sistemi:

| Dosya | Sorumluluk |
|-------|------------|
| `NotificationModuleLoader.ts` | Dinamik expo-notifications yükleme |
| `NotificationChannelManager.ts` | Android kanal yönetimi |
| `NotificationScheduler.ts` | Bildirim zamanlama |
| `NotificationPermissionHandler.ts` | İzin yönetimi |
| `index.ts` | Re-exports |

### 2. EEW Module (`services/eew/`)

Erken Deprem Uyarı sistemi:

| Dosya | Sorumluluk |
|-------|------------|
| `EEWWebSocketManager.ts` | WebSocket bağlantı yönetimi |
| `EEWPoller.ts` | AFAD API polling |
| `EEWEventProcessor.ts` | Olay normalizasyonu |
| `index.ts` | Re-exports |

### 3. Security Module (`security/`)

Güvenlik ve şifreleme:

| Dosya | Sorumluluk |
|-------|------------|
| `SecureKeyManager.ts` | API key ve token yönetimi |
| `NativeSecurity.ts` | Platform güvenlik özellikleri |

### 4. i18n Module (`i18n/`)

Çoklu dil desteği:

| Dosya | Sorumluluk |
|-------|------------|
| `index.ts` | i18n servisi |
| `locales/tr.json` | Türkçe çeviriler |
| `locales/en.json` | İngilizce çeviriler |

## 🔄 State Management

Zustand ile merkezi state yönetimi:

```
┌────────────────┬────────────────┬────────────────┐
│ earthquakeStore│  premiumStore  │   trialStore   │
├────────────────┼────────────────┼────────────────┤
│   authStore    │  locationStore │ settingsStore  │
├────────────────┼────────────────┼────────────────┤
│   familyStore  │   safetyStore  │   eewStore     │
└────────────────┴────────────────┴────────────────┘
```

### Store Dependency Graph

```
premiumStore ←──┐
                │ (circular dependency prevention)
trialStore ─────┘
  │
  └── syncPremiumAccess() uses dynamic require()
```

## 🔒 Security Architecture

### API Key Management

```
┌──────────────────┐     ┌──────────────────┐
│  EAS Secrets     │────▶│  Constants.extra │
│  (Build Time)    │     │                  │
└──────────────────┘     └────────┬─────────┘
                                  │
                                  ▼
┌──────────────────┐     ┌──────────────────┐
│  process.env     │────▶│  SecureKeyManager│
│  (Runtime)       │     │  (Encrypted)     │
└──────────────────┘     └──────────────────┘
```

### Secure Storage

- **SecureStore**: Platform-native encryption (Keychain/Keystore)
- **Memory Fallback**: For simulator/emulator

## 📡 Network Architecture

### Data Sources

| Source | Type | Data |
|--------|------|------|
| AFAD | REST API | Türkiye depremleri |
| USGS | REST API | Global depremler |
| EMSC | REST API | Avrupa depremleri |
| P2PQuake | WebSocket | Japonya EEW |

### Polling Strategy

```
┌─────────────────────────────────────────┐
│            Network Monitor              │
│  ┌─────────────────────────────────┐    │
│  │  Online? ──▶ Poll every 15s    │    │
│  │  Offline? ──▶ Read from cache  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## 🧪 Test Architecture

### Test Setup

```
src/test/
├── setup.ts              # Global mocks
├── mocks/
│   └── reanimated.js     # Reanimated mock
└── ...
```

### Test Coverage Targets

| Module | Target |
|--------|--------|
| Services | 80% |
| Stores | 90% |
| Utils | 95% |

## 📱 Platform-Specific

### Android

- **Notification Channels**: 6 predefined channels
- **Background Location**: Foreground service
- **Firebase Cloud Messaging**: Push notifications

### iOS

- **Critical Alerts**: Emergency notifications
- **Background Modes**: Location updates
- **APNs**: Push notifications

## 🧹 Code Quality

### ESLint Rules

- `react-hooks/exhaustive-deps`: Documented exceptions only
- `@typescript-eslint/no-require-imports`: For circular dependency prevention

### TypeScript Config

- **Strict Mode**: Disabled (gradual migration)
- **noImplicitAny**: Disabled

## 🔮 Future Improvements

1. **Full TypeScript Strict Mode**
2. **Unit Test Coverage > 80%**
3. **E2E Tests with Detox**
4. **API Rate Limiting**
5. **Offline-First Architecture**

---

*Güncelleme: 2026-02-01*
