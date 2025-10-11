# 📸 AFETNET SCREENSHOT VE FEATURE GRAPHIC REHBERİ

**Tarih:** 11 Ekim 2025  
**Amaç:** Store submission için gerekli görselleri hazırlama

---

## 🎯 GEREKLI GÖRSELLER

### ✅ **Mevcut Assets**
- ✅ App Icon (1024x1024) - `icon-1024.png`
- ✅ Splash Screen - `splash.png`
- ✅ Adaptive Icon - Android için hazır

### ⚠️ **Oluşturulması Gerekenler**

#### 1. Feature Graphic (Google Play - ZORUNLU)
- **Boyut:** 1024x500 piksel
- **Format:** PNG veya JPG
- **Maksimum:** 1 MB
- **Durum:** ❌ Eksik

#### 2. Screenshots (Her Platform - ZORUNLU)
- **iOS:** Minimum 2 screenshot (6.7" veya 6.5" cihaz)
- **Android:** Minimum 2 screenshot (Phone)
- **Durum:** ❌ Eksik

---

## 🎨 1. FEATURE GRAPHIC OLUŞTURMA (Google Play)

### Tasarım Gereksinimleri
```
Boyut: 1024x500 piksel
Format: PNG veya JPG
Dosya Boyutu: Max 1 MB
Renk Teması: #C62828 (Kırmızı)
```

### İçerik Önerileri

#### Stil 1: Minimalist ve Profesyonel
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  🆘 AFETNET                                            │
│  Hayat Kurtaran Deprem İletişim Ağı                   │
│                                                        │
│  [📡 Offline Mesh]  [🌍 Canlı Deprem]  [👥 Aile]     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Stil 2: Feature Showcase
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  AFETNET  [Logo]                                      │
│                                                        │
│  ✓ İnternet Olmadan Mesajlaşma                        │
│  ✓ Gerçek Zamanlı Deprem Uyarısı                      │
│  ✓ Aile Takibi ve Güvenlik                            │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Stil 3: App Screenshots Preview
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  [Phone Screenshot 1]  [Phone Screenshot 2]            │
│                                                        │
│  AFETNET - Deprem ve Afetlerde İletişim Sağlar        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Canva ile Oluşturma (ÖNERİLEN)

1. **Canva'ya Git:** https://www.canva.com
2. **Custom Size:** 1024 x 500 piksel
3. **Template Seç:** "Google Play Feature Graphic" ara
4. **Customize Et:**
   - AfetNet logosu ekle (icon.png'yi upload et)
   - "AfetNet - Hayat Kurtaran Afet İletişimi" başlığı
   - Anahtar özellikler: 🆘 SOS, 📡 Mesh, 🌍 Deprem, 👥 Aile
   - Renk teması: #C62828 (Kırmızı)
5. **Export:** PNG, 1024x500
6. **Kaydet:** `assets/feature-graphic.png`

### Figma ile Oluşturma (Profesyonel)

1. **Yeni Frame:** 1024 x 500
2. **Background:** Gradient (#C62828 → #D32F2F)
3. **Logo:** Icon.png'yi import et (200x200)
4. **Başlık:** "AFETNET" (72px, Bold, White)
5. **Alt Başlık:** "Hayat Kurtaran Afet İletişimi" (32px, White)
6. **Icons:** 🆘 📡 🌍 👥 (48px)
7. **Export:** PNG, 1024x500

---

## 📱 2. SCREENSHOTS OLUŞTURMA

### Hangi Ekranların Screenshot'u Alınmalı?

#### Zorunlu (Minimum 2 adet)
1. **🏠 Ana Ekran (HomeSimple.tsx)**
   - SOS butonu prominent
   - Mesh ağı göstergesi
   - Deprem erken uyarı aktif

2. **🆘 SOS Ekranı**
   - SOS gönderimi
   - Konum paylaşımı
   - Offline mod göstergesi

#### Önerilen (Toplam 6-8 adet)
3. **🌍 Harita Ekranı**
   - Deprem verileri görünür
   - Aile üyeleri konum
   - Toplanma noktaları

4. **💬 Mesajlaşma**
   - Offline mesaj örneği
   - E2E şifreli mesaj
   - Teslim alındı göstergesi

5. **👥 Aile Takibi**
   - Aile üyeleri listesi
   - Durum göstergeleri (İyi/Yardım)
   - Konum paylaşımı

6. **⚙️ Ayarlar**
   - Kapsamlı ayarlar ekranı
   - Switch kontrolleri
   - Premium özellikler

7. **📡 Mesh Network**
   - Yakındaki cihazlar
   - Mesh ağ durumu
   - Bağlantı göstergesi

8. **🌍 Deprem Listesi**
   - Canlı deprem verileri
   - Filtreler aktif
   - Bildirim ayarları

### iOS Screenshots

#### Gerekli Cihaz Boyutları
```bash
iPhone 6.7" (1290x2796) - iPhone 14/15 Pro Max
iPhone 6.5" (1242x2688) - iPhone 11/12/13 Pro Max
iPhone 5.5" (1242x2208) - iPhone 8 Plus
```

#### iOS Simulator'de Screenshot Alma
```bash
# 1. Simulator başlat
open -a Simulator

# 2. Cihaz seç: Hardware > Device > iPhone 15 Pro Max

# 3. Uygulamayı çalıştır
cd /Users/gokhancamci/AfetNet1
npx expo run:ios

# 4. Screenshot al (her ekranda)
Cmd + S  # veya
xcrun simctl io booted screenshot ~/Desktop/screenshot-home.png

# 5. Tüm ekranlar için tekrarla
```

### Android Screenshots

#### Gerekli Cihaz Boyutları
```bash
Phone: 1080x1920 (Full HD)
Tablet 7": 1200x1920
Tablet 10": 1600x2560
```

#### Android Emulator'de Screenshot Alma
```bash
# 1. Emulator başlat
emulator -avd Pixel_6_API_33

# 2. Uygulamayı çalıştır
cd /Users/gokhancamci/AfetNet1
npx expo run:android

# 3. Screenshot al
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png ~/Desktop/screenshot-home.png

# veya Android Studio'dan:
# View > Tool Windows > Device File Explorer > screenshot
```

---

## 📋 3. SCREENSHOT CHECKLIST

### Her Screenshot İçin
- [ ] **Yüksek Çözünürlük** (Retina/Full HD)
- [ ] **Demo Veriler** (Gerçek kişisel bilgi yok)
- [ ] **İyi Aydınlatma** (Açık/Karanlık tema tutarlı)
- [ ] **Feature Highlight** (Özellik net görünmeli)
- [ ] **Status Bar Temiz** (Tam batarya, sinyal)
- [ ] **Düzgün Framing** (Kesik yok)

### Screenshot İsimlendirme
```
iOS:
- ios-1-home-6.7.png
- ios-2-sos-6.7.png
- ios-3-map-6.7.png
- ios-4-chat-6.7.png
- ios-5-family-6.7.png
- ios-6-settings-6.7.png

Android:
- android-1-home.png
- android-2-sos.png
- android-3-map.png
- android-4-chat.png
- android-5-family.png
- android-6-settings.png
```

---

## 🛠️ 4. HIZLI YÖNTEM (Geliştirici İçin)

### Expo Go ile Test Screenshots
```bash
# 1. Expo Go'yu cihaza indir (iOS/Android)

# 2. Uygulamayı başlat
npx expo start

# 3. QR kod ile Expo Go'dan aç

# 4. Her ekranda screenshot çek:
# iOS: Home Button + Power Button
# Android: Volume Down + Power Button

# 5. Screenshots'ları bilgisayara aktar:
# iOS: AirDrop veya iCloud
# Android: USB transfer veya Google Photos
```

### Simulator/Emulator Avantajları
- ✅ Tam boyut kontrolü
- ✅ Demo data kolayca eklenebilir
- ✅ Hızlı iterasyon
- ✅ Status bar düzenleme kolay

---

## 🎨 5. SCREENSHOT DÜZENLEME

### Demo Data Ekleme
Uygulama çalışırken:
```typescript
// HomeSimple.tsx içinde demo mode ekle
const DEMO_MODE = true;

if (DEMO_MODE) {
  // Fake earthquake data göster
  // Fake family members göster
  // Fake messages göster
}
```

### Photoshop/GIMP ile Düzenleme
1. Screenshot'u aç
2. Kişisel bilgileri sil/blur et
3. Demo verilerle değiştir
4. Renk/kontrast düzelt
5. Export (PNG, yüksek kalite)

---

## 📦 6. STORE'A YÜKLEME

### Apple App Store Connect

1. **Login:** https://appstoreconnect.apple.com
2. **My Apps > AfetNet > App Store**
3. **Screenshots & Preview:**
   - iPhone 6.7" Display: 2-8 screenshot yükle
   - iPhone 6.5" Display: 2-8 screenshot yükle (opsiyonel)
   - iPad Pro 12.9": 2-8 screenshot yükle (opsiyonel)
4. **Save**

### Google Play Console

1. **Login:** https://play.google.com/console
2. **AfetNet > Store presence > Main store listing**
3. **Graphics:**
   - App icon: 512x512 (otomatik adaptive-icon'dan)
   - Feature graphic: 1024x500 YÜKLE ⚠️
   - Phone screenshots: 2-8 screenshot YÜKLE ⚠️
   - 7" tablet (opsiyonel)
   - 10" tablet (opsiyonel)
4. **Save**

---

## 🚀 7. HIZLI BAŞLANGIÇ (Önümüzdeki Saatlerde)

### Adım 1: Feature Graphic Oluştur (30 dakika)
```bash
1. Canva.com'a git
2. Custom size: 1024x500
3. Template seç veya sıfırdan oluştur
4. AfetNet branding ekle
5. Export → PNG → kaydet: assets/feature-graphic.png
```

### Adım 2: Screenshots Çek (1-2 saat)
```bash
# iOS (iPhone 15 Pro Max simulator)
1. npx expo run:ios
2. Ana ekran → Cmd+S → ios-1-home.png
3. SOS ekran → Cmd+S → ios-2-sos.png
4. Harita ekran → Cmd+S → ios-3-map.png
5. Mesaj ekran → Cmd+S → ios-4-chat.png
6. Aile ekran → Cmd+S → ios-5-family.png
7. Ayarlar ekran → Cmd+S → ios-6-settings.png

# Android (Pixel 6 emulator)
1. npx expo run:android
2. Her ekran için screenshot çek (Volume Down + Power)
3. Screenshots'ları bilgisayara aktar
```

### Adım 3: Store'a Yükle (30 dakika)
```bash
1. App Store Connect → Screenshots yükle
2. Google Play Console → Feature graphic + Screenshots yükle
3. Kaydet
```

---

## 💡 PROFESYONEL İPUÇLARI

### Feature Graphic İçin
- ✅ Basit tut (çok metin ekleme)
- ✅ AfetNet logosu prominent
- ✅ 3-4 anahtar özellik göster
- ✅ Kırmızı tema (#C62828)
- ✅ Yüksek kontrast (kolay okunabilir)

### Screenshots İçin
- ✅ Gerçekçi demo veriler kullan
- ✅ Kişisel bilgi gösterme
- ✅ Her screenshot bir feature göstersin
- ✅ Açıklama metni ekle (opsiyonel)
- ✅ Tutarlı tema (hep dark veya hep light)

### Store Listing İçin
- ✅ İlk 2 screenshot en önemli (kullanıcılar sadece bunları görür)
- ✅ Screenshots'lar hikaye anlatmalı
- ✅ Feature graphic ilk izlenim (çekici olmalı)

---

## 🎯 ÖNCELİKLENDİRME

### Yüksek Öncelik (Bugün)
1. **Feature Graphic** (1024x500) - 30 dakika
2. **2 iOS Screenshot** - 1 saat
3. **2 Android Screenshot** - 1 saat

### Orta Öncelik (Bu Hafta)
4. **4 iOS Screenshot daha** - 1 saat
5. **4 Android Screenshot daha** - 1 saat
6. **Tablet Screenshots** - 2 saat

### Düşük Öncelik (Opsiyonel)
7. **Promo Video** - 1 gün
8. **Marketing materials** - 2 gün

---

## 📐 BOYUT REFERANSI

### iOS Screenshot Boyutları
| Cihaz | Boyut | Örnek Cihaz |
|-------|-------|-------------|
| 6.7" | 1290x2796 | iPhone 15 Pro Max |
| 6.5" | 1242x2688 | iPhone 13 Pro Max |
| 5.5" | 1242x2208 | iPhone 8 Plus |
| iPad 12.9" | 2048x2732 | iPad Pro 12.9" |

### Android Screenshot Boyutları
| Cihaz | Min-Max | Örnek |
|-------|---------|-------|
| Phone | 320-3840px width | 1080x1920 |
| 7" Tablet | 320-3840px width | 1200x1920 |
| 10" Tablet | 320-3840px width | 1600x2560 |

---

## 🔧 ARAÇLAR

### Tasarım Araçları
- **Canva** - https://www.canva.com (Ücretsiz, kolay)
- **Figma** - https://www.figma.com (Profesyonel)
- **Adobe Photoshop** - (Full control)
- **GIMP** - https://www.gimp.org (Ücretsiz)

### Screenshot Araçları
- **iOS Simulator** - Xcode ile gelir
- **Android Emulator** - Android Studio
- **Expo Go** - Gerçek cihazda test
- **Screenshot Studio** - Otomatik framing

### Mockup Araçları
- **Previewed.app** - Device mockups
- **Shotsnapp** - Professional frames
- **MockUPhone** - Ücretsiz mockups

---

## ✅ SONUÇ

### Mevcut Durum
- ✅ **App Icon**: Hazır (1024x1024)
- ✅ **Splash Screen**: Hazır
- ✅ **Adaptive Icon**: Hazır (Android)
- ⚠️ **Feature Graphic**: Oluşturulması gerekli
- ⚠️ **Screenshots**: Çekilmesi gerekli

### Tahmini Süre
- **Feature Graphic:** 30 dakika (Canva ile)
- **Screenshots (iOS):** 1-2 saat (6 adet)
- **Screenshots (Android):** 1-2 saat (6 adet)
- **Düzenleme:** 1 saat
- **Toplam:** ~4-6 saat

### Sonraki Adım
1. **Canva'da Feature Graphic oluştur** → `assets/feature-graphic.png`
2. **Simulator'de screenshots çek** → `store-listings/ios/` ve `store-listings/android/`
3. **Store'lara yükle**
4. **Yayınlama için submit et** 🚀

---

✅ **Assets rehberi hazır!**  
📅 **Güncelleme:** 11 Ekim 2025  
🎯 **Sonraki Adım:** Feature Graphic + Screenshots oluştur

