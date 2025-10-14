# Environment Variables Template

## CRITICAL: Production Environment Setup

### Frontend (.env file in root)

```bash
# EXPO PUBLIC VARIABLES (Client-side)
EAS_PROJECT_ID=072f1217-172a-40ce-af23-3fc0ad3f7f09
EXPO_PUBLIC_PROJECT_ID=072f1217-172a-40ce-af23-3fc0ad3f7f09

# Firebase Client-side (React Native)
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key

# Stripe
EXPO_PUBLIC_STRIPE_KEY=pk_live_[YOUR_PUBLISHABLE_KEY]
```

### Backend (backend/.env)

```bash
# Server
NODE_ENV=production
PORT=10000

# Database
DATABASE_URL=postgresql://user:password@host:5432/afetnet

# JWT & Encryption (CRITICAL: Must be strong)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
ENCRYPTION_SECRET_KEY=your_encryption_key_min_32_chars

# Firebase Backend (Admin SDK)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"

# Stripe
STRIPE_SECRET_KEY=sk_live_[YOUR_SECRET_KEY]
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Redis
REDIS_URL=redis://localhost:6379

# APIs
AFAD_API_URL=https://deprem.afad.gov.tr/EventData/GetLast100Event
USGS_API_URL=https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson

# CORS
CORS_ORIGIN=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

## CRITICAL Security Checklist

- [ ] JWT_SECRET is at least 32 characters
- [ ] ENCRYPTION_SECRET_KEY is at least 32 characters
- [ ] Firebase credentials are from production project
- [ ] Stripe keys are live keys (pk_live_[YOUR_KEY], sk_live_[YOUR_KEY])
- [ ] CORS_ORIGIN is not '*'
- [ ] Database URL uses SSL
- [ ] All secrets are stored in EAS Secrets / Render Environment Variables

## Never Commit

- .env files with real credentials
- google-services.json with real Firebase config
- GoogleService-Info.plist with real Firebase config

