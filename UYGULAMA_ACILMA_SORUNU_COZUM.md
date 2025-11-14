# 🔧 UYGULAMA AÇILMA SORUNU - ÇÖZÜM REHBERİ

**Tarih:** 2024-12-19  
**Durum:** 🔍 İnceleniyor - Build başarılı ama uygulama açılmıyor

---

## 🚨 SORUN

### Durum
- ✅ Build başarılı oldu
- ✅ Simulator'a kuruldu
- ✅ "Successfully launched your app!" mesajı geldi
- ❌ **Ama uygulama açılmadı**

### Olası Nedenler

1. **Crash on Launch:**
   - Uygulama başlatılırken crash oluyor olabilir
   - Native modül sorunları
   - Initialization hataları

2. **Simulator Sorunları:**
   - Simulator donmuş olabilir
   - Uygulama arka planda crash oluyor

3. **Native Bridge Sorunları:**
   - React Native bridge başlatılamıyor
   - Native modül yüklenemiyor

4. **Permission Sorunları:**
   - İzinler verilmemiş
   - Uygulama başlatılamıyor

---

## 🔍 TESPİT ADIMLARI

### 1. Simulator Loglarını Kontrol

```bash
# Son crash loglarını görüntüle
xcrun simctl spawn booted log show --predicate 'processImagePath contains "AfetNet"' --last 2m

# Crash loglarını kontrol
xcrun simctl spawn booted log show --predicate 'eventMessage contains "crash" OR eventMessage contains "error"' --last 5m
```

### 2. Uygulama Durumunu Kontrol

```bash
# Simulator'da kurulu uygulamaları listele
xcrun simctl listapps booted | grep -i afetnet

# Uygulamayı yeniden başlat
xcrun simctl launch booted com.gokhancamci.afetnetapp
```

### 3. Expo Doctor Kontrolü

```bash
# Expo yapılandırmasını kontrol et
npx expo-doctor
```

### 4. Metro Bundler Kontrolü

```bash
# Metro bundler çalışıyor mu?
npx expo start --dev-client
```

---

## ✅ ÇÖZÜM ADIMLARI

### Adım 1: Simulator'ı Yeniden Başlat

```bash
# Tüm simulator'ları kapat
killall Simulator

# Simulator'ı yeniden aç
open -a Simulator
```

### Adım 2: Uygulamayı Yeniden Kur

```bash
# Build'i yeniden al (simulator için)
eas build --platform ios --profile development --clear-cache

# Veya yerel build
npx expo run:ios
```

### Adım 3: Metro Bundler ile Bağlan

```bash
# Metro bundler başlat
npx expo start --dev-client

# Simulator'da uygulamayı aç
# Metro bundler otomatik bağlanacak
```

### Adım 4: Crash Loglarını İncele

```bash
# Crash loglarını görüntüle
xcrun simctl spawn booted log show --predicate 'processImagePath contains "AfetNet"' --last 10m --style syslog | grep -i "error\|crash\|exception" -A 5
```

---

## 🐛 YAYGIN SORUNLAR VE ÇÖZÜMLERİ

### Sorun 1: Native Modül Yüklenemiyor

**Belirtiler:**
- Uygulama açılmıyor
- Native modül hataları

**Çözüm:**
```bash
# Pod'ları yeniden yükle
cd ios
pod deintegrate
pod install
cd ..
```

### Sorun 2: Metro Bundler Bağlanamıyor

**Belirtiler:**
- Uygulama açılıyor ama beyaz ekran
- Metro bundler bağlantı hatası

**Çözüm:**
```bash
# Metro bundler'ı temiz başlat
npx expo start --dev-client --clear

# Simulator'da uygulamayı yeniden aç
```

### Sorun 3: Initialization Hatası

**Belirtiler:**
- Uygulama başlatılıyor ama crash oluyor
- init.ts'de hata

**Çözüm:**
- `src/core/init.ts` dosyasını kontrol et
- Error boundary'lerin çalıştığından emin ol
- Lazy loading modüllerini kontrol et

### Sorun 4: Permission Sorunları

**Belirtiler:**
- Uygulama açılıyor ama özellikler çalışmıyor
- Permission denied hataları

**Çözüm:**
- Simulator Settings → Privacy & Security
- Gerekli izinleri manuel ver
- Uygulamayı yeniden başlat

---

## 📋 CHECKLIST

- [ ] Simulator loglarını kontrol ettim
- [ ] Crash loglarını inceledim
- [ ] Uygulama durumunu kontrol ettim
- [ ] Expo doctor çalıştırdım
- [ ] Metro bundler bağlantısını kontrol ettim
- [ ] Simulator'ı yeniden başlattım
- [ ] Uygulamayı yeniden kurdum

---

## 🚀 HIZLI ÇÖZÜM

### En Hızlı Yol

```bash
# 1. Simulator'ı kapat ve yeniden aç
killall Simulator && open -a Simulator

# 2. Metro bundler başlat
npx expo start --dev-client --clear

# 3. Simulator'da uygulamayı aç
# Metro bundler otomatik bağlanacak
```

### Alternatif: Yerel Build

```bash
# Yerel build (daha hızlı debug)
npx expo run:ios

# Bu komut:
# - Pod'ları yükler
# - Native build yapar
# - Simulator'da açar
# - Metro bundler bağlar
```

---

## 📝 NOTLAR

- **Development Build:** Metro bundler ile bağlanmalı
- **Crash Logları:** Simulator loglarında görünecek
- **Native Modüller:** Pod'lar doğru yüklenmeli
- **Metro Bundler:** Çalışıyor olmalı

---

**Sorun devam ederse crash loglarını paylaşın!** 🔍









