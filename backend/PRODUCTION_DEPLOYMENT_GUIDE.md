# 🚀 AfetNet Backend - Production Deployment Kılavuzu

## 📋 ÖN HAZIRLIK

### 1. Environment Variables
```bash
# .env dosyasını oluştur
cp .env.example .env

# Gerekli değerleri doldur:
# - JWT_SECRET (güçlü bir secret key)
# - DATABASE_URL (PostgreSQL connection string)
# - FIREBASE credentials (push notifications için)
# - STRIPE keys (ödeme sistemi için)
```

### 2. Database Setup
```bash
# Prisma client oluştur
npm run prisma:generate

# Database migration
npm run prisma:migrate

# (Opsiyonel) Prisma Studio ile kontrol
npm run prisma:studio
```

## 🐳 DOCKER DEPLOYMENT (ÖNERİLEN)

### Hızlı Başlangıç
```bash
# Tüm servisleri başlat (PostgreSQL + Backend)
docker-compose up -d

# Logları izle
docker-compose logs -f backend

# Servisleri durdur
docker-compose down
```

### Production için Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: afetnet
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: .
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_CLIENT_EMAIL: ${FIREBASE_CLIENT_EMAIL}
      FIREBASE_PRIVATE_KEY: ${FIREBASE_PRIVATE_KEY}
    ports:
      - "3000:3000"
    command: sh -c "npx prisma migrate deploy && node dist/index.js"

volumes:
  postgres_data:
```

## ☁️ CLOUD DEPLOYMENT

### Railway (ÖNERİLEN - ÜCRETSİZ BAŞLANGIÇ)

```bash
# Railway CLI kur
npm i -g @railway/cli

# Login
railway login

# Yeni proje oluştur
railway init

# PostgreSQL ekle
railway add postgresql

# Environment variables ekle
railway variables set JWT_SECRET=your-secret
railway variables set STRIPE_SECRET_KEY=sk_live_[YOUR_KEY]
# ... diğer variables

# Deploy
railway up

# Logs
railway logs
```

### Render

1. GitHub'a push et
2. Render dashboard'a git
3. "New Web Service" oluştur
4. Repository'yi seç
5. Build Command: `npm install && npm run build && npx prisma generate`
6. Start Command: `npx prisma migrate deploy && npm start`
7. Environment variables ekle
8. PostgreSQL database ekle
9. Deploy

### Heroku

```bash
# Heroku CLI kur ve login
heroku login

# Yeni app oluştur
heroku create afetnet-backend

# PostgreSQL ekle
heroku addons:create heroku-postgresql:mini

# Environment variables ekle
heroku config:set JWT_SECRET=your-secret
heroku config:set STRIPE_SECRET_KEY=sk_live_[YOUR_KEY]
# ... diğer variables

# Deploy
git push heroku main

# Logs
heroku logs --tail

# Database migrate
heroku run npx prisma migrate deploy
```

### DigitalOcean App Platform

1. GitHub'a push et
2. DigitalOcean dashboard'a git
3. "Create App" → GitHub repository seç
4. Build Command: `npm install && npm run build`
5. Run Command: `npx prisma migrate deploy && npm start`
6. PostgreSQL database ekle
7. Environment variables ekle
8. Deploy

## 🔒 GÜVENLİK KONTROL LİSTESİ

### Production'a Geçmeden Önce
- [ ] JWT_SECRET değiştirildi mi? (güçlü, rastgele)
- [ ] Database password güçlü mü?
- [ ] Stripe LIVE keys kullanılıyor mu?
- [ ] Firebase production credentials kullanılıyor mu?
- [ ] CORS_ORIGIN production domain'e ayarlandı mı?
- [ ] Rate limiting aktif mi?
- [ ] Helmet security headers aktif mi?
- [ ] HTTPS kullanılıyor mu?
- [ ] Database backups yapılandırıldı mı?
- [ ] Error tracking (Sentry) kuruldu mu?
- [ ] Monitoring (Datadog/New Relic) kuruldu mu?

## 📊 MONITORING

### Health Check
```bash
curl https://your-domain.com/health
```

### Logs
```bash
# Docker
docker-compose logs -f backend

# Railway
railway logs

# Heroku
heroku logs --tail
```

### Database
```bash
# Prisma Studio (local)
npm run prisma:studio

# Production database bağlantısı
DATABASE_URL="production-url" npx prisma studio
```

## 🔄 MAINTENANCE

### Database Backup
```bash
# PostgreSQL dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20241009.sql
```

### Update Dependencies
```bash
# Check for updates
npm outdated

# Update
npm update

# Security audit
npm audit

# Fix vulnerabilities
npm audit fix
```

### Database Migration
```bash
# Create new migration
npx prisma migrate dev --name your_migration_name

# Deploy to production
npx prisma migrate deploy
```

## 🆘 TROUBLESHOOTING

### Server Crash
1. Check logs: `docker-compose logs backend`
2. Check database connection
3. Check memory usage: `docker stats`
4. Restart: `docker-compose restart backend`

### Database Connection Error
1. Check DATABASE_URL
2. Check PostgreSQL status
3. Check network connectivity
4. Check connection pool limits

### High Memory Usage
1. Check Prisma client instances (should be singleton)
2. Check for memory leaks
3. Increase container memory limit
4. Enable connection pooling

## 📞 SUPPORT

- Documentation: `/backend/README.md`
- Security Audit: `/backend/FINAL_SECURITY_AUDIT.md`
- API Docs: `http://your-domain.com/`

## ✅ PRODUCTION CHECKLIST

- [x] TypeScript build başarılı
- [x] 0 build errors
- [x] Tüm validationlar aktif
- [x] Rate limiting yapılandırıldı
- [x] Security headers eklendi
- [x] Graceful shutdown yapılandırıldı
- [x] Database schema hazır
- [x] Docker support
- [x] Documentation complete
- [x] Error handling comprehensive
- [x] Logging configured
- [x] Health checks active

**BACKEND PRODUCTION'A HAZIR!** 🚀
