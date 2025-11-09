# Deployment Dokümantasyonu

## Backend Deployment (Render.com)

### Otomatik Deployment

Render.com, GitHub repository'nize bağlandığında otomatik olarak deploy eder:

1. **`main` branch'e push yapıldığında** otomatik deploy başlar
2. **`server/` klasöründeki değişiklikler** deploy'u tetikler
3. **Build command:** `cd server && npm install && npm run build`
4. **Start command:** `cd server && npm start`

### Manuel Deployment

Render.com dashboard'dan manuel deploy yapabilirsiniz:

1. Render.com'a giriş yapın
2. `afetnet-backend` servisini seçin
3. "Manual Deploy" butonuna tıklayın
4. Deploy edilecek commit'i seçin

### Environment Variables

Render.com'da şu environment variables ayarlanmalı:

**Zorunlu:**
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - `production`
- `PORT` - `3001`
- `ORG_SECRET` - Push notification security secret
- `APPLE_SHARED_SECRET` - IAP verification secret
- `APNS_KEY_ID` - Apple Push Notification key ID
- `APNS_TEAM_ID` - Apple Push Notification team ID
- `APNS_PRIVATE_KEY` - Apple Push Notification private key
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key

**Opsiyonel:**
- `SENTRY_DSN` - Sentry error tracking DSN
- `SENTRY_ENABLED` - `true` (production'da aktif)
- `BASE_URL` - Backend base URL (Render otomatik ayarlar)
- `EEW_PROVIDER_MODE` - `poll` veya `websocket`
- `AFAD_KANDILLI_URL` - AFAD/Kandilli API URL
- `USGS_URL` - USGS API URL
- `EMSC_URL` - EMSC API URL

### Health Check

Backend health check endpoint:

```bash
curl https://afetnet-backend.onrender.com/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2025-01-27T10:00:00.000Z",
  "database": "connected",
  "monitoring": "active"
}
```

### Deployment Checklist

- [ ] Environment variables kontrol edildi
- [ ] Database migration'lar çalıştırıldı
- [ ] Health check başarılı
- [ ] Sentry monitoring aktif
- [ ] Logs kontrol edildi
- [ ] API endpoints test edildi

## Frontend Deployment (EAS Build)

### Development Build

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

### Preview Build

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

### Production Build

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

### Submit to App Stores

```bash
# iOS App Store
eas submit --platform ios --profile production

# Google Play Store
eas submit --platform android --profile production
```

## Firebase Deployment

### Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

### Storage Rules

```bash
firebase deploy --only storage
```

### Tüm Firebase Servisleri

```bash
firebase deploy
```

## CI/CD Pipeline

### GitHub Actions Workflows

1. **`ci.yml`** - Lint, test, build check
2. **`ci_rules.yml`** - Rules-aware CI (secrets check, PR size)
3. **`deploy-backend.yml`** - Backend deployment (opsiyonel)

### Deployment Triggers

- **Backend:** `main` branch'e push
- **Frontend:** Manuel EAS build
- **Firebase:** Manuel `firebase deploy`

---

**Son Güncelleme:** 2025-01-27

