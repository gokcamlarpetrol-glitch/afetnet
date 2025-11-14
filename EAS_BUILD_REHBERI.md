# 📱 EAS BUILD REHBERİ - Telefonda Test

**Tarih:** 2024-12-19  
**Durum:** ✅ Hazır

---

## 🎯 BUILD ÖNCESİ KONTROLLER

### ✅ Hazır Olanlar
- ✅ EAS CLI kurulu (v16.26.0)
- ✅ EAS Project ID: `072f1217-172a-40ce-af23-3fc0ad3f7f09`
- ✅ `eas.json` yapılandırması mevcut
- ✅ `app.config.ts` hazır
- ✅ Build scriptleri tanımlı
- ✅ TypeScript hataları: 0
- ✅ ESLint hataları: 0

---

## 📋 BUILD ADIMLARI

### 1️⃣ Giriş Yapma (Eğer giriş yapmadıysanız)

```bash
eas login
```

### 2️⃣ iOS Build (iPhone için)

#### Development Build (Test için önerilen)
```bash
eas build --platform ios --profile development
```

#### Production Build (App Store için)
```bash
npm run ios:release
# veya
eas build --platform ios --profile production
```

### 3️⃣ Android Build (Android telefon için)

#### Development Build (Test için önerilen)
```bash
eas build --platform android --profile development
```

#### Production Build (Play Store için)
```bash
npm run build:android
# veya
eas build --platform android --profile production
```

### 4️⃣ Her İki Platform İçin (iOS + Android)

```bash
eas build --platform all --profile development
```

---

## 🔧 BUILD PROFİLLERİ

### Development Profile
- ✅ Development client içerir
- ✅ Debug modu aktif
- ✅ Hot reload çalışır
- ✅ Test için idealdir

### Production Profile
- ✅ Release build
- ✅ Optimize edilmiş
- ✅ App Store / Play Store için hazır
- ✅ Production API'ler kullanılır

---

## 📥 BUILD İNDİRME VE KURULUM

### iOS (iPhone)

1. **Build tamamlandıktan sonra:**
   ```bash
   eas build:list
   ```

2. **QR kod ile indirme:**
   - Build tamamlandığında QR kod gösterilir
   - iPhone kamerası ile QR kodu tarayın
   - TestFlight veya direkt indirme linki açılır

3. **Manuel indirme:**
   - [EAS Build Dashboard](https://expo.dev/accounts/gokhancamci1/projects/afetnet/builds) üzerinden indirin
   - `.ipa` dosyasını indirin
   - TestFlight'a yükleyin veya direkt kurun

### Android

1. **Build tamamlandıktan sonra:**
   ```bash
   eas build:list
   ```

2. **QR kod ile indirme:**
   - Build tamamlandığında QR kod gösterilir
   - Android telefon kamerası ile QR kodu tarayın
   - APK indirme linki açılır

3. **Manuel indirme:**
   - [EAS Build Dashboard](https://expo.dev/accounts/gokhancamci1/projects/afetnet/builds) üzerinden indirin
   - `.apk` veya `.aab` dosyasını indirin
   - Telefona transfer edip kurun

---

## 🧪 TEST SENARYOLARI

### ✅ Test Edilmesi Gerekenler

#### 1. Uygulama Başlatma
- [ ] Uygulama açılıyor mu?
- [ ] Splash screen görünüyor mu?
- [ ] Ana ekran yükleniyor mu?

#### 2. Deprem Özellikleri
- [ ] Deprem listesi görünüyor mu?
- [ ] Deprem detayları açılıyor mu?
- [ ] Bildirimler geliyor mu?
- [ ] Harita üzerinde depremler görünüyor mu?

#### 3. Harita Özellikleri
- [ ] Harita açılıyor mu?
- [ ] Konum izni isteniyor mu?
- [ ] Marker'lar görünüyor mu?
- [ ] Offline harita çalışıyor mu?

#### 4. Aile Özellikleri
- [ ] Aile üyesi eklenebiliyor mu?
- [ ] Konum paylaşımı çalışıyor mu?
- [ ] Grup sohbeti çalışıyor mu?

#### 5. Mesajlaşma
- [ ] Mesaj gönderilebiliyor mu?
- [ ] Mesaj alınabiliyor mu?
- [ ] BLE Mesh çalışıyor mu?

#### 6. SOS Özellikleri
- [ ] SOS butonu çalışıyor mu?
- [ ] BLE broadcast çalışıyor mu?
- [ ] Konum paylaşımı çalışıyor mu?

#### 7. Bildirimler
- [ ] Push bildirimleri geliyor mu?
- [ ] Deprem bildirimleri çalışıyor mu?
- [ ] Multi-channel alerts çalışıyor mu?

#### 8. Offline Özellikler
- [ ] Offline mod çalışıyor mu?
- [ ] BLE Mesh offline çalışıyor mu?
- [ ] Cache çalışıyor mu?

#### 9. AI Özellikleri
- [ ] Risk skoru hesaplanıyor mu?
- [ ] Hazırlık planı oluşturuluyor mu?
- [ ] Panik asistanı çalışıyor mu?

#### 10. Ayarlar
- [ ] Ayarlar ekranı açılıyor mu?
- [ ] Bildirim ayarları çalışıyor mu?
- [ ] Harita ayarları çalışıyor mu?

---

## ⚠️ ÖNEMLİ NOTLAR

### iOS Build İçin
- ✅ Apple Developer hesabı gerekli
- ✅ Provisioning profile gerekli
- ✅ Certificate gerekli
- ✅ EAS otomatik olarak yönetir (ilk build'de sorar)

### Android Build İçin
- ✅ Google Play Console hesabı (production için)
- ✅ Keystore otomatik oluşturulur (ilk build'de)
- ✅ APK direkt kurulabilir (development build)

### Development Build vs Production Build

**Development Build:**
- ✅ `expo-dev-client` içerir
- ✅ Metro bundler ile bağlanabilir
- ✅ Hot reload çalışır
- ✅ Debug modu aktif
- ⚠️ Daha büyük dosya boyutu

**Production Build:**
- ✅ Optimize edilmiş
- ✅ Küçük dosya boyutu
- ✅ Production API'ler
- ⚠️ Hot reload yok
- ⚠️ Debug modu kapalı

---

## 🚀 HIZLI BAŞLANGIÇ

### İlk Build (Development - Test için)

```bash
# iOS için
eas build --platform ios --profile development

# Android için
eas build --platform android --profile development

# Her ikisi için
eas build --platform all --profile development
```

### Build Durumunu Kontrol Etme

```bash
# Tüm build'leri listele
eas build:list

# Belirli bir build'i görüntüle
eas build:view [BUILD_ID]
```

### Build Loglarını İnceleme

```bash
eas build:view [BUILD_ID] --logs
```

---

## 📊 BUILD SÜRESİ

- **iOS Development Build:** ~15-20 dakika
- **iOS Production Build:** ~20-25 dakika
- **Android Development Build:** ~10-15 dakika
- **Android Production Build:** ~15-20 dakika

---

## 🐛 SORUN GİDERME

### Build Başarısız Olursa

1. **Logları kontrol edin:**
   ```bash
   eas build:view [BUILD_ID] --logs
   ```

2. **Yapılandırmayı kontrol edin:**
   - `eas.json` dosyasını kontrol edin
   - `app.config.ts` dosyasını kontrol edin
   - Environment variables kontrol edin

3. **Dependencies kontrol edin:**
   ```bash
   npm install
   npm run typecheck
   npm run lint
   ```

### Build Çok Uzun Sürerse

- ✅ Normal, ilk build daha uzun sürer
- ✅ Sonraki build'ler daha hızlı olur (cache sayesinde)
- ✅ Build queue'da bekleyebilir (yoğun saatlerde)

---

## ✅ BUILD ÖNCESİ CHECKLIST

- [ ] TypeScript hataları yok (`npm run typecheck`)
- [ ] ESLint hataları yok (`npm run lint`)
- [ ] Tüm testler geçti (`npm test`)
- [ ] Environment variables ayarlandı
- [ ] `app.config.ts` güncel
- [ ] `eas.json` yapılandırması doğru
- [ ] EAS CLI güncel (`eas update`)
- [ ] EAS'a giriş yapıldı (`eas login`)

---

## 🎯 SONRAKI ADIMLAR

1. ✅ Development build alın
2. ✅ Telefona kurun
3. ✅ Tüm özellikleri test edin
4. ✅ Hataları düzeltin
5. ✅ Production build alın
6. ✅ App Store / Play Store'a yükleyin

---

**Hazır! Build almaya başlayabilirsiniz!** 🚀📱









