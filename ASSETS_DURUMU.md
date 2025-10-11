# 📱 AFETNET ASSETS DURUMU RAPORU

**Tarih:** 11 Ekim 2025  
**Durum:** ✅ Tüm Temel Assets Mevcut

---

## ✅ MEVCUT ASSETS

### 🎨 **1. App Icon**
- ✅ **icon.png** (17 KB) - Ana icon
- ✅ **icon-1024.png** (17 KB) - High-res icon
- ✅ **icon.svg** (1.6 KB) - Vektör format
- 📱 **Kullanım:** iOS ve Android app icon
- ✅ **app.config.ts'de tanımlı:** `./assets/icon.png`

### 🎨 **2. Splash Screen**
- ✅ **splash.png** (289 KB) - Ana splash screen
- ✅ **splash-android.png** (191 KB) - Android özel
- ✅ **splash-icon.png** (17 KB) - Splash icon
- ✅ **splash.svg** (3.3 KB) - Vektör format
- 📱 **Kullanım:** Uygulama açılış ekranı
- ✅ **app.config.ts'de tanımlı:** `./assets/splash.png`
- ✅ **Background Color:** #C62828 (Kırmızı)

### 🎨 **3. Adaptive Icon (Android)**
- ✅ **adaptive-icon.png** (17 KB) - Ana adaptive icon
- ✅ **adaptive-icon-foreground.png** (41 KB) - Ön plan
- ✅ **adaptive-icon-background.png** (41 KB) - Arka plan
- 📱 **Kullanım:** Android adaptive icon sistem
- ✅ **app.config.ts'de tanımlı:** 
  - `foregroundImage: ./assets/adaptive-icon-foreground.png`
  - `backgroundColor: #C62828`

### 🎨 **4. Diğer Assets**
- ✅ **favicon.png** (1.5 KB) - Web favicon
- ✅ **silence-2s.mp3** (22 KB) - Ses dosyası
- ✅ **generate_assets.sh** (2.4 KB) - Asset oluşturma scripti
- 📁 **branding/** - Branding dosyaları
- 📁 **assembly/** - Toplanma noktası verileri
- 📁 **tiles/** - Harita tile'ları

---

## 📋 APP.CONFIG.TS YAPILANDIRMASI

### ✅ iOS Yapılandırması
```typescript
icon: "./assets/icon.png"
splash: {
  image: "./assets/splash.png",
  resizeMode: "contain",
  backgroundColor: "#C62828"
}
```

### ✅ Android Yapılandırması
```typescript
adaptiveIcon: {
  foregroundImage: "./assets/adaptive-icon-foreground.png",
  backgroundColor: "#C62828"
}
```

---

## ⚠️ STORE İÇİN GEREKLİ ADDITIONAL ASSETS

### 📱 **Apple App Store (Eksik - Gerekli)**

#### 1. App Icon (iTunes Connect)
- ⚠️ **1024x1024 PNG** (app.config.ts'deki icon yeterli olmalı)
- ✅ Mevcut: `icon-1024.png` (17 KB)

#### 2. Screenshots (Her cihaz tipi için)
- ⚠️ **iPhone 6.7"** (1290x2796) - iPhone 14 Pro Max, 15 Pro Max
- ⚠️ **iPhone 6.5"** (1242x2688) - iPhone 11 Pro Max, 12 Pro Max, 13 Pro Max
- ⚠️ **iPhone 5.5"** (1242x2208) - iPhone 6/7/8 Plus
- ⚠️ **iPad Pro 12.9"** (2048x2732) - iPad Pro
- ⚠️ **iPad Pro 11"** (1668x2388) - iPad Pro 11"
- 📝 **Gerekli:** Minimum 2-8 screenshot (her cihaz tipi için)

---

### 🤖 **Google Play Store (Eksik - Gerekli)**

#### 1. App Icon
- ✅ **512x512 PNG** (adaptive-icon yeterli olmalı)
- ✅ Mevcut: `adaptive-icon.png` (17 KB)

#### 2. Feature Graphic (Önemli!)
- ⚠️ **1024x500 PNG/JPG**
- ❌ **Eksik!** - Google Play'de zorunlu
- 📝 Oluşturulması gereken en önemli asset

#### 3. Screenshots (Her cihaz tipi için)
- ⚠️ **Phone:** 320-3840px (min-max genişlik)
- ⚠️ **7" Tablet:** 320-3840px
- ⚠️ **10" Tablet:** 320-3840px
- 📝 **Gerekli:** Minimum 2-8 screenshot (her cihaz tipi için)

#### 4. Promo Video (Opsiyonel)
- ℹ️ YouTube link

---

## 🎯 SCREENSHOTS NASIL ÇEKİLİR?

### iOS Screenshots (Simulator)
```bash
# iPhone 14 Pro Max simulator'ü başlat
open -a Simulator

# Uygulama içinde screenshot al (Cmd + S)
# veya
xcrun simctl io booted screenshot screenshot.png

# iOS simulator'den otomatik screenshot almak için:
npx expo start --ios
# Simulator açıldıktan sonra Cmd + S ile screenshot al
```

### Android Screenshots (Emulator/Device)
```bash
# Android emulator başlat
emulator -avd Pixel_6_API_33

# Screenshot al
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png

# veya Android Studio > Device File Explorer > screenshot
```

### Alternatif: Professional Screenshots
```bash
# App Store Screenshot Generator kullanarak:
# 1. Screenshots.app (macOS)
# 2. Figma templates
# 3. Previewed.app
# 4. Screenshot Studio
```

---

## 📐 STORE ASSET GEREKSİNİMLERİ ÖZET

### ✅ **Mevcut ve Hazır**
| Asset | iOS | Android | Durum |
|-------|-----|---------|-------|
| App Icon (1024x1024) | ✅ | ✅ | Mevcut |
| Adaptive Icon | N/A | ✅ | Mevcut |
| Splash Screen | ✅ | ✅ | Mevcut |

### ⚠️ **Oluşturulması Gereken**
| Asset | iOS | Android | Öncelik |
|-------|-----|---------|---------|
| Feature Graphic (1024x500) | N/A | ⚠️ Zorunlu | **YÜKSEK** |
| iPhone Screenshots | ⚠️ Zorunlu | N/A | **YÜKSEK** |
| Android Screenshots | N/A | ⚠️ Zorunlu | **YÜKSEK** |
| iPad Screenshots | ⚠️ Önerilen | N/A | ORTA |
| Tablet Screenshots | N/A | ⚠️ Önerilen | ORTA |

---

## 🚀 SCREENSHOT ÜRETİM PLANI

### Adım 1: Uygulamayı Test Cihazlarda Çalıştır
```bash
# iOS
npx expo run:ios --device

# Android
npx expo run:android --device
```

### Adım 2: Critical Screens için Screenshot Al
**Gerekli Ekranlar:**
1. 🏠 **Ana Ekran** - SOS butonu ile
2. 🌍 **Harita Ekranı** - Deprem verileri ile
3. 💬 **Mesajlaşma** - Offline mesaj örneği
4. 👥 **Aile Takibi** - Aile üyeleri harita üzerinde
5. ⚙️ **Ayarlar** - Kapsamlı ayarlar ekranı
6. 🆘 **SOS Ekranı** - Acil durum senaryosu

### Adım 3: Screenshot'ları Düzenle
- Kişisel bilgileri kaldır (telefon, email)
- Demo verilerle doldur
- Yüksek çözünürlük (Retina)
- İyi aydınlatma ve renk dengesi

### Adım 4: Store'a Yükle
- App Store Connect → Screenshots
- Google Play Console → Store listing → Graphics

---

## 🎨 FEATURE GRAPHIC OLUŞTURMA

### Google Play Feature Graphic Gereksinimleri
- **Boyut:** 1024x500 piksel
- **Format:** PNG veya JPG
- **Maksimum Boyut:** 1 MB
- **İçerik:** 
  - AfetNet logosu
  - "Hayat Kurtaran Afet İletişimi" başlığı
  - Anahtar özellik ikonları (SOS, Mesh, Offline)
  - Kırmızı renk teması (#C62828)

### Tasarım Araçları
1. **Canva** - Templates ile hızlı
2. **Figma** - Professional tasarım
3. **Adobe Photoshop** - Full control
4. **GIMP** - Free alternative

### Template Örnek Yapısı
```
┌─────────────────────────────────────────┐
│  [AfetNet Logo]   AFETNET               │
│                                         │
│  Hayat Kurtaran Afet İletişimi         │
│                                         │
│  [🆘 SOS]  [📡 Mesh]  [📍 Offline]     │
└─────────────────────────────────────────┘
```

---

## ✅ SONUÇ

### Mevcut Durum
- ✅ **Temel Assets:** Tam
- ✅ **App Icons:** Hazır
- ✅ **Splash Screens:** Hazır
- ✅ **Adaptive Icons:** Hazır

### Yapılması Gerekenler
1. ⚠️ **Feature Graphic oluştur** (1024x500) - Google Play için **ZORUNLU**
2. ⚠️ **Screenshots çek** (her platform için minimum 2 adet) - **ZORUNLU**
3. ℹ️ **Promo video hazırla** (opsiyonel ama önerilen)

### Tahmini Süre
- **Feature Graphic:** 1-2 saat (Canva ile)
- **Screenshots:** 2-3 saat (tüm cihazlar için)
- **Toplam:** Yarım gün yeterli

---

## 📞 DESTEK

### Tasarım Yardımı
1. **Canva Templates:** https://www.canva.com/templates/
2. **Figma Community:** https://www.figma.com/community
3. **Unsplash (Ücretsiz görseller):** https://unsplash.com/

### Store Requirements
- **Apple:** https://developer.apple.com/app-store/product-page/
- **Google Play:** https://support.google.com/googleplay/android-developer/answer/9866151

---

✅ **Özet:** Temel assets tamam! Sadece Feature Graphic ve Screenshots oluşturulması gerekiyor.

📅 **Güncelleme:** 11 Ekim 2025  
🎯 **Durum:** %80 Hazır (Feature Graphic + Screenshots bekleniyor)

