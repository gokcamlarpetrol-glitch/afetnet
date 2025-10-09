# 🔥 FIREBASE CONFIG KURULUM KILAVUZU

## 📱 HEM ANDROID HEM iOS EKLEYECEĞİZ!

Firebase Console'da görüyorum ki "Select a platform" bölümünde hem Android hem iOS seçenekleri var.

---

## 🎯 ADIM ADIM YAPALIM:

### ADIM 1: Android App Ekle
1. Firebase Console'da **Android ikonu** tıkla
2. **Package name** gir: `com.afetnet.app`
3. **App nickname** (opsiyonel): `AfetNet Android`
4. **Debug signing certificate SHA-1** (şimdilik boş bırak)
5. **"Register app"** tıkla
6. **google-services.json** dosyasını indir
7. **"Next"** tıkla (diğer adımları şimdilik atla)

### ADIM 2: iOS App Ekle
1. Firebase Console'da **iOS+ ikonu** tıkla
2. **Bundle ID** gir: `com.afetnet.app`
3. **App nickname** (opsiyonel): `AfetNet iOS`
4. **App Store ID** (şimdilik boş bırak)
5. **"Register app"** tıkla
6. **GoogleService-Info.plist** dosyasını indir
7. **"Next"** tıkla (diğer adımları şimdilik atla)

---

## 📁 İNDİRİLEN DOSYALAR

### Android: google-services.json
```
- Package name: com.afetnet.app
- İndirilen dosya: google-services.json
- Yerleştirilecek yer: android/app/google-services.json
```

### iOS: GoogleService-Info.plist
```
- Bundle ID: com.afetnet.app
- İndirilen dosya: GoogleService-Info.plist
- Yerleştirilecek yer: ios/GoogleService-Info.plist
```

---

## 🚀 SONRAKI ADIMLAR

Bu dosyaları indirdikten sonra:

1. **Android için:**
   - google-services.json → android/app/ klasörüne kopyala
   - android/app/build.gradle'a plugin ekle

2. **iOS için:**
   - GoogleService-Info.plist → ios/ klasörüne kopyala
   - Xcode'da projeye ekle

3. **Backend için:**
   - Firebase Admin SDK service account key al
   - Backend .env'e ekle

---

## 💡 ÖNEMLİ NOTLAR

- **Package name**: com.afetnet.app (hem Android hem iOS için aynı)
- **İki ayrı app** olacak Firebase'de (Android + iOS)
- **Her biri için ayrı config dosyası** indireceksin
- **Backend tek** olacak (her iki platform için)

---

## 🎯 ŞİMDİ NE YAPACAKSIN?

1. Firebase Console'da **Android ikonu** tıkla
2. Package name: `com.afetnet.app` gir
3. google-services.json indir
4. Sonra **iOS+ ikonu** tıkla
5. Bundle ID: `com.afetnet.app` gir
6. GoogleService-Info.plist indir
7. İki dosyayı da bana gönder, ben projeye ekleyeyim! ✅

---

## 📊 SONUÇ

```
✅ Android app: com.afetnet.app
✅ iOS app: com.afetnet.app
✅ Her ikisi de aynı Firebase projesi
✅ Backend tek (her iki platform için)
```

---

# 🔥 HEM ANDROID HEM iOS EKLİYORUZ!

**Firebase Console'da iki ayrı app oluştur: Android + iOS**
