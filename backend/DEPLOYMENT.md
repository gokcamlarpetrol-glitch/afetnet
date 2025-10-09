# 🚀 AfetNet Backend Deployment Guide

## 📋 Deployment Options

### Option 1: Render (Recommended - Free Tier)
### Option 2: Railway ($5/month)
### Option 3: DigitalOcean ($12/month)

---

## 🎯 RENDER DEPLOYMENT (Free Tier)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub
3. Verify email

### Step 2: Create PostgreSQL Database
1. Dashboard → New → PostgreSQL
2. Name: `afetnet-db`
3. Database: `afetnet`
4. User: `afetnet`
5. Region: `Frankfurt` (closest to Turkey)
6. Plan: **Free**
7. Click "Create Database"
8. **Save the connection string!**

### Step 3: Create Web Service
1. Dashboard → New → Web Service
2. Connect GitHub repository: `AfetNet1`
3. Name: `afetnet-backend`
4. Region: `Frankfurt`
5. Branch: `main`
6. Root Directory: `backend`
7. Runtime: `Node`
8. Build Command: `npm install && npm run build`
9. Start Command: `npm start`
10. Plan: **Free**

### Step 4: Environment Variables
Add these in Render dashboard:

```bash
# Required
NODE_ENV=production
PORT=10000
DATABASE_URL=[from PostgreSQL database]

# JWT & Encryption
JWT_SECRET=[generate strong random string]
ENCRYPTION_SECRET_KEY=[generate strong random string]

# Firebase Admin SDK
FIREBASE_PROJECT_ID=afetnet-c1ca7
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@afetnet-c1ca7.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# External APIs
AFAD_API_URL=https://deprem.afad.gov.tr/EventData/GetLast100Event
USGS_API_URL=https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson

# Optional (for production features)
REDIS_URL=[if using Redis]
SENTRY_DSN=[if using Sentry]
```

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for build (5-10 minutes)
3. Check logs for errors
4. Visit: `https://afetnet-backend.onrender.com/health`

### Step 6: Run Database Migrations
```bash
# In Render Shell (Dashboard → Shell)
npx prisma migrate deploy
npx prisma db seed
```

---

## 🚀 RAILWAY DEPLOYMENT ($5/month)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify email

### Step 2: Create New Project
1. Dashboard → New Project
2. Deploy from GitHub repo
3. Select `AfetNet1` repository
4. Root Directory: `backend`

### Step 3: Add PostgreSQL
1. Project → New → Database → PostgreSQL
2. Railway automatically connects it

### Step 4: Environment Variables
Same as Render (above)

### Step 5: Deploy
1. Railway auto-deploys on git push
2. Visit: `https://[your-app].up.railway.app/health`

---

## 🌊 DIGITALOCEAN APP PLATFORM ($12/month)

### Step 1: Create DigitalOcean Account
1. Go to https://www.digitalocean.com
2. Sign up
3. Add payment method

### Step 2: Create App
1. Apps → Create App
2. Connect GitHub
3. Select `AfetNet1` repository
4. Root Directory: `backend`

### Step 3: Add PostgreSQL
1. Add Component → Database → PostgreSQL
2. Plan: Basic ($12/month)

### Step 4: Environment Variables
Same as Render (above)

### Step 5: Deploy
1. Click "Create Resources"
2. Wait for deployment
3. Visit: `https://[your-app].ondigitalocean.app/health`

---

## 🔧 POST-DEPLOYMENT CHECKLIST

### 1. Health Check
```bash
curl https://your-backend-url.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Database Connection
```bash
curl https://your-backend-url.com/api/health/db
# Should return: {"database":"connected"}
```

### 3. Test Endpoints
```bash
# Register user
curl -X POST https://your-backend-url.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Get earthquakes
curl https://your-backend-url.com/api/earthquakes/recent
```

### 4. Monitor Logs
- Check for errors
- Verify cron jobs running
- Check earthquake monitoring

### 5. Update Frontend
Update `.env` in main project:
```bash
EXPO_PUBLIC_API_URL=https://your-backend-url.com
```

---

## 📊 MONITORING

### Render
- Dashboard → Logs
- Dashboard → Metrics
- Dashboard → Events

### Railway
- Project → Deployments
- Project → Metrics
- Project → Logs

### DigitalOcean
- Apps → Insights
- Apps → Runtime Logs
- Apps → Build Logs

---

## 🔒 SECURITY CHECKLIST

- [ ] Strong JWT_SECRET (32+ characters)
- [ ] Strong ENCRYPTION_SECRET_KEY (32+ characters)
- [ ] HTTPS enabled (automatic on all platforms)
- [ ] Environment variables secured
- [ ] Database password strong
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Helmet.js configured

---

## 🐛 TROUBLESHOOTING

### Build Fails
```bash
# Check package.json scripts
# Verify all dependencies installed
# Check TypeScript errors
npm run build
```

### Database Connection Error
```bash
# Verify DATABASE_URL
# Check database is running
# Run migrations
npx prisma migrate deploy
```

### Port Issues
```bash
# Render uses PORT=10000
# Railway auto-assigns port
# Ensure app uses process.env.PORT
```

### Firebase Admin SDK Error
```bash
# Verify FIREBASE_PRIVATE_KEY has \n escaped
# Check FIREBASE_PROJECT_ID matches
# Verify service account has permissions
```

---

## 📈 SCALING

### Free Tier Limits
- **Render**: 750 hours/month, sleeps after 15 min inactivity
- **Railway**: $5 credit/month
- **DigitalOcean**: No free tier

### Upgrade Path
1. Start with Render Free
2. If traffic increases → Railway ($5)
3. If need more power → DigitalOcean ($12+)
4. If going viral → AWS/GCP with auto-scaling

---

## 🎯 RECOMMENDED: RENDER FREE TIER

**Why Render:**
- ✅ Free tier generous
- ✅ Easy setup
- ✅ PostgreSQL included
- ✅ Auto SSL
- ✅ Good for MVP

**When to upgrade:**
- Traffic > 100 requests/min
- Need faster response times
- Need always-on (no sleep)
- Need Redis/caching

---

## 📞 SUPPORT

- **Render**: https://render.com/docs
- **Railway**: https://docs.railway.app
- **DigitalOcean**: https://docs.digitalocean.com

---

# 🚀 QUICK START (Render)

```bash
1. Create account: https://render.com
2. New PostgreSQL (free)
3. New Web Service (free)
4. Connect GitHub repo
5. Add environment variables
6. Deploy!
7. Visit: https://your-app.onrender.com/health
```

**Deployment time: ~15 minutes** ⏱️


