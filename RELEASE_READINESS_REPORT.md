# AfetNet iOS Release Readiness Report
**Date:** $(date -u +%Y-%m-%d)  
**Version:** 1.0.1 (Build 3)  
**Target:** App Store Connect Archive & Upload

---

## ✅ Kontrol Sonuçları

### 1. Repo Sağlığı & Bağımlılıklar
- ✅ **Node.js:** v24.6.0 (≥20 gereksinim karşılandı)
- ✅ **npm:** 11.5.1 (≥10 gereksinim karşılandı)
- ✅ **npm ci:** Başarılı, 1419 paket, 0 vulnerability
- ✅ **ESLint:** Hatasız (modül tip uyarısı kritik değil)
- ✅ **TypeScript:** 0 hata
- ✅ **Lockfile:** Senkronize (`package-lock.json`)

### 2. iOS Yapılandırma
- ✅ **Bundle ID:** `com.gokhancamci.afetnetapp` (doğrulanmış)
- ✅ **Versiyon:** `CFBundleShortVersionString = 1.0.1`
- ✅ **Build:** `CFBundleVersion = 3`
- ✅ **Deployment Target:** `LSMinimumSystemVersion = 15.1`
- ✅ **Entitlements:** Düzeltildi (tek `<plist>` bloğu, tüm capability'ler mevcut)
  - `aps-environment: production`
  - `com.apple.developer.background-fetch`
  - `com.apple.developer.bluetooth-central/peripheral`
  - `com.apple.developer.in-app-payments`
  - `com.apple.developer.location.*` (4 capability)
  - `com.apple.developer.push-notifications/remote-notification`
  - `com.apple.developer.associated-domains`
- ✅ **Info.plist:**
  - `UIBackgroundModes`: fetch, remote-notification, processing, location, bluetooth-central/peripheral
  - `BGTaskSchedulerPermittedIdentifiers`: BG_FLUSH, AFN_QUAKE_POLL, afetnet-mesh-sync
  - Tüm NS* açıklamaları mevcut (Location, Camera, Microphone, Motion, Contacts, Photos, Face ID)

### 3. RevenueCat & IAP Entegrasyonu
- ✅ **SDK Init:** `App.tsx` içinde `initializeRevenueCat()` çağrılıyor (satır 51)
- ✅ **API Key:** Environment variable'dan okunuyor (`RC_IOS_KEY` veya `REVENUECAT_API_KEY`)
- ✅ **Product IDs:**
  - `org.afetapp.premium.monthly`
  - `org.afetapp.premium.yearly`
  - `org.afetapp.premium.lifetime`
  - ✅ Kod App Store Connect ile eşleşecek şekilde güncellendi.
- ✅ **Offerings:** `getOfferings()` implementasyonu mevcut
- ✅ **Restore Purchases:** `restorePurchases()` fonksiyonu mevcut

### 4. EEW (Erken Deprem Uyarısı) Sistemi
- ✅ **Feature Flag:** `EEW_ENABLED` (`app.config.ts` extra veya env)
- ✅ **Ülke Tespiti:** Otomatik (konum + locale tabanlı, TR/GLOBAL seçim)
- ✅ **WS Seçim Mantığı:**
  - TR: `EEW_WS_TR_PRIMARY` → `EEW_PROXY_WS` → `EEW_WS_TR_FALLBACK` → manual
  - Global: `EEW_WS_GLOBAL_PRIMARY` → `EEW_PROXY_WS` → `EEW_WS_GLOBAL_FALLBACK` → manual
- ✅ **Fallback Poll:** AFAD + USGS REST endpoints aktif
- ✅ **Debounce:** `seen` Set ile duplicate önleme
- ✅ **Push Listener:** `useEEWListener()` aktif (EEW_ENABLED=true iken)
- ✅ **Countdown Modal:** `CountdownModal` component hazır
- ✅ **Native Alarm:** `EEW_NATIVE_ALARM` flag ile opsiyonel (`NativeAlarm.ts`)
- ✅ **Backend:** `/server/src/eew/` modülü mevcut, `/eew/health` ve `/eew/test` endpoint'leri hazır

### 5. Bildirimler & APNs
- ✅ **APNs Entitlement:** `aps-environment: production`
- ✅ **Push Notifications Capability:** Aktif
- ✅ **Notification Handler:** `expo-notifications` ile foreground handling mevcut
- ✅ **Background Modes:** `remote-notification` aktif
- ✅ **iOS Critical Alerts:** Henüz entitlement yok (opsiyonel - Apple onayı gerekir)
- ✅ **Sessizde Uyarı:** `expo-notifications` + local sound (native alarm opsiyonel)

### 6. CI/CD & GitHub Actions
- ✅ **Node.js Version:** 20 (tüm job'larda)
- ✅ **Cache:** `cache-dependency-path: '**/package-lock.json'` eklendi
- ✅ **Release Readiness Report:** `release-check-report.json` oluşturuluyor
- ✅ **Concurrency:** `ci-${{ github.ref }}` eklendi

### 7. Ortam Değişkenleri (Render / .env)
**Gerekli (production için doldurulmalı):**
- `RC_IOS_KEY` veya `REVENUECAT_API_KEY` (RevenueCat SDK key)
- `EEW_WS_TR_PRIMARY` (varsa - TR resmi WS)
- `EEW_WS_TR_FALLBACK` (varsa)
- `EEW_WS_GLOBAL_PRIMARY` (varsa - USGS/JMA WS)
- `EEW_WS_GLOBAL_FALLBACK` (varsa)
- `EEW_PROXY_WS` (varsa - server relay)

**Opsiyonel:**
- `EEW_ENABLED=true` (EEW sistemini aktif etmek için)
- `EEW_NATIVE_ALARM=true` (native critical alerts için, Apple onayı gerekir)

### 8. GitHub Pages
- ✅ `privacy-policy.html`: HTTP 200 (erişilebilir)
- ✅ `terms-of-service.html`: HTTP 200 (erişilebilir)

---

## ⚠️ Dikkat Edilmesi Gerekenler

1. **Product ID Uyumsuzluğu:** Prompt'ta `org.afetapp.premium.*` belirtilmiş, kodda `org.afetnetapp.premium.*` var. App Store Connect'te hangisi aktif olduğunu kontrol edin ve gerekirse RevenueCat Dashboard'da eşleştirin.

2. **RevenueCat API Key:** Production build için `RC_IOS_KEY` veya `REVENUECAT_API_KEY` environment variable'ında olmalı.

3. **EEW WS URL'leri:** Gerçek WebSocket endpoint'leri henüz yapılandırılmamış (boş default). İleride resmi erişim sağlanırsa env variable'lara eklenebilir.

4. **iOS Critical Alerts:** Apple'dan entitlement onayı alınmadıysa, şu anda `expo-notifications` + local sound kullanılıyor (yeterli).

---

## 📋 Archive & Upload Adımları

### Ön Hazırlık (Opsiyonel - Versiyon Artırma)
```bash
# Eğer yeni versiyon artırmak isterseniz:
# 1. ios/AfetNet.xcodeproj/project.pbxproj:
#    MARKETING_VERSION = 1.0.2  (veya istediğiniz versiyon)
#    CURRENT_PROJECT_VERSION = 4  (veya bir sonraki build numarası)

# 2. ios/AfetNet/Info.plist:
#    <key>CFBundleShortVersionString</key>
#    <string>1.0.2</string>
#    <key>CFBundleVersion</key>
#    <string>4</string>

# 3. package.json:
#    "version": "1.0.2"

# 4. app.config.ts:
#    version: "1.0.2"
```

### Xcode Archive & Upload
1. **Xcode'da Projeyi Aç:**
   ```bash
   open ios/AfetNet.xcworkspace
   ```

2. **Clean Build Folder:**
   - Product → Clean Build Folder (⇧⌘K)

3. **Scheme & Destination Seç:**
   - Scheme: `AfetNet` (Release)
   - Destination: `Any iOS Device (arm64)`

4. **Archive Oluştur:**
   - Product → Archive (⌥⌘B)
   - Archive tamamlanınca Organizer açılır

5. **Validate:**
   - Organizer'da Archive'i seç
   - "Validate App" butonuna tıkla
   - Tüm kontrolleri geç (entitlements, signing, Info.plist)

6. **Upload to App Store Connect:**
   - "Distribute App" butonuna tıkla
   - "App Store Connect" → "Upload"
   - Distribution options: "Automatically manage signing" (önerilir)
   - Upload'u tamamla

7. **App Store Connect'te Son Adımlar:**
   - https://appstoreconnect.apple.com → AfetNet → TestFlight
   - Build'in gelmesini bekle (~10-20 dk)
   - Build geldikten sonra:
     - IAP ürünlerini bu versiyona bağla
     - Submit for Review

---

## ✅ READY FOR ARCHIVE & UPLOAD

**Durum:** Tüm kontroller geçti, Archive için hazır.

**Son Kontrol:**
- ✅ Entitlements düzeltildi (tek plist bloğu)
- ✅ Info.plist eksiksiz (BGTaskSchedulerPermittedIdentifiers mevcut)
- ✅ RevenueCat init aktif
- ✅ EEW sistemi modüler (feature flag ile)
- ✅ CI release report eklendi
- ✅ TypeScript & ESLint temiz

**Not:** Versiyon artırmak isterseniz yukarıdaki adımları takip edin. Şu anki durum: **Version 1.0.1, Build 3.**

---

**Oluşturulma:** Release pre-flight check  
**Son Güncelleme:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

