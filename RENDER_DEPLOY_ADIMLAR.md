# 🚀 RENDER BACKEND DEPLOY ADIMLARI

## ✅ HAZIRLIK TAMAMLANDI
- ✅ Render.com hesabı açıldı
- ✅ GitHub bağlandı

---

## 📋 ŞİMDİ YAPILACAKLAR

### 1. PostgreSQL Database Oluştur (5 dakika)

1. **Render Dashboard → New → PostgreSQL**
2. **Ayarlar:**
   - Name: `afetnet-db`
   - Database: `afetnet`
   - User: `afetnet`
   - Region: `Frankfurt` (Türkiye'ye en yakın)
   - Instance Type: `Free`
3. **Create Database**
4. **ÖNEMLİ:** Database oluştuktan sonra:
   - **Internal Database URL'i kopyala** (postgres://...)
   - Bu URL'i kaydet, backend'e ekleyeceğiz!

---

### 2. Web Service Oluştur (10 dakika)

1. **Render Dashboard → New → Web Service**
2. **GitHub Repository Seç:**
   - `AfetNet1` repository'sini seç
   - Connect
3. **Ayarlar:**
   - **Name:** `afetnet-backend`
   - **Region:** `Frankfurt`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

---

### 3. Environment Variables Ekle (5 dakika)

**Environment Variables** bölümünde şunları ekle:

#### Temel Ayarlar
```bash
NODE_ENV=production
PORT=10000
```

#### Database
```bash
DATABASE_URL=[PostgreSQL'den kopyaladığın Internal Database URL]
```

#### JWT & Encryption (Güçlü random string'ler)
```bash
JWT_SECRET=afetnet-super-secret-jwt-key-2024-production-do-not-share-this-key-ever
ENCRYPTION_SECRET_KEY=afetnet-encryption-key-aes256-production-2024-very-strong-key
```

#### Firebase Admin SDK
```bash
FIREBASE_PROJECT_ID=afetnet-c1ca7
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@afetnet-c1ca7.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCyLxYqLQ4j/TqR
eNM3xabb0Wf5kMXq/dd3Xg2/TOHGqm+R4Vb1hvZ3alSMn07R1e0fFLPOGx3+Wj5r
OfE3XSvUYJUhJ6kgw4DXrEWFMkYg40FNoqRG0IJqxCvGL7S5YWpLabj3M3JHGj68
sr34xjX7AHBcoQmlf75t1kgXELp7+6DO8upJ0EbART1FRPXXWaHukhO2WQ05mByz
qDkQ9zepmEUwuFdhm6dL6wlCRmRlaFep1X02H8x4zzBMiKwOtca6KNki51HlRqoP
J4TpmhAyAsAgWcWvlzhq02GpKrOydpvR+6YmHfYBQF/8xyeeUGUW6ziVf/nnAo+t
UZNvWqtDAgMBAAECggEAGkVL+Mrsx0yaGoGcbqAjEkzFDiwUqilj37MLxtUwgoh1
a6Y0Gn4cD44rShJg3hoy3D7CpdQkr3AhvNBtqpJ/mE/nHNzKmEyKzgGVvGYlpcqr
waUFoHU0jUZAB/fXpu9gax76yOOaaTZK4qpdzPR4V/oAFwAdOnvjmTEbLt9mB0pa
peA3SZSfZMdmSy4U7EdmXzzP3nkdu0qiYgLrOP7YqjRtKLpQIeqA+Fo54Y2IEieC
U7hi2OJNiPZTd1pQ2Q5zdOnexMY6WMrk3UalSWRExSldFzymjgM+P988WKrB9bNU
EEtNDrmwGl009Qv1NAhgeFmVJ4BIgUc9l7B7GhQUfQKBgQDf/v2mXixU0YYKFIGk
jhTrduwl1WzxGpglcwq4PPbAlp32OvQaAURy1TFSrw7gF5+IHqQtd70x2BWf8+tG
035GwcF5ggpRLgbItLITrvCu1RZvridvqrsVVNG542WbBKP677qkec3aFeL45++L
DQzFD1xkzRPfgF0l+Ae4iz/nhwKBgQDLpHHqhXEGH6/lzIMlWWvamg8pSMRB1odR
6WALNaGLpT/s7W9UYWWUv1c9y0EeH8Zwoq/zrrkfdm46w+VBbYV1an4I1GGdvwuy
It+rRuMiIu/iX5P8XyGEs2Hc+bWAT+StX2BTmwujr/uyZcwlb8X9WWkIgQxyG7oz
dpMoHrfVZQKBgEC3lKOXu+k5rCeHazmXD3ZEos//jP1QOLtBNMysWIKmQbddqx9E
VHl1HU4NZBfc22vhpn+4g8I982mGeOi6vFZHLtYje0WfLbiZdIX5WnK5AEV+JMi/
pFPycLHrgHS8b4BV+TACPTaQckaGBJDBUXoyCPjaw64kkUUiF2D7YphLAoGAM7PB
lFhi1Lowz3g4B8CHSI36sXGfGlQcMSi+ULpCFJFVBJNXw6Wiw7w8qxyyoLJSkIBN
ieHfcGSCIftgdlcXHjN2YkmBqyo5DvYZsYOi4STboK7BhL6mZOmiPBdOBJDEL1xa
uX9Q2jMxBR8hUJPrQaJ0r0sMXOA7Sxucyv/Zjp0CgYAGtPf+7nOx3PkybO0M3wPG
3ptoGoOIP24ZHGhk1/8NlHiWNGu+UXRxCD6WQKsJFvtnq+uF0NfZZV0KY2N4vNzi
JjdccBPUDVRy8EOpua7hI0mOxHCyEOYZAEDO/k8VhnwAQXJkz8LLSkJLyhcIiucQ
Gp0VSqPZNd0TDLEEaZ8GeQ==
-----END PRIVATE KEY-----"
```

**ÖNEMLİ:** FIREBASE_PRIVATE_KEY'i tırnak içinde ve \n karakterleriyle birlikte yapıştır!

#### External APIs
```bash
AFAD_API_URL=https://deprem.afad.gov.tr/EventData/GetLast100Event
USGS_API_URL=https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
```

---

### 4. Deploy Başlat (5-10 dakika)

1. **Create Web Service** butonuna tıkla
2. **Deploy başlayacak** (5-10 dakika sürer)
3. **Logs'u izle:**
   - Build logs
   - Deploy logs
4. **Deploy tamamlandığında:**
   - URL: `https://afetnet-backend.onrender.com`

---

### 5. Database Migration (2 dakika)

Deploy tamamlandıktan sonra:

1. **Render Dashboard → afetnet-backend → Shell**
2. **Shell'de şu komutları çalıştır:**

```bash
# Prisma migration
npx prisma migrate deploy

# Database seed (opsiyonel)
npx prisma db seed
```

---

### 6. Test Et (1 dakika)

```bash
# Health check
curl https://afetnet-backend.onrender.com/health

# Beklenen sonuç:
{"status":"ok","timestamp":"2024-..."}
```

---

## 🎯 ÖZET CHECKLIST

- [ ] PostgreSQL database oluştur
- [ ] Internal Database URL'i kopyala
- [ ] Web Service oluştur
- [ ] GitHub repository bağla
- [ ] Root directory: `backend`
- [ ] Build command: `npm install && npx prisma generate && npm run build`
- [ ] Start command: `npm start`
- [ ] Environment variables ekle (11 tane)
- [ ] Create Web Service
- [ ] Deploy'u izle (5-10 dk)
- [ ] Shell'de migration çalıştır
- [ ] Health check test et

---

## 🔧 SORUN GİDERME

### Build Hatası
- Logs'u kontrol et
- `package.json` doğru mu?
- `backend/` klasörü seçili mi?

### Database Connection Hatası
- DATABASE_URL doğru mu?
- Internal Database URL kullandın mı? (External değil!)
- PostgreSQL çalışıyor mu?

### Environment Variable Hatası
- FIREBASE_PRIVATE_KEY tırnak içinde mi?
- \n karakterleri var mı?
- Tüm değişkenler eklendi mi?

---

## 📱 FRONTEND'E BACKEND URL EKLE

Deploy başarılı olduktan sonra:

```bash
# .env dosyasına ekle
EXPO_PUBLIC_API_URL=https://afetnet-backend.onrender.com
```

---

## ⚠️ ÖNEMLİ NOTLAR

### Free Tier Sınırlamaları
- **Cold Start:** 15 dakika inaktif sonrası uyur, ilk request 30 saniye sürebilir
- **750 saat/ay:** Yeterli (her zaman açık kalabilir)
- **Bandwidth:** 100 GB/ay
- **Build Minutes:** 500 dakika/ay

### Upgrade Gerekirse
- **Starter Plan:** $7/ay
- **Always on:** Cold start yok
- **Daha hızlı:** Daha güçlü CPU/RAM

---

# 🚀 BAŞARILI DEPLOY SONRASI

Backend URL'in: `https://afetnet-backend.onrender.com`

Bu URL'i:
- Frontend .env'e ekle
- Store listing'lere ekle
- Dokümantasyona ekle

**BACKEND PRODUCTION'DA! 🎉**
