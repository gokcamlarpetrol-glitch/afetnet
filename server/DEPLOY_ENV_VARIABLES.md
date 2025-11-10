# Backend Deploy Environment Variables

## Render.com Environment Variables Setup Guide

Bu dosya, Render.com'da backend servisini deploy ederken eklenmesi gereken tüm environment variables'ları içerir.

---

## 🔴 ZORUNLU Environment Variables

Bu variables olmadan backend çalışmaz veya kritik özellikler çalışmaz.

### 1. Database Configuration
```bash
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```
- **Açıklama**: PostgreSQL database connection string
- **Nereden alınır**: Render.com PostgreSQL servisi oluşturulduğunda otomatik oluşturulur
- **Önem**: ⚠️ ZORUNLU - Backend başlamaz

### 2. Apple Push Notification Service (APNs)
```bash
APNS_KEY_ID=ABC123XYZ
APNS_TEAM_ID=TEAM123456
APNS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```
- **Açıklama**: iOS push notification göndermek için gerekli
- **Nereden alınır**: 
  - Apple Developer Portal → Certificates, Identifiers & Profiles → Keys
  - APNs Key oluşturulur ve Key ID alınır
  - Team ID: Apple Developer hesabının Team ID'si
  - Private Key: İndirilen .p8 dosyasının içeriği (newline'ları `\n` olarak)
- **Önem**: ⚠️ ZORUNLU - iOS push notification çalışmaz

### 3. Firebase Cloud Messaging (FCM)
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```
- **Açıklama**: Android push notification göndermek için gerekli
- **Nereden alınır**: 
  - Firebase Console → Project Settings → Service Accounts
  - "Generate New Private Key" ile JSON dosyası indirilir
  - JSON'dan `project_id`, `client_email`, `private_key` alınır
- **Önem**: ⚠️ ZORUNLU - Android push notification çalışmaz

### 4. Apple In-App Purchase Verification
```bash
APPLE_SHARED_SECRET=your-apple-shared-secret
```
- **Açıklama**: Apple App Store receipt doğrulama için gerekli
- **Nereden alınır**: 
  - App Store Connect → Your App → App Information
  - "App-Specific Shared Secret" bölümünden alınır
- **Önem**: ⚠️ ZORUNLU - Premium satın alma doğrulaması çalışmaz

### 5. Push Notification Security
```bash
ORG_SECRET=your-random-secret-key-min-32-chars
```
- **Açıklama**: Push notification endpoint'lerine erişim için authentication secret
- **Nasıl oluşturulur**: 
  - Güçlü bir random string (en az 32 karakter)
  - Örnek: `openssl rand -base64 32`
- **Önem**: ⚠️ ZORUNLU - Push notification endpoint'leri çalışmaz

### 6. Server Base URL
```bash
BASE_URL=https://afetnet-backend.onrender.com
```
- **Açıklama**: Server'ın public URL'i
- **Nereden alınır**: Render.com deploy edildikten sonra otomatik oluşturulan URL
- **Önem**: ⚠️ ZORUNLU - Earthquake warning servisi çalışmaz

---

## 🟡 OPSİYONEL Environment Variables

Bu variables olmadan da backend çalışır ama bazı özellikler devre dışı kalır.

### 7. Sentry Monitoring (Opsiyonel)
```bash
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ENABLED=false
```
- **Açıklama**: Error tracking ve monitoring için
- **Nereden alınır**: Sentry.io hesabından proje oluşturulduğunda DSN alınır
- **Önem**: ✅ OPSİYONEL - Monitoring olmadan da çalışır

### 8. Early Earthquake Warning Providers (Opsiyonel)
```bash
EEW_PROVIDER_MODE=poll
AFAD_KANDILLI_URL=https://deprem.afad.gov.tr/apiv2/event/latest
USGS_URL=https://earthquake.usgs.gov/fdsnws/event/1/query
EMSC_URL=https://www.seismicportal.eu/StandingProducts/fdsnws/event/1/query
OFFICIAL_WSS_URL=wss://example.com/eew
OFFICIAL_WSS_TOKEN=your-token
```
- **Açıklama**: Erken deprem uyarı sistemi için ek data source'lar
- **Önem**: ✅ OPSİYONEL - Default olarak AFAD API kullanılır

---

## 📋 Render.com'da Ekleme Adımları

1. **Render Dashboard'a git**: https://dashboard.render.com
2. **Servisinizi seçin**: `afetnet-backend`
3. **Environment sekmesine git**
4. **"Add Environment Variable" butonuna tıkla**
5. **Her bir variable için:**
   - Key: Yukarıdaki key adını girin
   - Value: Değeri girin
   - **Önemli**: Multi-line values (APNS_PRIVATE_KEY, FIREBASE_PRIVATE_KEY) için:
     - Newline karakterlerini `\n` olarak girin
     - Veya Render'ın multi-line editor'ünü kullanın

---

## ✅ Kontrol Listesi

Deploy öncesi kontrol edin:

- [ ] `DATABASE_URL` eklendi ve geçerli
- [ ] `APNS_KEY_ID` eklendi
- [ ] `APNS_TEAM_ID` eklendi
- [ ] `APNS_PRIVATE_KEY` eklendi (newline'lar `\n` olarak)
- [ ] `FIREBASE_PROJECT_ID` eklendi
- [ ] `FIREBASE_CLIENT_EMAIL` eklendi
- [ ] `FIREBASE_PRIVATE_KEY` eklendi (newline'lar `\n` olarak)
- [ ] `APPLE_SHARED_SECRET` eklendi
- [ ] `ORG_SECRET` eklendi (güçlü random string)
- [ ] `BASE_URL` eklendi (deploy sonrası Render URL'i)
- [ ] `SENTRY_DSN` eklendi (opsiyonel)
- [ ] `SENTRY_ENABLED` = "false" (opsiyonel)

---

## 🔍 Test Etme

Deploy sonrası test:

```bash
# Health check
curl https://your-backend-url.onrender.com/health

# Beklenen response:
{
  "status": "OK",
  "timestamp": "2024-...",
  "database": "connected",
  "monitoring": "active"
}
```

---

## ⚠️ Önemli Notlar

1. **Private Key Formatı**: 
   - APNS ve Firebase private key'leri multi-line string'lerdir
   - Render.com'da newline karakterlerini `\n` olarak girin
   - Örnek: `-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----`

2. **BASE_URL**: 
   - İlk deploy'da Render otomatik URL oluşturur
   - Deploy sonrası bu URL'i `BASE_URL` olarak ekleyin
   - Veya custom domain kullanıyorsanız onu ekleyin

3. **ORG_SECRET**: 
   - Güçlü bir random string kullanın
   - En az 32 karakter olmalı
   - Bu secret'ı client uygulamada da kullanmanız gerekecek

4. **Database Migration**: 
   - İlk deploy'da database migration'ı manuel çalıştırmanız gerekebilir
   - `server/src/migrations/001_create_iap_tables.sql` dosyasını çalıştırın

---

## 🆘 Sorun Giderme

### Database Connection Failed
- `DATABASE_URL` doğru mu kontrol edin
- Render PostgreSQL servisinin çalıştığından emin olun
- SSL mode'un `require` olduğundan emin olun

### Push Notifications Çalışmıyor
- APNs credentials doğru mu kontrol edin
- Firebase credentials doğru mu kontrol edin
- `ORG_SECRET` client'ta da aynı mı kontrol edin

### IAP Verification Çalışmıyor
- `APPLE_SHARED_SECRET` doğru mu kontrol edin
- App Store Connect'te Shared Secret'ın aktif olduğundan emin olun

