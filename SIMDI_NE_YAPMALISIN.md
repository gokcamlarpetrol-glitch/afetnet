# 🎯 ŞİMDİ NE YAPMALISIN?

## 📋 BUGÜN İÇİN BİTTİ! ✅

**Bugün yapılacak her şey tamamlandı:**
- ✅ Privacy Policy + Terms
- ✅ Backend deployment hazırlığı
- ✅ Store listing metinleri

**Toplam çalışma süresi: ~3 saat** 🎉

---

## 🌙 BU AKŞAM (Opsiyonel)

### 1. GitHub'a Commit At (5 dakika)
```bash
cd /Users/gokhancamci/AfetNet1

git add .
git commit -m "feat: Privacy policy, terms, deployment config, store listings"
git push origin main
```

**Neden önemli:**
- Dosyalar GitHub'a yüklensin
- Privacy Policy ve Terms URL'leri aktif olsun
- Backend deployment için hazır olsun

---

### 2. GitHub Pages Aktifleştir (2 dakika)
```bash
1. GitHub.com → AfetNet1 repository
2. Settings → Pages
3. Source: "main" branch
4. Folder: "/ (root)"
5. Save
```

**Sonuç:**
- https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html ✅
- https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html ✅

---

## 🚀 YARIN SABAH (4-5 saat)

### 1. Backend Deploy (15 dakika) - İLK İŞ
```bash
1. https://render.com → Sign up with GitHub
2. New → PostgreSQL
   • Name: afetnet-db
   • Region: Frankfurt
   • Plan: Free
   • Create Database
   • SAVE CONNECTION STRING!

3. New → Web Service
   • Connect GitHub: AfetNet1
   • Name: afetnet-backend
   • Region: Frankfurt
   • Root Directory: backend
   • Build: npm install && npm run build
   • Start: npm start
   • Plan: Free

4. Environment Variables (backend/.env'den kopyala):
   • NODE_ENV=production
   • PORT=10000
   • DATABASE_URL=[PostgreSQL'den]
   • JWT_SECRET=[güçlü random string]
   • ENCRYPTION_SECRET_KEY=[güçlü random string]
   • FIREBASE_PROJECT_ID=afetnet-c1ca7
   • FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@...
   • FIREBASE_PRIVATE_KEY="-----BEGIN..."
   • AFAD_API_URL=https://deprem.afad.gov.tr/...
   • USGS_API_URL=https://earthquake.usgs.gov/...

5. Create Web Service → Wait 5-10 minutes

6. Test:
   curl https://afetnet-backend.onrender.com/health
```

---

### 2. Screenshots Al (1-2 saat)
```bash
# iOS Simulator
1. Xcode → Open Developer Tool → Simulator
2. iPhone 15 Pro Max seç
3. Uygulamayı çalıştır: npx expo start
4. Ana ekran → CMD+S (screenshot)
5. Deprem uyarısı → CMD+S
6. Mesh network → CMD+S
7. Aile güvenliği → CMD+S
8. Premium ekran → CMD+S

# Android Emulator
1. Android Studio → Device Manager
2. Pixel 6 Pro seç
3. Uygulamayı çalıştır
4. Aynı ekranlardan screenshot al
```

**Gerekli Ekranlar:**
- Ana ekran (Harita + SOS butonu)
- Deprem uyarısı
- Mesh network
- Aile güvenliği
- Premium özellikler

**Boyutlar:**
- iPhone: 1290 x 2796 (6.7")
- Android: 1080 x 1920

---

### 3. Son Testler (1 saat)
```bash
# iOS Test
npx expo start
# i tuşuna bas → iOS Simulator
# Tüm özellikleri test et

# Android Test
npx expo start
# a tuşuna bas → Android Emulator
# Tüm özellikleri test et

Test Listesi:
- [ ] Login/Register
- [ ] SOS butonu
- [ ] Push notifications
- [ ] Deprem bildirimleri
- [ ] Mesh network
- [ ] Aile ekleme
- [ ] Offline mode
- [ ] Premium features
```

---

### 4. Developer Hesapları (1 saat)

#### Apple Developer ($99/yıl)
```bash
1. https://developer.apple.com/programs/enroll/
2. Sign in with Apple ID
3. Enroll → Individual
4. Ödeme: $99/yıl
5. Onay bekle (1-2 gün)
```

#### Google Play Console ($25 bir kerelik)
```bash
1. https://play.google.com/console/signup
2. Sign in with Google
3. Create developer account
4. Ödeme: $25 (bir kerelik)
5. Anında aktif!
```

---

### 5. Build & Submit (1 saat)

#### iOS Build
```bash
# Build
npx eas build --platform ios --profile production

# Submit (Apple Developer hesabı hazır olduktan sonra)
npx eas submit --platform ios
```

#### Android Build
```bash
# Build
npx eas build --platform android --profile production

# Submit
npx eas submit --platform android
```

---

## 📋 YARIN İÇİN CHECKLIST

### SABAH
- [ ] Backend deploy (Render.com)
- [ ] Backend test et
- [ ] Frontend'e backend URL ekle
- [ ] Screenshots al (iOS + Android)
- [ ] Screenshots düzenle (opsiyonel)

### ÖĞLEDEN SONRA
- [ ] Son testler yap
- [ ] Apple Developer hesabı aç
- [ ] Google Play Console hesabı aç
- [ ] iOS build başlat
- [ ] Android build başlat
- [ ] Store'lara submit et

---

## 💡 İPUÇLARI

### Backend Deploy
- **Render ücretsiz ama yavaş:** İlk request 30 saniye sürebilir (cold start)
- **Railway daha hızlı:** Ama $5/ay
- **Seçim:** Başlangıç için Render yeterli

### Screenshots
- **Basit tut:** Store'lar için fancy tasarım şart değil
- **Gerçek ekranlar:** Simulator'dan direkt screenshot yeterli
- **Canva kullan:** Opsiyonel olarak basit çerçeve ekleyebilirsin

### Developer Hesapları
- **Apple:** Onay 1-2 gün sürebilir, erkenden başla
- **Google:** Anında aktif
- **Kredi kartı:** İkisi için de gerekli

### Build Süresi
- **iOS:** 15-20 dakika
- **Android:** 10-15 dakika
- **Paralel çalıştır:** İkisini aynı anda başlat

---

## 🎯 ÖNCELİK SIRASI

### YÜKSEK ÖNCELİK (Mutlaka yapılmalı)
1. Backend deploy ⭐⭐⭐⭐⭐
2. Screenshots (en az 2 tane) ⭐⭐⭐⭐⭐
3. Developer hesapları ⭐⭐⭐⭐⭐
4. Build & Submit ⭐⭐⭐⭐⭐

### ORTA ÖNCELİK (Yapılmalı)
5. Son testler ⭐⭐⭐⭐
6. Screenshots düzenleme ⭐⭐⭐

### DÜŞÜK ÖNCELİK (Opsiyonel)
7. Feature graphic (Android) ⭐⭐
8. Promo video ⭐

---

## 📞 YARDIM GEREKİRSE

### Render Deploy Sorunu
- Logs kontrol et: Dashboard → Logs
- Environment variables doğru mu?
- Build başarılı mı?

### Screenshot Sorunu
- Simulator çalışmıyor mu? → Xcode güncelle
- Emulator yavaş mı? → RAM artır

### Build Hatası
- `npx eas build:list` → Önceki build'leri gör
- Logs kontrol et
- EAS docs: https://docs.expo.dev/build/introduction/

---

## 🎉 ÖZET

### BU AKŞAM (Opsiyonel - 7 dakika)
1. Git commit & push
2. GitHub Pages aktifleştir

### YARIN (4-5 saat)
1. Backend deploy (15 dk)
2. Screenshots (1-2 saat)
3. Testler (1 saat)
4. Developer hesapları (1 saat)
5. Build & Submit (1 saat)

### SONUÇ
**YAYIN! 🚀**

---

# 🌙 BU AKŞAM SADECE GIT PUSH YAP, DİNLEN!

**Yarın büyük gün!** 🎉
