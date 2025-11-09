# Sentry Setup Guide

## Production'da Sentry Monitoring Aktif Etme

### 1. Sentry Projesi Oluşturma

1. [Sentry.io](https://sentry.io) hesabına giriş yapın
2. Yeni proje oluşturun:
   - **Project Name:** `afetnet-backend`
   - **Platform:** `Node.js`
   - **Framework:** `Express`

### 2. DSN (Data Source Name) Alma

1. Sentry proje ayarlarına gidin
2. **Settings > Projects > afetnet-backend > Client Keys (DSN)**
3. DSN'i kopyalayın (format: `https://xxx@xxx.ingest.sentry.io/xxx`)

### 3. Render.com'da Environment Variable Ayarlama

1. Render.com dashboard'a giriş yapın
2. `afetnet-backend` servisini seçin
3. **Environment** sekmesine gidin
4. Şu environment variables'ı ekleyin/güncelleyin:

```
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENABLED=true
```

### 4. Monitoring Yapılandırması

Backend kodunda Sentry zaten yapılandırılmış:

```typescript
// server/src/monitoring.ts
monitoringService.initialize({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1, // 10% of transactions
  profilesSampleRate: 0.1, // 10% of transactions
  enabled: process.env.SENTRY_ENABLED === 'true',
});
```

### 5. Test Etme

Deployment sonrası Sentry'ye error göndermeyi test edin:

```bash
# Health check endpoint'i test et
curl https://afetnet-backend.onrender.com/health

# Sentry dashboard'da error görünmeli
```

### 6. Sentry Dashboard

Sentry dashboard'da şunları görebilirsiniz:

- **Errors:** Tüm backend hataları
- **Performance:** API endpoint performans metrikleri
- **Releases:** Her deployment bir release olarak görünür
- **Alerts:** Kritik hatalar için email/Slack bildirimleri

### 7. Alert Yapılandırması (Opsiyonel)

1. Sentry dashboard'da **Alerts** sekmesine gidin
2. Yeni alert oluşturun:
   - **Trigger:** Error count > 10 in 5 minutes
   - **Action:** Email notification
   - **Recipients:** Development team email addresses

### 8. Release Tracking

Her deployment'ı Sentry release olarak işaretlemek için:

```bash
# GitHub Actions workflow'unda otomatik yapılabilir
sentry-cli releases new $GITHUB_SHA
sentry-cli releases set-commits $GITHUB_SHA --auto
```

### 9. Environment Variables Checklist

Render.com'da şu environment variables ayarlı olmalı:

- ✅ `SENTRY_DSN` - Sentry project DSN
- ✅ `SENTRY_ENABLED` - `true` (production'da)
- ✅ `NODE_ENV` - `production`

### 10. Troubleshooting

**Sentry çalışmıyor:**
1. `SENTRY_ENABLED=true` kontrol edin
2. `SENTRY_DSN` doğru mu kontrol edin
3. Backend logs'da Sentry initialization mesajlarını kontrol edin

**Çok fazla error görünüyor:**
1. `tracesSampleRate` değerini düşürün (0.05 gibi)
2. `beforeSend` hook'unda error filtering ekleyin
3. Geliştirme ortamındaki error'ları filtreleyin

---

**Not:** Sentry free tier'da aylık 5,000 event limiti var. Production'da bu limiti aşmamak için `tracesSampleRate` ve `profilesSampleRate` değerlerini düşük tutun.

**Son Güncelleme:** 2025-01-27

