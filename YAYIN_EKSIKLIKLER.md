# 🚀 AfetNet - Yayın Öncesi Eksiklikler ve Gereksinimler

## ✅ TAMAMLANMIŞ ÖZELLIKLER
- ✅ Tüm ekranlar aktif ve çalışıyor
- ✅ BLE Mesh mesajlaşma sistemi
- ✅ Offline harita sistemi
- ✅ PDR (Pedestrian Dead Reckoning) konum takibi
- ✅ SOS acil yardım sistemi
- ✅ Enkaz algılama sistemi
- ✅ Aile takip sistemi
- ✅ Premium abonelik sistemi (Stripe entegrasyonu)
- ✅ Kapsamlı ayarlar ekranı
- ✅ Push notification sistemi
- ✅ Deprem bildirimleri (AFAD entegrasyonu)

---

## 🔴 KRİTİK EKSİKLİKLER (Yayın Öncesi Mutlaka Yapılmalı)

### 1. **STRIPE ÖDEME SİSTEMİ - BACKEND GEREKLİ**
**Durum:** ❌ Backend yok, sadece frontend hazır
**Gerekli:**
- Backend API kurulumu (Node.js/Express veya Firebase Functions)
- Stripe Secret Key ile Payment Intent oluşturma endpoint'i
- Webhook endpoint'i (ödeme onayı için)
- Abonelik yönetimi (aktif/pasif, süre takibi)
- Database (kullanıcı-abonelik ilişkisi)

**Dosya:** `src/services/payment.ts` - `createPaymentIntent()` fonksiyonu şu anda mock
```typescript
// ŞU AN: Mock backend
const response = await fetch('https://your-backend.com/create-payment-intent', ...);

// YAPILMALI: Gerçek backend endpoint
```

**Çözüm:**
- `server/backend-api/` klasöründe backend kurulumu yapılmalı
- Stripe webhook'ları dinlenmeli
- Gerçek Stripe Publishable Key ve Secret Key alınmalı

---

### 2. **EXPO PROJECT ID**
**Durum:** ❌ Placeholder kullanılıyor
**Gerekli:**
```bash
# EAS hesabı oluştur ve proje ID al
eas login
eas init
```

**Dosya:** `app.config.ts`
```typescript
extra: {
  eas: { projectId: process.env.EAS_PROJECT_ID || "afetnet-app-uuid-placeholder" }
}
```

**Çözüm:**
- EAS hesabı aç (https://expo.dev)
- `eas init` komutu çalıştır
- `.env` dosyasına gerçek Project ID ekle

---

### 3. **PUSH NOTIFICATION TOKEN KAYIT SİSTEMİ**
**Durum:** ❌ Token alınıyor ama backend'e kaydedilmiyor
**Gerekli:**
- Backend endpoint: `POST /api/users/register-push-token`
- Token'ı kullanıcı ID ile ilişkilendir
- Token yenileme mekanizması

**Dosya:** `src/lib/notifications.ts`
```typescript
// ŞU AN: Sadece console.log
console.log("Push token alındı:", token.data);

// YAPILMALI: Backend'e kaydet
await fetch('https://your-backend.com/api/users/register-push-token', {
  method: 'POST',
  body: JSON.stringify({ userId, token: token.data })
});
```

---

### 4. **GOOGLE SERVICES (Firebase)**
**Durum:** ❌ Yorum satırında
**Gerekli:**
- Firebase projesi oluştur
- `google-services.json` (Android) indir
- `GoogleService-Info.plist` (iOS) indir

**Dosya:** `app.config.ts`
```typescript
// googleServicesFile: "./google-services.json", // Commented out
```

**Çözüm:**
- Firebase Console'da proje oluştur
- Android ve iOS app'leri ekle
- Config dosyalarını indir ve proje root'una koy

---

### 5. **APPLE DEVELOPER HESABI (iOS Yayını İçin)**
**Durum:** ❌ Yok
**Gerekli:**
- Apple Developer Program üyeliği ($99/yıl)
- App Store Connect hesabı
- Bundle Identifier: `org.afetnet.app`
- App ID oluşturma
- Provisioning Profile
- Push Notification Certificate

**Çözüm:**
- https://developer.apple.com/programs/ adresinden kayıt ol
- App Store Connect'te uygulama oluştur

---

### 6. **GOOGLE PLAY DEVELOPER HESABI (Android Yayını İçin)**
**Durum:** ❌ Yok
**Gerekli:**
- Google Play Console hesabı ($25 tek seferlik)
- Package name: `org.afetnet.app`
- Uygulama oluşturma
- Store listing bilgileri

**Çözüm:**
- https://play.google.com/console adresinden kayıt ol
- Yeni uygulama oluştur

---

### 7. **STRIPE HESABI VE API KEYS**
**Durum:** ❌ Test key kullanılıyor
**Gerekli:**
- Stripe hesabı (https://stripe.com)
- Publishable Key (Production)
- Secret Key (Production)
- Webhook Secret
- Türkiye için ödeme yöntemleri aktif edilmeli

**Dosya:** `App.tsx`
```typescript
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_KEY || 'pk_test_51QFakeKeyForDevelopment';
```

**Çözüm:**
- Stripe hesabı aç
- KYC (Know Your Customer) sürecini tamamla
- Production key'leri al
- `.env` dosyasına ekle

---

### 8. **BACKEND API SUNUCUSU**
**Durum:** ❌ Yok
**Gerekli Endpoint'ler:**
```
POST   /api/auth/register          - Kullanıcı kaydı
POST   /api/auth/login             - Giriş
POST   /api/users/push-token       - Push token kayıt
POST   /api/payment/create-intent  - Stripe payment intent
POST   /api/payment/webhook        - Stripe webhook
GET    /api/subscription/status    - Abonelik durumu
POST   /api/sos/send               - SOS mesajı kaydet
GET    /api/sos/nearby             - Yakındaki SOS'lar
POST   /api/family/add             - Aile üyesi ekle
GET    /api/family/list            - Aile listesi
POST   /api/messages/send          - Mesaj gönder (BLE + cloud backup)
GET    /api/messages/history       - Mesaj geçmişi
```

**Çözüm:**
- `server/backend-api/` klasöründe Node.js/Express API kur
- Veya Firebase Functions kullan
- Veya Supabase/AWS Amplify gibi BaaS kullan

---

### 9. **VERİTABANI**
**Durum:** ❌ Yok
**Gerekli Tablolar:**
```sql
users (id, email, name, phone, push_token, created_at)
subscriptions (id, user_id, plan_id, status, start_date, end_date)
payments (id, user_id, amount, currency, stripe_payment_id, status)
sos_messages (id, user_id, lat, lon, message, timestamp, status)
family_members (id, user_id, member_user_id, relationship)
messages (id, from_user_id, to_user_id, content, timestamp, delivered)
```

**Çözüm:**
- PostgreSQL (Supabase)
- MySQL (PlanetScale)
- MongoDB (MongoDB Atlas)
- Firebase Firestore

---

### 10. **PRIVACY POLICY VE TERMS OF SERVICE (Zorunlu)**
**Durum:** ⚠️ Taslak var ama yayınlanmamış
**Gerekli:**
- Gizlilik Politikası (Türkçe + İngilizce)
- Kullanım Şartları
- KVKK uyumluluğu
- GDPR uyumluluğu (Avrupa için)
- Web sitesinde yayınlanmalı

**Dosyalar:** 
- `store/privacy_policy_tr.md`
- `store/privacy_policy_en.md`
- `store/eula_tr.md`
- `store/eula_en.md`

**Çözüm:**
- Bir web sitesi kur (örn: afetnet.org)
- Privacy Policy ve Terms'i yayınla
- App Store ve Play Store'a link ver

---

### 11. **UYGULAMA İKONLARI VE EKRAN GÖRÜNTÜLERİ**
**Durum:** ⚠️ Placeholder icon var
**Gerekli:**
- App Icon (1024x1024 PNG)
- Adaptive Icon (Android)
- Splash Screen
- Store Screenshots (5-8 adet, her ekran boyutu için)
- Feature Graphic (Android)
- App Preview Video (opsiyonel ama önerilen)

**Dosyalar:**
- `assets/icon.png` - ✅ Var
- `assets/splash.png` - ✅ Var
- `assets/adaptive-icon-foreground.png` - ✅ Var
- `assets/adaptive-icon-background.png` - ✅ Var

**Çözüm:**
- Profesyonel tasarımcıdan icon al
- Veya Figma/Canva ile tasarla
- Screenshot'ları gerçek cihazdan al

---

### 12. **STORE LISTING BİLGİLERİ**
**Durum:** ⚠️ Taslak var
**Gerekli:**
- Uygulama adı
- Kısa açıklama (80 karakter)
- Uzun açıklama (4000 karakter)
- Anahtar kelimeler
- Kategori (Yaşam Tarzı / Araçlar)
- İçerik derecelendirmesi
- Hedef kitle

**Dosyalar:**
- `store-listings/turkish.md` - ✅ Var
- `store-listings/english.md` - ✅ Var

---

### 13. **TEST VE KALİTE KONTROL**
**Durum:** ❌ Yapılmamış
**Gerekli:**
- Gerçek cihazda test (iOS + Android)
- BLE Mesh test (2+ cihaz)
- Offline harita test
- SOS sistemi test
- Ödeme sistemi test (Stripe test mode)
- Crash reporting (Sentry)
- Analytics (Firebase Analytics)

**Çözüm:**
- `store/qa_checklist_tr.md` dosyasını takip et
- Beta test grubu oluştur (TestFlight + Internal Testing)

---

### 14. **YASAL GEREKSINIMLER (Türkiye)**
**Durum:** ❌ Yapılmamış
**Gerekli:**
- Şirket kuruluşu veya şahıs şirketi
- Vergi levhası
- KVKK Veri Sorumlusu Sicil Kaydı
- Ticaret Sicil Gazetesi
- İmza Sirküleri

**Çözüm:**
- Bir muhasebeci ile görüş
- E-Devlet üzerinden başvuru

---

### 15. **SUNUCU ALTYAPISI VE HOSTING**
**Durum:** ❌ Yok
**Gerekli:**
- Backend API hosting (AWS/Google Cloud/Heroku/Railway)
- Database hosting
- CDN (harita tile'ları için)
- SSL sertifikası
- Domain (örn: api.afetnet.org)
- Monitoring (Uptime, Error tracking)

**Önerilen:**
- **Backend:** Railway.app (kolay + ucuz) veya AWS EC2
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **CDN:** Cloudflare
- **Monitoring:** Sentry + Uptime Robot

---

### 16. **ÇEVRE DEĞİŞKENLERİ (.env)**
**Durum:** ❌ Eksik
**Gerekli:**
```env
# Expo
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
EAS_PROJECT_ID=your-eas-project-id

# Stripe
EXPO_PUBLIC_STRIPE_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Backend API
EXPO_PUBLIC_API_URL=https://api.afetnet.org

# Firebase (opsiyonel)
EXPO_PUBLIC_FIREBASE_API_KEY=xxxxx
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxxxx
```

**Çözüm:**
- `.env` dosyası oluştur (root'ta)
- `.gitignore`'a ekle
- EAS Secrets'a ekle: `eas secret:create`

---

### 17. **AFAD API ENTEGRASYONU**
**Durum:** ⚠️ Çalışıyor ama resmi izin yok
**Gerekli:**
- AFAD'dan resmi API erişim izni
- Rate limiting
- Fallback mekanizması
- Cache stratejisi

**Dosya:** `src/services/quake/providers/afad.ts`

**Çözüm:**
- AFAD ile iletişime geç
- Resmi API key al
- Veya USGS/EMSC gibi alternatif kaynaklar kullan

---

### 18. **BLE MESH GÜVENLİK SERTİFİKALARI**
**Durum:** ⚠️ Self-signed
**Gerekli:**
- Gerçek kriptografik key yönetimi
- Key rotation
- Güvenli key storage (Secure Enclave/Keychain)

**Dosya:** `src/lib/crypto.ts`

---

### 19. **OFFLINE HARITA LİSANSLARI**
**Durum:** ⚠️ OpenStreetMap kullanılıyor
**Gerekli:**
- OSM attribution (✅ var)
- Sentinel-2 uydu görüntüleri için Copernicus lisansı (✅ açık kaynak)
- Ticari kullanım için kontrol

**Çözüm:**
- OSM ve Copernicus lisansları zaten açık kaynak
- Attribution'ları uygulama içinde göster

---

### 20. **PERFORMANS OPTİMİZASYONU**
**Durum:** ⚠️ Optimize edilmemiş
**Gerekli:**
- Bundle size optimization
- Image optimization
- Code splitting
- Lazy loading
- Memory leak kontrolü

**Çözüm:**
```bash
# Bundle analizi
npx expo export --dump-sourcemap
npx source-map-explorer dist/*.js

# Hermes engine (Android)
# app.config.ts'de zaten aktif
```

---

## 📋 YAYIN ADIMLARI (Sıralı)

### Aşama 1: Hazırlık (1-2 Hafta)
1. ✅ Tüm özellikleri tamamla (YAPILDI)
2. ❌ Backend API kur
3. ❌ Database kur
4. ❌ Stripe entegrasyonunu tamamla
5. ❌ Firebase kur
6. ❌ .env dosyasını doldur

### Aşama 2: Test (1 Hafta)
7. ❌ Gerçek cihazda test
8. ❌ BLE Mesh test (2+ cihaz)
9. ❌ Ödeme test (Stripe test mode)
10. ❌ Beta test grubu oluştur

### Aşama 3: Yasal ve İdari (1-2 Hafta)
11. ❌ Şirket kur / Şahıs şirketi
12. ❌ KVKK kaydı
13. ❌ Privacy Policy yayınla
14. ❌ Apple Developer hesabı ($99)
15. ❌ Google Play Developer hesabı ($25)

### Aşama 4: Store Hazırlık (3-5 Gün)
16. ❌ Icon ve screenshot'ları hazırla
17. ❌ Store listing'leri yaz
18. ❌ EAS build (production)
19. ❌ App Store Connect'te uygulama oluştur
20. ❌ Google Play Console'da uygulama oluştur

### Aşama 5: Yayın (1-2 Hafta)
21. ❌ iOS: TestFlight beta
22. ❌ Android: Internal Testing
23. ❌ iOS: App Store Review (7-14 gün)
24. ❌ Android: Play Store Review (1-3 gün)
25. ✅ YAYINDA!

---

## 💰 MALİYET TAHMİNİ

### Zorunlu Maliyetler:
- Apple Developer: $99/yıl
- Google Play Developer: $25 (tek seferlik)
- Domain: ~$10/yıl
- SSL Sertifikası: Ücretsiz (Let's Encrypt)
- **TOPLAM: ~$134 (ilk yıl)**

### Sunucu Maliyetleri (Aylık):
- **Başlangıç (0-1000 kullanıcı):**
  - Railway/Heroku: $5-10/ay
  - Supabase Free Tier: $0
  - **TOPLAM: ~$5-10/ay**

- **Büyüme (1000-10000 kullanıcı):**
  - Backend: $20-50/ay
  - Database: $10-25/ay
  - CDN: $5-15/ay
  - **TOPLAM: ~$35-90/ay**

### Opsiyonel Maliyetler:
- Profesyonel icon tasarımı: $50-200
- Store screenshot tasarımı: $100-300
- Muhasebe/Yasal danışmanlık: $200-500
- Sentry (Error tracking): $26/ay
- **TOPLAM: ~$350-1000 (tek seferlik) + $26/ay**

---

## 🎯 ÖNCELİK SIRASI

### 🔴 YÜKSEK ÖNCELİK (Olmadan yayınlanamaz):
1. Backend API + Database
2. Stripe Production Keys
3. EAS Project ID
4. Apple + Google Developer Hesapları
5. Privacy Policy + Terms (web sitesinde)
6. Firebase google-services.json
7. Store Listing + Screenshots

### 🟡 ORTA ÖNCELİK (Yayın sonrası 1 ay içinde):
8. Push token backend kaydı
9. AFAD resmi API izni
10. Crash reporting (Sentry)
11. Analytics
12. Beta test grubu

### 🟢 DÜŞÜK ÖNCELİK (Yayın sonrası 3 ay içinde):
13. Performance optimization
14. Bundle size reduction
15. KVKK resmi kaydı
16. Şirket kuruluşu (şahıs şirketi ile başlanabilir)

---

## 📞 DESTEK VE KAYNAKLAR

### Dokümantasyon:
- Expo: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/
- Stripe: https://stripe.com/docs
- App Store: https://developer.apple.com/app-store/review/guidelines/
- Play Store: https://play.google.com/console/about/guides/

### Topluluk:
- Expo Discord: https://chat.expo.dev
- React Native Discord: https://discord.gg/react-native
- Stripe Discord: https://discord.gg/stripe

---

## ✅ SONUÇ

**Uygulama Durumu:** 🟢 Teknik olarak hazır, backend ve yasal süreçler eksik

**Tahmini Yayın Süresi:** 3-6 hafta (backend + yasal süreçler dahil)

**Kritik Engeller:** 
1. Backend API (en önemli)
2. Stripe Production Setup
3. Developer hesapları

**Önerim:** 
1. Önce backend'i kur (Railway + Supabase ile 1-2 gün)
2. Stripe'ı test mode'da test et
3. Developer hesaplarını aç
4. Beta test başlat (TestFlight + Internal Testing)
5. Geri bildirimlere göre düzelt
6. Production'a geç

---

**Son Güncelleme:** 8 Ekim 2025
**Durum:** Tüm özellikler aktif, backend ve yasal süreçler bekleniyor

