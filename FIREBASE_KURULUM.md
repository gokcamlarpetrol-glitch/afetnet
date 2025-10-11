# 🔥 Firebase/FCM Kurulum Kılavuzu

## ⏱️ Tahmini Süre: 15 dakika

---

## ADIM 1: Firebase Projesi Oluştur (5 dk)

### 1.1 Firebase Console'a Git
```
https://console.firebase.google.com
```

### 1.2 Yeni Proje Oluştur
1. "Add project" / "Proje ekle" butonuna tıkla
2. **Proje adı**: `AfetNet` (veya `afetnet-prod`)
3. **Analytics**: ✅ Aktif et (önerilen)
4. **Google Analytics hesabı**: Varsayılan seç
5. **"Create project"** tıkla
6. ⏳ Bekle (~30 saniye)

---

## ADIM 2: Android App Ekle (5 dk)

### 2.1 Android İkonu Tıkla
Firebase Console'da:
- Project Overview → "Add app" → **Android ikonu**

### 2.2 Bilgileri Gir
```
Android package name: org.afetnet.app
App nickname (opsiyonel): AfetNet
Debug signing (opsiyonel): BOŞ BIRAK
```

**ÖNEMLİ**: Package name `org.afetnet.app` olmalı (app.config.ts'te tanımlı)

### 2.3 google-services.json İndir
1. **"Download google-services.json"** butonuna tıkla
2. Dosyayı `/Users/gokhancamci/AfetNet1/` dizinine kopyala

```bash
# Terminal'de kontrol:
cd /Users/gokhancamci/AfetNet1
ls -lh google-services.json
```

Dosya ~2-5 KB olmalı.

### 2.4 Config Dosyasını Güncelle
```bash
# app.config.ts dosyasını aç ve şu satırı bul:
# googleServicesFile: "./google-services.json", // Commented out

# Yorumu kaldır:
googleServicesFile: "./google-services.json"
```

---

## ADIM 3: Cloud Messaging Aktif Et (2 dk)

### 3.1 Firebase Console'da
1. Sol menüden **"Engage"** → **"Messaging"**
2. **"Get started"** tıkla
3. İlk bildirimi gönder (test):
   - Title: "AfetNet Test"
   - Message: "Push bildirimleri çalışıyor!"
   - Target: "All users"
   - **"Send"** tıkla

---

## ADIM 4: Server Key Al (Opsiyonel - Backend İçin)

### 4.1 Project Settings
1. Sol üstten ⚙️ (Settings) → "Project settings"
2. "Cloud Messaging" sekmesi
3. **"Server key"** kopyala

### 4.2 .env Dosyası Oluştur
```bash
cd /Users/gokhancamci/AfetNet1
nano .env
```

İçerik:
```
FIREBASE_SERVER_KEY=AAAA...your_key_here
FCM_SENDER_ID=123456789012
```

---

## ADIM 5: Test Et (3 dk)

### 5.1 Uygulamayı Çalıştır
```bash
cd /Users/gokhancamci/AfetNet1
npx expo start --clear
```

### 5.2 Cihazda Test
1. Expo Go ile uygulamayı aç
2. Console'da şu log'u ara:
   ```
   ✅ AfetNet: Push notification hazır
   ```

3. Token görmüyorsan:
   - Android cihaz kullanıyor musun? (iOS Expo Go'da FCM yok)
   - İzinleri verdin mi?

### 5.3 Firebase Console'dan Test Bildirimi Gönder
1. Firebase Console → Messaging
2. "Send your first message"
3. Hedef: "AfetNet" app
4. Gönder → Cihazda bildirim görmeli!

---

## ✅ KONTROL LİSTESİ

Tamamlandıktan sonra kontrol et:

- [ ] `google-services.json` kök dizinde
- [ ] `app.config.ts`'te googleServicesFile yorumu kaldırıldı
- [ ] Firebase projesi oluşturuldu
- [ ] Android app eklendi (org.afetnet.app)
- [ ] Cloud Messaging aktif
- [ ] Test bildirimi başarılı

---

## 🆘 SORUN GİDERME

### "google-services.json not found"
```bash
# Dosya doğru yerde mi?
ls /Users/gokhancamci/AfetNet1/google-services.json

# Yoksa Firebase Console'dan tekrar indir
```

### "FCM token yok"
```
- Android gerçek cihaz kullan (emulator sorunlu olabilir)
- Expo Go yerine development build kullan (EAS)
- Bildirimlere izin ver (Settings → AfetNet → Notifications)
```

### "Package name mismatch"
```
# app.config.ts:
android: {
  package: "org.afetnet.app"  // Firebase'de aynı olmalı!
}
```

---

## 📚 SONRAKI ADIMLAR

Firebase kurulumu tamamlandıktan sonra:

1. **Backend API** hazırla (FCM token'ları kaydet)
2. **Production build** yap (EAS)
3. **Test** et (gerçek cihazda)

---

## 🔗 Faydalı Linkler

- Firebase Console: https://console.firebase.google.com
- FCM Docs: https://firebase.google.com/docs/cloud-messaging
- Expo Notifications: https://docs.expo.dev/push-notifications/overview

---

**Hazırlayan**: AI Assistant
**Güncelleme**: 7 Ekim 2025




