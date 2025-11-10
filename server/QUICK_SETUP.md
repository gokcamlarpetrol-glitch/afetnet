# 🚀 Backend Quick Setup Guide

## Render.com Deploy için Hızlı Kurulum

### 1️⃣ Otomatik Eklenen Değerler (render.yaml'da)

Bu değerler `render.yaml` dosyasında zaten tanımlı ve otomatik eklenir:

✅ **NODE_ENV** = "production"  
✅ **PORT** = 3001  
✅ **APNS_BUNDLE_ID** = "com.gokhancamci.afetnetapp"  
✅ **SENTRY_ENABLED** = "false"  
✅ **EEW_PROVIDER_MODE** = "poll"  
✅ **AFAD_KANDILLI_URL** = "https://deprem.afad.gov.tr/apiv2/event/latest?limit=100"  
✅ **USGS_URL** = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=3.0&orderby=time&limit=100"  
✅ **EMSC_URL** = "https://www.seismicportal.eu/StandingProducts/fdsnws/event/1/query?format=json&minmagnitude=3.0&limit=100"  

---

### 2️⃣ Manuel Eklenmesi Gerekenler

Render.com Dashboard → Your Service → Environment → "Add Environment Variable"

#### 🔴 ZORUNLU (Backend çalışması için gerekli):

1. **DATABASE_URL**
   ```
   postgresql://user:password@host:port/database?sslmode=require
   ```
   - Render.com PostgreSQL servisi oluşturulduğunda otomatik oluşturulur
   - PostgreSQL servisinin "Internal Database URL" değerini kopyalayın

2. **ORG_SECRET**
   ```bash
   # Terminal'de çalıştırın:
   openssl rand -base64 32
   ```
   - Çıkan değeri kopyalayın ve Render'a ekleyin
   - Veya `server/GENERATE_ORG_SECRET.sh` scriptini çalıştırın

3. **BASE_URL**
   ```
   https://afetnet-backend.onrender.com
   ```
   - İlk deploy sonrası Render otomatik URL oluşturur
   - Deploy sonrası bu URL'i kopyalayıp BASE_URL olarak ekleyin

#### 🟡 APPLE PUSH NOTIFICATIONS (iOS için zorunlu):

4. **APNS_KEY_ID**
   - Apple Developer Portal → Certificates, Identifiers & Profiles → Keys
   - APNs Key oluşturun ve Key ID'yi kopyalayın

5. **APNS_TEAM_ID**
   - Apple Developer Portal → Membership
   - Team ID'yi kopyalayın

6. **APNS_PRIVATE_KEY**
   - APNs Key oluştururken indirilen `.p8` dosyasının içeriği
   - Tüm içeriği kopyalayın (-----BEGIN PRIVATE KEY----- ile başlayan)
   - Render'da multi-line olarak ekleyin veya `\n` ile tek satır yapın

#### 🟡 FIREBASE (Android için zorunlu):

7. **FIREBASE_PROJECT_ID**
   - Firebase Console → Project Settings → General
   - Project ID'yi kopyalayın

8. **FIREBASE_CLIENT_EMAIL**
   - Firebase Console → Project Settings → Service Accounts
   - "Generate New Private Key" ile JSON indirin
   - JSON'dan `client_email` değerini kopyalayın

9. **FIREBASE_PRIVATE_KEY**
   - İndirdiğiniz JSON'dan `private_key` değerini kopyalayın
   - Render'da multi-line olarak ekleyin veya `\n` ile tek satır yapın

#### 🟡 APPLE IAP (Premium özellikler için zorunlu):

10. **APPLE_SHARED_SECRET**
    - App Store Connect → Your App → App Information
    - "App-Specific Shared Secret" bölümünden kopyalayın

---

### 3️⃣ Opsiyonel (Eklenebilir):

11. **SENTRY_DSN** (Opsiyonel)
    - Sentry.io hesabından proje oluşturun
    - DSN'i kopyalayın
    - `SENTRY_ENABLED` = "true" yapın

12. **OFFICIAL_WSS_URL** (Opsiyonel)
    - Resmi WebSocket URL'i varsa ekleyin

13. **OFFICIAL_WSS_TOKEN** (Opsiyonel)
    - WebSocket authentication token varsa ekleyin

---

## 📋 Kontrol Listesi

Deploy öncesi:

- [ ] PostgreSQL servisi Render'da oluşturuldu
- [ ] `DATABASE_URL` eklendi
- [ ] `ORG_SECRET` oluşturuldu ve eklendi
- [ ] `BASE_URL` eklendi (deploy sonrası)
- [ ] APNs credentials eklendi (iOS için)
- [ ] Firebase credentials eklendi (Android için)
- [ ] `APPLE_SHARED_SECRET` eklendi (Premium için)

---

## 🧪 Test

Deploy sonrası:

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
   - Veya Render'ın multi-line editor'ünü kullanın

2. **ORG_SECRET**: 
   - Bu secret'ı client uygulamada da kullanmanız gerekecek
   - Güvenli bir yerde saklayın

3. **BASE_URL**: 
   - İlk deploy'da Render otomatik URL oluşturur
   - Deploy sonrası bu URL'i `BASE_URL` olarak ekleyin
   - Custom domain kullanıyorsanız onu ekleyin

4. **Database Migration**: 
   - İlk deploy'da database migration'ı manuel çalıştırmanız gerekebilir
   - Render PostgreSQL servisine bağlanıp `server/src/migrations/001_create_iap_tables.sql` dosyasını çalıştırın

