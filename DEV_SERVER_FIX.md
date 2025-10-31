# 🔧 Development Build Crash ve Server Bağlantı Sorunu - Çözüm

## 🐛 Sorun

1. **Development build crash ediyor**
2. **"No development servers found" hatası**
3. **Uygulama açılmıyor**

## ✅ Yapılan Düzeltmeler

### 1. App.tsx Initialization Güvenli Hale Getirildi
- Tüm servis başlatmaları try-catch ile korundu
- Hata durumunda uygulama çökmeden devam ediyor
- Her servis bağımsız olarak hata yönetiliyor

### 2. Development Server Bağlantısı

## 📱 Çözüm Adımları

### Adım 1: Expo Dev Server'ı Başlatın

Terminal'de çalıştırın:

```bash
cd /Users/gokhancamci/AfetNet1
npm run start:dev
```

Veya:

```bash
npx expo start --dev-client --clear
```

### Adım 2: Telefon ve Mac Aynı Ağda Olmalı

- Mac ve iPhone **aynı WiFi ağında** olmalı
- Veya tunnel kullanın: `npm run start:dev` (zaten tunnel içeriyor)

### Adım 3: QR Kodu Okutun veya URL Girin

Development build ekranında:
- **QR kod** ile bağlanın, VEYA
- **"Enter URL manually"** butonuna tıklayın
- Terminal'deki URL'yi girin (genellikle `exp://...` formatında)

### Adım 4: Eğer Hala Crash Ediyorsa

1. **Xcode'dan Crash Log'unu kontrol edin:**
   - Window > Devices and Simulators
   - Telefonunuzu seçin
   - "View Device Logs" butonuna tıklayın
   - Son crash log'unu bulun

2. **Alternatif: Simulator'da test edin:**
   ```bash
   npm run ios
   ```
   Bu komut simulator'da çalıştırır ve crash log'ları konsolda görürsünüz.

### Adım 5: Temiz Build

Eğer hala sorun varsa:

```bash
# Temizle ve yeniden build et
cd /Users/gokhancamci/AfetNet1
rm -rf ios/build ~/Library/Developer/Xcode/DerivedData/*
cd ios && pod install && cd ..
npm run ios
```

## 🔍 Crash Nedenleri ve Çözümler

### 1. Native Module Hatası
- **Belirti**: "Module not found" veya native bridge hatası
- **Çözüm**: `pod install` çalıştırın, Xcode'da Clean Build Folder yapın

### 2. Permissions Hatası
- **Belirti**: Location/Bluetooth/Camera permission hatası
- **Çözüm**: Info.plist'teki permission açıklamaları kontrol edin

### 3. Initialization Hatası
- **Belirti**: App.tsx'teki servis başlatma hatası
- **Çözüm**: ✅ Yapıldı - Tüm servisler try-catch ile korundu

### 4. Development Server Bağlantı Hatası
- **Belirti**: "No development servers found"
- **Çözüm**: Expo dev server'ı başlatın (yukarıdaki Adım 1)

## 🚀 Hızlı Test Komutu

```bash
# Terminal 1: Dev server başlat
npm run start:dev

# Terminal 2: Xcode'da build et ve çalıştır
# veya
npm run ios
```

## 📝 Notlar

- Development build için **mutlaka** Expo dev server çalışmalı
- Production build için dev server gerekmez
- Crash log'ları Xcode > Window > Devices and Simulators'da görülebilir
- Simulator'da test etmek daha kolay debug imkanı sağlar

## ✅ Durum

- ✅ App.tsx initialization güvenli
- ✅ Tüm servisler try-catch ile korundu
- ✅ Development server başlatma talimatı hazır
- ⚠️ Dev server'ı başlatmanız gerekiyor


