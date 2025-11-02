ve # AfetNet - Cihazda Test Komutları

## 📱 Cihazda Test Etmek İçin

AfetNet, **expo-dev-client** kullanıyor (native modüller için gerekli). Bu yüzden **Expo Go** çalışmaz, development build kurmanız gerekir.

---

## 🚀 HIZLI BAŞLANGIÇ

### **Adım 1: Development Build Oluştur**

Önce development build'i cihazınıza kurmalısınız:

#### **Android için:**
```bash
# EAS Build ile development build oluştur (Cloud'ta build eder)
npm run build:android

# VEYA lokal olarak build et
npm run android
```

#### **iOS için:**
```bash
# EAS Build ile development build oluştur (Cloud'ta build eder)
npm run build:ios

# VEYA lokal olarak build et
npm run ios
```

---

### **Adım 2: Development Server Başlat**

Build kurulduktan sonra, bu komutlardan birini kullan:

#### **Seçenek 1: Tunnel (En İyi - Her Yerden Çalışır)**
```bash
npm run start:dev
```
- ✅ Mobil veri bile kullanır
- ✅ Ngrok tunnel üzerinden
- ⚠️ İlk başlatma biraz yavaş olabilir

#### **Seçenek 2: LAN (Aynı WiFi'de)**
```bash
npm run start:lan
```
- ✅ Aynı WiFi ağında daha hızlı
- ❌ Mobil veri ile çalışmaz
- ⚠️ Router/network ayarlarına bağlı

#### **Seçenek 3: Basit Expo Start**
```bash
npm start
```
- QR kod gösterir
- Seçenekleri manuel seçersiniz

---

## 📋 DETAYLI KOMUTLAR

### **Android Cihazda Test:**

```bash
# 1. Build oluştur ve kur
npm run android

# 2. Development server başlat
npm run start:dev
```

Veya tek seferde:
```bash
# Tunnel ile
npm run start:dev

# QR kod okut (cihazdan Expo Go değil, development build aç)
```

### **iOS Cihazda Test (EAS Build ile):**

```bash
# 1. EAS Build ile development build oluştur (Cloud'ta build eder)
eas build --platform ios --profile development

# Build tamamlandıktan sonra:
# - Terminal'de build linki görünecek
# - Linki iOS cihazınızda Safari ile açın
# - Build'i cihazınıza kurun

# 2. Development server başlat (LAN modu - aynı WiFi'de olmalısınız)
npm run start:lan

# 3. iOS cihazda development build uygulamasını açın
# 4. QR kodu tarayın veya manuel olarak bağlanın
```

**Not:** Tunnel hatası alıyorsanız, LAN modu kullanın. Telefon ve bilgisayar aynı WiFi ağında olmalıdır.

---

## 🛠️ EĞER HATA ALIRSANIZ

### **"Expo Go" hatası:**
❌ `npm start` → Expo Go'ya yükler (native modüller çalışmaz!)
✅ `npm run start:dev` → Development build kullanır (native modüller çalışır)

### **"Metro bundler" hatası:**
```bash
# Cache temizle ve tekrar başlat
npx expo start --clear
```

### **"Network" hatası:**
```bash
# Tunnel kullan (mobil veri bile çalışır)
npm run start:dev
```

### **"Build" hatası:**
```bash
# Önce temiz build yap
cd android && ./gradlew clean && cd ..
npm run android
```

---

## 🎯 ÖNERİLEN AKIŞ

### **İlk Defa Cihazda Test:**

```bash
# 1. Kod kalitesini kontrol et
npm run typecheck && npm run lint

# 2. Android için build oluştur ve kur
npm run android

# 3. Development server başlat (tunnel)
npm run start:dev

# 4. Android cihazda development build aç
# 5. QR kod okut veya manuel olarak bağlan
```

### **Sonraki Testler (Build Zaten Kurulu):**

```bash
# Sadece development server başlat
npm run start:dev

# Cihazda development build'i aç
# Otomatik olarak bağlanır
```

---

## 🔍 BUILD KONTROL

### **Mevcut Build Kontrol:**

```bash
# iOS için
eas build:list --platform ios

# Android için
eas build:list --platform android
```

### **Development Build İndir:**

```bash
# iOS
eas build:list --platform ios --profile development

# Android
eas build:list --platform android --profile development
```

---

## 📊 TEST CHECKLIST

Development server başladıktan sonra şunları kontrol edin:

✅ Uygulama açılıyor mu?
✅ Ana ekran görünüyor mu? (AfetNet başlığı)
✅ Deprem listesi geliyor mu?
✅ BLE mesh bağlantısı var mı?
✅ Harita ekranı açılıyor mu?
✅ Aile ekranı açılıyor mu?
✅ Mesajlaşma çalışıyor mu?
✅ Ayarlar ekranı açılıyor mu?

---

## 🆘 HATA ÇÖZÜMLERİ

### **Import Error:**
```bash
# Dependencies'i yeniden yükle
rm -rf node_modules
npm install
```

### **TypeScript Error:**
```bash
# Type check yap
npm run typecheck
```

### **Metro Error:**
```bash
# Cache temizle
npx expo start --clear
```

### **Build Error:**
```bash
# EAS build kullan (cloud'ta)
eas build --profile development --platform android
```

---

## 🎉 BAŞARILI!

Test başladığında şunları göreceksiniz:

```
Metro waiting on exp://...
Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press j │ open debugger
› Press o │ open project code in your editor
```

---

## 📝 ÖNEMLİ NOTLAR

1. **Development Build Şart:** Expo Go **ÇALIŞMAZ**, development build kurmalısınız
2. **Tunnel Önerilir:** Mobil veri kullanacaksanız `--host tunnel` kullanın
3. **İlk Build:** İlk build biraz zaman alabilir (10-20 dakika)
4. **Sonraki Başlatmalar:** Build kuruluysa sadece `npm run start:dev` yeterli

---

## 🔗 YARARLI KAYNAKLAR

- [Expo Dev Client Docs](https://docs.expo.dev/clients/getting-started/)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Expo Tunnel](https://docs.expo.dev/guides/tunneling/)

---

## 🏗️ EAS BUILD VE YAYIN SÜRECİ

### **1. Development Build Oluştur (Test İçin)**

```bash
# iOS development build oluştur
eas build --platform ios --profile development

# Build durumunu kontrol et
eas build:list --platform ios --profile development

# Build tamamlandığında linki iOS cihazınızda açın ve kurun
```

### **2. Cihazda Test Et**

```bash
# Development server başlat (LAN modu)
npm run start:lan

# iOS cihazda development build uygulamasını aç
# QR kodu tarayın veya manuel bağlanın
```

### **3. Hataları Tespit Et ve Düzelt**

Test sırasında bulduğunuz hataları:

1. **Kod hatası ise:**
   ```bash
   # TypeScript kontrolü
   npm run typecheck
   
   # Lint kontrolü
   npm run lint
   
   # Hataları düzelt
   # Tekrar test et
   ```

2. **Runtime hatası ise:**
   - Metro bundler loglarını kontrol edin
   - iOS cihazdaki hata mesajlarını not edin
   - Gerekirse debug mode açın: Development build'de shake gesture → "Debug"

3. **UI/UX sorunları:**
   - Ekran görüntüleri alın
   - Sorunları dokümante edin
   - Düzeltmeleri uygulayın

### **4. Production Build Oluştur**

Test tamamlandıktan ve tüm hatalar düzeltildikten sonra:

```bash
# Önce production için kod kalitesi kontrolü
npm run typecheck && npm run lint

# Pre-submit kontrolleri (IAP, validasyon, vb.)
npm run pre-submit

# Production build oluştur
npm run ios:release
# VEYA
eas build --platform ios --profile production

# Build durumunu kontrol et
eas build:list --platform ios --profile production
```

### **5. App Store'a Yayınla**

Production build tamamlandıktan sonra:

```bash
# App Store'a submit et
eas submit --platform ios --profile production

# Submit durumunu kontrol et
eas submit:list --platform ios
```

**Yayın Öncesi Kontrol Listesi:**

- [ ] Tüm testler geçti (development build'de)
- [ ] TypeScript hataları yok (`npm run typecheck`)
- [ ] Lint hataları yok (`npm run lint`)
- [ ] Pre-submit kontrolleri geçti (`npm run pre-submit`)
- [ ] App Store yönergelerine uygun (permissions, privacy, vb.)
- [ ] Versiyon numarası güncellendi (`app.config.ts`)
- [ ] Build numarası artırıldı (otomatik `autoIncrement`)

### **6. İzleme ve Güncellemeler**

```bash
# Build geçmişini görüntüle
eas build:list --platform ios

# Submit geçmişini görüntüle
eas submit:list --platform ios

# App Store Connect'te inceleme durumunu takip edin
```

---

## 🔧 TUNNEL HATASI ÇÖZÜMÜ

Eğer `npm run start:dev` komutunda tunnel hatası alıyorsanız:

```bash
# LAN modunu kullanın (aynı WiFi ağında)
npm run start:lan

# VEYA basit Expo start (manuel seçim)
npm start
# Ardından terminal'de 'l' tuşuna basarak LAN'ı seçin
```

**LAN Modu Gereksinimleri:**
- ✅ Bilgisayar ve iOS cihaz aynı WiFi ağında olmalı
- ✅ Firewall/router ayarları bağlantıya izin vermeli
- ✅ iOS cihazda development build kurulu olmalı

---

**Sorun mu var?** Yukarıdaki hata çözümlerine bakın veya `npm run healthcheck` çalıştırın.


