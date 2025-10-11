# 🚀 AfetNet - Hızlı Başlangıç Kılavuzu

## 📱 BUGÜN YAYINLAMAK İÇİN (Minimum Gereksinimler)

### ⏱️ **2-3 SAAT İÇİNDE YAYINLAYABİLİRSİNİZ!**

---

## ADIM 1: ICON VE SPLASH OLUŞTUR (30 dk) 🎨

### Option A: Hızlı Çözüm (Canva)
```
1. canva.com → "App Icon" şablonu
2. "AfetNet" yaz, kırmızı arka plan (#C62828)
3. Beyaz kurtarma sembolü ekle
4. 1024x1024 PNG indir → assets/icon.png

5. "App Splash Screen" şablonu
6. Aynı tasarım, farklı boyutlar
7. 1242x2688 PNG indir → assets/splash.png
```

### Option B: Profesyonel (Fiverr)
```
Fiverr → "mobile app icon design"
5-10$, 1-2 saat teslimat
"Emergency/disaster app, red theme, professional"
```

### Geçici Çözüm (Test için):
```bash
# Mevcut SVG'leri kullan (kalite düşük ama çalışır)
cd assets/
# icon.svg ve splash.svg zaten var
```

---

## ADIM 2: FIREBASE/FCM KUR (20 dk) 🔔

### 2.1 Firebase Projesi Oluştur
```
1. console.firebase.google.com
2. "Add project" → "AfetNet"
3. Analytics: Evet (önerilen)
4. Create project
```

### 2.2 Android App Ekle
```
1. Project Overview → Add app → Android
2. Package name: org.afetnet.app
3. App nickname: AfetNet
4. Download google-services.json
5. Kök dizine kopyala:
   /Users/gokhancamci/AfetNet1/google-services.json
```

### 2.3 Config Güncelle
```bash
# app.config.ts dosyasında yorum satırını kaldır:
# googleServicesFile: "./google-services.json"
```

**✅ Kontrol**: 
```bash
ls google-services.json  # Dosya var mı?
```

---

## ADIM 3: BACKEND API (OPSIYONEL - Offline Çalışır) 🌐

### Option A: Geçici Backend (Cloudflare Workers - 5 dk)
```bash
# wrangler CLI kur
npm install -g wrangler

# Worker oluştur
wrangler init afetnet-api
cd afetnet-api

# index.js:
export default {
  async fetch(request) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/ingest') {
      const data = await request.json();
      console.log('Received:', data);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('AfetNet API');
  }
};

# Deploy
wrangler publish  # Free plan!
# URL: https://afetnet-api.YOUR_USERNAME.workers.dev
```

### Option B: Backend Olmadan İlerle
```
✅ Uygulama offline çalışır
✅ Queue local'de birikir
✅ İnternet gelince sync olur
🟡 Backend sonra eklenebilir
```

---

## ADIM 4: PRODUCTION BUILD (30 dk) 📦

### 4.1 EAS CLI Kur
```bash
npm install -g eas-cli
eas login  # Expo hesabı gerekli (ücretsiz)
```

### 4.2 Proje Init
```bash
eas init  # Proje ID alacak
```

### 4.3 Android Build
```bash
eas build --platform android --profile production

# Output: .aab dosyası (Google Play için)
# Build ~15-20 dakika sürer (cloud'da)
```

### 4.4 Test APK (Opsiyonel)
```bash
eas build --platform android --profile preview

# Output: .apk (direkt cihaza install)
```

---

## ADIM 5: GOOGLE PLAY CONSOLE (1 saat) 🏪

### 5.1 Hesap Oluştur
```
1. play.google.com/console
2. Developer account: $25 (bir kerelik)
3. Kimlik doğrulama (1-2 gün sürebilir)
```

### 5.2 Uygulama Oluştur
```
1. "Create app"
2. Name: AfetNet
3. Language: Türkçe
4. App/Game: App
5. Free/Paid: Free
```

### 5.3 Store Listing
```
Kısa Açıklama (80 karakter):
"Deprem ve afetlerde hayat kurtaran offline acil durum ağı"

Tam Açıklama:
[store-listings/turkish.md dosyasını kullan]

Kategori: Tools
Email: [sizin email]
Privacy Policy: [host edilmiş URL - GitHub Pages kullanabilirsiniz]
```

### 5.4 Ekran Görüntüleri

**Minimum Gereksinim**:
- Phone: 2 screenshot (en az)
- 7-inch tablet: 2 screenshot (opsiyonel)

**Nasıl Çekilir**:
```bash
# iOS Simulator
xcrun simctl io booted screenshot ~/Desktop/screen1.png

# Android Emulator
adb shell screencap -p /sdcard/screen.png
adb pull /sdcard/screen.png

# Manuel: Uygulamayı çalıştır, CMD+S (iOS) / Power+Vol Down (Android)
```

**Hangi Ekranlar**:
1. Home (Ana dashboard)
2. Harita (Offline map)
3. Acil Durum (SOS ekranı)
4. Mesh Network (Bağlantılar)

### 5.5 Content Rating
```
1. "Start questionnaire"
2. Category: Utility/Productivity
3. Violence: None
4. User-generated content: No
5. Location sharing: Yes, approximate
6. Submit → Rating: Everyone
```

### 5.6 AAB Upload
```bash
# EAS'tan indirdiğin .aab dosyasını upload et
# Production → Release → Upload

# App signing: Google manages (önerilen)
```

### 5.7 İlk Sürüm
```
1. Internal testing → Create release
2. .aab upload
3. Release name: "1.0.0 - İlk Sürüm"
4. Release notes:
   "AfetNet'in ilk sürümü. Offline acil durum ağı, deprem uyarıları, 
    mesh communication ve hayat kurtarma özellikleri."
5. Review → Start rollout
```

**⏱️ İnceleme**: 1-3 gün

---

## ADIM 6: iOS (OPSIYONEL - Sonra Eklenebilir) 🍎

### Gereksinimler:
- Apple Developer account: $99/yıl
- Mac bilgisayar (build için)

### Build:
```bash
eas build --platform ios --profile production
```

### Submit:
```bash
eas submit --platform ios --latest
```

---

## ✅ KONTROL LİSTESİ

Yayından önce kontrol edin:

- [ ] `google-services.json` var
- [ ] Icon 1024x1024 (en az 512x512)
- [ ] Splash ekranı düzgün
- [ ] TypeScript 0 hata (`npm run typecheck`)
- [ ] Privacy Policy URL hazır
- [ ] 2+ ekran görüntüsü
- [ ] Google Play Console hesabı aktif
- [ ] EAS build başarılı
- [ ] AAB dosyası indirildi

---

## 🆘 SORUN GİDERME

### "google-services.json not found"
```bash
# Firebase Console → Project Settings → General
# "Your apps" → Android → Download google-services.json
```

### "Icon too small"
```bash
# Minimum: 512x512
# Önerilen: 1024x1024
# Format: PNG, şeffaf arka plan
```

### "Build failed"
```bash
# Log kontrol:
eas build:view

# Common: package version mismatch
npx expo install --fix
```

### "Play Console reject"
```
Common nedenler:
1. Privacy policy eksik → GitHub Pages'te host et
2. Content rating eksik → Anketi tekrar doltur
3. Target SDK low → app.config.ts'te android.targetSdkVersion: 34
```

---

## 📞 DESTEK

### Dokümantasyon:
- `/store/submission_steps_tr.md`
- `/store/qa_checklist_tr.md`
- `YAYIN_HAZIRLIK_RAPORU.md`

### Topluluk:
- Expo: docs.expo.dev
- React Native: reactnative.dev
- Firebase: firebase.google.com/docs

---

## 🎉 BAŞARILI YAYINDAN SONRA

1. **Monitoring Ekle**
   ```bash
   # Sentry (crash tracking)
   npx expo install @sentry/react-native
   
   # Analytics
   Firebase Analytics (zaten kurulu)
   ```

2. **Beta Test**
   ```
   Internal Testing → 50-100 kullanıcı
   Feedback topla → Hızlı iterasyon
   ```

3. **Marketing**
   ```
   - Sosyal medya duyurusu
   - Afet yönetimi forumları
   - Yerel belediye iş birlikleri
   ```

4. **Güncellemeler**
   ```bash
   # Yeni build
   eas build --platform android --profile production
   
   # Auto-submit
   eas submit --platform android --latest
   ```

---

## ⏱️ ZAMAN ÇİZELGESİ

| Adım | Süre | Zorunlu? |
|------|------|----------|
| 1. Icon/Splash | 30 dk | ✅ Evet |
| 2. Firebase/FCM | 20 dk | ✅ Evet |
| 3. Backend API | 30 dk | 🟡 Opsiyonel |
| 4. Production Build | 30 dk | ✅ Evet |
| 5. Play Console Setup | 1 saat | ✅ Evet |
| 6. İnceleme Bekle | 1-3 gün | - |
| **TOPLAM AKTİF ÇALIŞMA** | **~3 saat** | - |

---

**🚀 ŞİMDİ BAŞLA!**

En kritik adım: **Icon ve FCM**. Bunlar olmadan store kabul etmez!

```bash
# Hızlı test
cd /Users/gokhancamci/AfetNet1
npx expo-doctor  # Sorunları göster
npm run typecheck  # 0 hata olmalı
```

Sorular? → `YAYIN_HAZIRLIK_RAPORU.md` dosyasına bakın!




