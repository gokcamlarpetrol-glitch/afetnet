# AfetNet - Hayat Kurtaran Acil Durum Uygulaması

## 🚨 Önemli Bilgi

Bu uygulama **hayat kurtarmak** için tasarlanmıştır. Afet durumlarında offline iletişim sağlar.

## 🎯 Özellikler

### FREE Özellikler
- ✅ **Deprem Bildirimleri** - AFAD ve USGS'den gerçek zamanlı deprem verileri
- ✅ **SOS Butonu** - BLE mesh üzerinden acil durum sinyali
- ✅ **Offline Çalışma** - İnternet olmadan peer-to-peer iletişim
- ✅ **BLE Mesh Networking** - Yakındaki cihazlarla otomatik bağlantı

### PREMIUM Özellikler
- 🗺️ **Harita** - Deprem ve aile üyesi konumları
- 👨‍👩‍👧‍👦 **Aile Takibi** - Aile üyelerinizin durumunu görün
- 💬 **Offline Mesajlaşma** - BLE mesh ile mesajlaşma
- 📍 **Konum Paylaşımı** - Konumunuzu otomatik paylaşın

## 🚀 Kurulum

### 1. Gereksinimler

- Node.js >= 18.0.0
- npm >= 10.7.0
- Expo CLI
- iOS: Xcode 14+ (macOS)
- Android: Android Studio

### 2. Proje Kurulumu

```bash
# Projeyi klonla
git clone https://github.com/gokhancamci/AfetNet1.git
cd AfetNet1

# Bağımlılıkları yükle
npm install

# Environment dosyası oluştur
cp .env.example .env
```

### 3. Environment Variables

`.env` dosyasını düzenle ve gerekli değerleri ekle:

```env
# RevenueCat API Keys (ZORUNLU)
RC_IOS_KEY=appl_YOUR_IOS_API_KEY_HERE
RC_ANDROID_KEY=goog_YOUR_ANDROID_API_KEY_HERE

# EAS Project ID
EAS_PROJECT_ID=072f1217-172a-40ce-af23-3fc0ad3f7f09
```

**RevenueCat API Keys nasıl alınır:**
1. https://app.revenuecat.com adresine git
2. Settings → API Keys
3. iOS ve Android key'lerini kopyala

### 4. Çalıştırma

```bash
# Development mode
npm run start:dev

# iOS simulator
npm run ios

# Android emulator
npm run android
```

## 📱 Build

### iOS

```bash
# Production build
npm run ios:release

# EAS build
eas build -p ios --profile production
```

### Android

```bash
# Production build
npm run build:android

# EAS build
eas build -p android --profile production
```

## 🏗️ Mimari

### Yeni Core Yapısı

```
src/core/
├── stores/          # 5 basit Zustand store
├── services/        # 6 temiz servis
├── screens/         # 6 ekran
├── components/      # PremiumGate
├── navigation/      # MainTabs
├── config/          # App ve Firebase config
├── utils/           # Utilities
├── init.ts          # Tek initialization
└── App.tsx          # Entry point
```

### Servisler

1. **EarthquakeService** - AFAD/USGS polling, cache
2. **BLEMeshService** - Offline peer-to-peer
3. **NotificationService** - Push notifications
4. **PremiumService** - RevenueCat IAP
5. **FirebaseService** - FCM token
6. **LocationService** - GPS tracking

## 🔐 Güvenlik

- ✅ RevenueCat API keys environment variables'da
- ✅ Firebase config ayrı dosyada
- ✅ Device ID secure storage'da
- ✅ `.env` dosyası `.gitignore`'da
- ✅ End-to-end encryption hazır (src/crypto/)

## 🧪 Test

```bash
# TypeScript check
npm run typecheck

# ESLint
npm run lint

# Unit tests
npm run test

# Health check
npm run healthcheck
```

## 📦 RevenueCat Setup

### 1. Products Oluştur

RevenueCat Dashboard → Products:

- **Monthly**: `org.afetapp.premium.monthly`
- **Yearly**: `org.afetapp.premium.yearly`
- **Lifetime**: `org.afetapp.premium.lifetime`

### 2. Entitlement Oluştur

RevenueCat Dashboard → Entitlements:

- **Name**: `Premium`
- **Products**: Yukarıdaki 3 product'ı ekle

### 3. App Store Connect / Google Play

- iOS: App Store Connect'te In-App Purchases oluştur
- Android: Google Play Console'da Products oluştur
- RevenueCat'e bağla

## 🌍 Offline Özellikler

### BLE Mesh Networking

- **Peer Discovery**: Otomatik cihaz keşfi
- **Message Relay**: Hop-by-hop mesaj iletimi
- **SOS Broadcast**: Acil durum sinyali yayını
- **Offline Sync**: Mesaj kuyruğu ve retry

### Offline Çalışma

- Deprem verileri cache'leniyor
- Mesajlar queue'da bekliyor
- BLE mesh internet olmadan çalışıyor
- Location tracking offline çalışıyor

## 📖 Dokümantasyon

- [Core Rewrite Summary](CORE_REWRITE_SUMMARY.md)
- [Integration Complete](INTEGRATION_COMPLETE.md)
- [Privacy Policy](https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html)
- [Terms of Service](https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html)

## 🐛 Troubleshooting

### "Maximum call stack size exceeded"

✅ **Çözüldü!** Yeni core yapısı bu hatayı tamamen ortadan kaldırdı.

### RevenueCat "API key not found"

`.env` dosyasında `RC_IOS_KEY` ve `RC_ANDROID_KEY` değerlerini kontrol et.

### BLE permissions denied

iOS: Info.plist'te `NSBluetoothAlwaysUsageDescription` tanımlı
Android: AndroidManifest.xml'de `BLUETOOTH_SCAN` ve `BLUETOOTH_CONNECT` tanımlı

### Location permissions denied

iOS: Info.plist'te location permissions tanımlı
Android: AndroidManifest.xml'de location permissions tanımlı

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'feat: add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📝 Lisans

ISC License - AfetNet Team

## 📧 İletişim

- **Support**: support@afetnet.app
- **Owner**: gokhancamci1
- **GitHub**: https://github.com/gokhancamci/AfetNet1

## 🙏 Teşekkürler

Bu uygulama hayat kurtarmak için yapılmıştır. Katkıda bulunan herkese teşekkürler.

---

**⚠️ Önemli:** Bu uygulama acil durumlarda kullanılmak üzere tasarlanmıştır. Resmi acil durum servislerinin (112, 110, vb.) yerini tutmaz.

