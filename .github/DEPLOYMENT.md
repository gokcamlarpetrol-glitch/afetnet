# Deployment Dokümantasyonu

## Backend Deployment (Firebase Functions)

### Otomatik Deployment

GitHub Actions, Firebase backend kaynaklari degistiginde production deploy calistirir:

1. **`main` branch'e push yapildiginda** deploy baslar
2. **`functions/**`, Firebase rules/indexes ve `firebase.json`** degisiklikleri deploy'u tetikler
3. **Build command:** `npm --prefix functions ci && npm --prefix functions run build`
4. **Deploy command:** `firebase deploy --project afetnet-4a6b6 --only functions,firestore:rules,firestore:indexes,storage,database`

### Manuel Deployment

GitHub Actions uzerinden `Deploy Firebase Backend` workflow'u manuel tetiklenebilir.

Yerel CLI ile manuel deploy:

```bash
npm --prefix functions ci
npm --prefix functions run build
firebase deploy --project afetnet-4a6b6 --only functions,firestore:rules,firestore:indexes,storage,database
```

### Environment Variables

GitHub Actions production environment icin su secret ayarlanmalidir:

**Zorunlu:**
- `FIREBASE_SERVICE_ACCOUNT_AFETNET_4A6B6` - Firebase deploy yetkili service account JSON

**Opsiyonel:**
- `SENTRY_DSN` - Sentry error tracking DSN
- `OPENAI_API_KEY` - Firebase Functions runtime secret/env olarak tanimli olmali
- `EEW_PROVIDER_MODE` - `poll` veya `websocket`

### Smoke Check

Deploy sonrasi Functions loglari ve zamanlayici durumlari kontrol edilir:

```bash
firebase functions:log --project afetnet-4a6b6 --limit 50
firebase functions:list --project afetnet-4a6b6
```

### Deployment Checklist

- [ ] Environment variables kontrol edildi
- [ ] `npm --prefix functions run build` basarili
- [ ] `npm run verify:native-config` basarili
- [ ] Functions loglari ve zamanlayicilar kontrol edildi
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
3. **`deploy-backend.yml`** - Firebase Functions + rules deployment

### Deployment Triggers

- **Backend:** `main` branch'e push
- **Frontend:** Manuel EAS build
- **Firebase:** GitHub Actions veya manuel `firebase deploy`

---

**Son Güncelleme:** 2026-05-12
