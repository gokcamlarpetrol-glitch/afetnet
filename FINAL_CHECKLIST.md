# ✅ AfetNet - Final Yayın Kontrol Listesi

## 🎯 YAYIN ÖNCESİ KONTROL

Yayından önce **HER MADDE** işaretlenmeli!

---

## 1️⃣ KOD KALİTESİ

- [ ] **TypeScript**: 0 hata
  ```bash
  npm run typecheck
  ```

- [ ] **Linter**: Uyarılar kabul edilebilir düzeyde
  ```bash
  npm run lint || echo "OK"
  ```

- [ ] **Build**: Başarılı
  ```bash
  npx expo export --platform android
  ```

---

## 2️⃣ ASSETS & BRANDING

- [ ] **Icon**: 1024x1024 PNG ✅
  ```bash
  file assets/icon.png | grep "1024 x 1024"
  ```

- [ ] **Splash**: 1242x2688 PNG ✅
  ```bash
  file assets/splash.png | grep "1242 x 2688"
  ```

- [ ] **Adaptive Icon**: 432x432 (Android) ✅
  ```bash
  ls assets/adaptive-icon-*.png
  ```

- [ ] **Logo Kalitesi**: Profesyonel görünüyor
  - Bulanık değil
  - Merkezi
  - Kırmızı (#C62828) tema

---

## 3️⃣ FIREBASE & BACKEND

- [ ] **google-services.json**: Var ✅
  ```bash
  ls google-services.json
  ```

- [ ] **app.config.ts**: googleServicesFile aktif ✅
  ```bash
  grep 'googleServicesFile' app.config.ts | grep -v '//'
  ```

- [ ] **Firebase Console**: Proje oluşturuldu
  - Android app eklendi (org.afetnet.app)
  - Cloud Messaging aktif

- [ ] **Backend API**: Deploy edildi (opsiyonel)
  ```bash
  curl https://YOUR-API.workers.dev/health
  ```

---

## 4️⃣ UYGULAMA YAPILANDIRMASI

- [ ] **Package Name**: `org.afetnet.app`
  ```bash
  grep '"package"' app.config.ts
  ```

- [ ] **Version**: 1.0.0
  ```bash
  grep '"version"' package.json
  ```

- [ ] **Permissions**: Android manifest
  - Bluetooth ✅
  - Location ✅
  - Notifications ✅
  - Camera ✅
  - Microphone ✅

- [ ] **Background Modes**: iOS Info.plist
  - bluetooth-central ✅
  - bluetooth-peripheral ✅
  - processing ✅
  - location ✅

---

## 5️⃣ TOUCH & UI

- [ ] **Alt Bar**: Görünüyor ve tıklanabilir ✅
  - Home ekranından test et
  - Harita sekmesine tıkla
  - Ayarlar sekmesine tıkla

- [ ] **Home Screen**: Basit ve hızlı ✅
  - SOS butonu çalışıyor
  - Hızlı erişim kartları tıklanabilir
  - ScrollView düzgün

- [ ] **Modal'lar**: Açılıp kapanıyor
  - SOS Modal test et
  - Başka modal varsa test et

---

## 6️⃣ ÖZELLİKLER

### Kritik (Olmadan yayınlanmaz):
- [ ] **SOS Yayını**: Butona basınca çalışıyor
- [ ] **Offline Harita**: Harita sekmesi açılıyor
- [ ] **Mesajlaşma**: Mesajlar sekmesi açılıyor
- [ ] **Aile Takip**: Family sekmesi açılıyor
- [ ] **Ayarlar**: Settings açılıyor ve değişiklik yapılabiliyor

### Önemli (Gerçek cihazda test):
- [ ] **BLE Mesh**: 2+ cihazda test edilmeli
- [ ] **PDR (Adım Takip)**: Hareket sensörü
- [ ] **Push Notifications**: FCM test bildirimi
- [ ] **Background Services**: Foreground bildirim (Android)

### Opsiyonel (Sonra eklenebilir):
- [ ] Deprem erken uyarı
- [ ] Drone koordinasyon
- [ ] AI karar destek

---

## 7️⃣ GOOGLE PLAY HAZIRLIĞI

- [ ] **Google Play Console**: Hesap oluşturuldu
- [ ] **Developer Fee**: $25 ödendi
- [ ] **App oluşturuldu**: "AfetNet"
- [ ] **Privacy Policy**: Host edildi
  - GitHub Pages veya
  - Cloudflare Pages veya
  - Kendi domain

- [ ] **Ekran Görüntüleri**: 6-8 adet hazır
  - Phone: 1080x1920 (en az 2)
  - Tablet: 7-inch (opsiyonel)

- [ ] **Feature Graphic**: 1024x500 (Android)
- [ ] **Store Listing**: Dolduruldu
  - Kısa açıklama (80 karakter)
  - Tam açıklama
  - Kategori: Tools / Utilities
  - Email iletişim

- [ ] **Content Rating**: Anket dolduruldu
  - Everyone (Herkes)

---

## 8️⃣ PRODUCTION BUILD

- [ ] **EAS CLI**: Kurulu
  ```bash
  eas --version
  ```

- [ ] **EAS Login**: Expo hesabı
  ```bash
  eas whoami
  ```

- [ ] **Build Başlatıldı**:
  ```bash
  eas build --platform android --profile production
  ```

- [ ] **Build Başarılı**: AAB indirildi
- [ ] **AAB Boyutu**: < 150 MB
- [ ] **Version Code**: Otomatik arttı

---

## 9️⃣ TEST (Gerçek Cihaz)

### Temel Testler:
- [ ] Uygulama açılıyor
- [ ] Crash olmuyor
- [ ] Alt bar görünüyor
- [ ] SOS butonu çalışıyor
- [ ] Harita yükleniyor
- [ ] Mesaj gönderiliyor (BLE test)
- [ ] Aile listesi görünüyor

### İzin Testleri:
- [ ] Bluetooth izni isteniyor
- [ ] Konum izni isteniyor
- [ ] Bildirim izni isteniyor
- [ ] Kamera izni (QR için)
- [ ] Mikrofon izni (sesli not)

### Background Test:
- [ ] Arka plana gönder
- [ ] Foreground service bildirimi görünüyor (Android)
- [ ] BLE tarama devam ediyor
- [ ] Pil tüketimi makul

---

## 🔟 YAYINLAMA

- [ ] **Internal Testing**: Beta test grubu (50+ kişi)
  - Feedback topla
  - Kritik bugları düzelt

- [ ] **Production Release**: AAB upload
- [ ] **Review İçin Gönder**: Google'a
- [ ] **Onay Bekle**: 1-3 gün
- [ ] **YAYINLANDI** 🎉

---

## 🚨 KRİTİK KONTROL

### YAYIN DURDURUCU SORUNLAR:

❌ **TypeScript hataları var** → Düzelt!  
❌ **google-services.json yok** → Firebase'den indir!  
❌ **Icon/Splash küçük** → Yeniden oluştur!  
❌ **Touch çalışmıyor** → HomeSimple kullan!  
❌ **Build başarısız** → Logları kontrol et!  

### UYARILAR (Düzeltilebilir):

⚠️  Backend API yok → Offline çalışır, sonra ekle  
⚠️  iOS build yok → Sadece Android yayınla  
⚠️  Bazı özellikler test edilmedi → Beta test'te test et  

---

## 📊 HAZIRLIK DURUMU

Yüzde hesapla:

```
Toplam madde: ~60
Tamamlanan: ___
Hazırlık: ____%
```

**%80+ → Yayınlanabilir!** ✅  
**%60-80 → Test et, düzelt** 🟡  
**<%60 → Daha fazla çalışma gerekli** 🔴  

---

## 🎯 SONRAKİ ADIMLAR

### Yayından Sonra (İlk Hafta):
1. **Monitoring**: Crashlytics/Sentry ekle
2. **Analytics**: Kullanım istatistikleri topla
3. **Feedback**: Kullanıcılardan geri bildirim al
4. **Hotfix**: Kritik bugları hızlıca düzelt

### 1 Ay İçinde:
1. **Backend**: API'yi tam entegre et
2. **iOS**: App Store'a yayınla
3. **Özellikler**: Eksik özellikleri tamamla
4. **Pazarlama**: Sosyal medya, PR

---

**Hazırlayan**: AI Assistant  
**Son Güncelleme**: 7 Ekim 2025  
**Kullanım**: Her yayın öncesi bu listeyi kontrol et!





