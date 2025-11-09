# Backend Deployment Status Check

## Render.com Deployment Configuration

### Service Configuration (`render.yaml`)
- **Service Name**: `afetnet-backend`
- **Type**: Web Service
- **Runtime**: Node.js
- **Region**: Frankfurt
- **Plan**: Free
- **Build Command**: `cd server && npm install && npm run build`
- **Start Command**: `cd server && npm start`
- **Health Check Path**: `/health`

### Required Environment Variables

#### 🔴 ZORUNLU (Backend çalışmaz)
1. **DATABASE_URL** - PostgreSQL connection string
2. **APNS_KEY_ID** - Apple Push Notification Key ID
3. **APNS_TEAM_ID** - Apple Developer Team ID
4. **APNS_PRIVATE_KEY** - Apple Push Notification Private Key
5. **FIREBASE_PROJECT_ID** - Firebase Project ID
6. **FIREBASE_CLIENT_EMAIL** - Firebase Service Account Email
7. **FIREBASE_PRIVATE_KEY** - Firebase Private Key
8. **APPLE_SHARED_SECRET** - Apple IAP Shared Secret
9. **ORG_SECRET** - Push Notification Authentication Secret
10. **BASE_URL** - Server Base URL (deploy sonrası Render URL'i)

#### 🟡 OPSİYONEL
- **SENTRY_DSN** - Error tracking (default: disabled)
- **SENTRY_ENABLED** - "false" (default)
- **EEW_PROVIDER_MODE** - "poll" (default)
- **AFAD_KANDILLI_URL** - Default URL set
- **USGS_URL** - Default URL set
- **EMSC_URL** - Default URL set

## Deployment Checklist

### Pre-Deployment
- [x] `render.yaml` configured
- [x] Build command: `cd server && npm install && npm run build`
- [x] Start command: `cd server && npm start`
- [x] Health check path: `/health`
- [x] Migration files included in build (`copy-migrations` script)
- [x] Database initialization code added
- [x] Elite database features implemented

### Environment Variables Setup
- [ ] `DATABASE_URL` - PostgreSQL connection string from Render PostgreSQL service
- [ ] `APNS_KEY_ID` - From Apple Developer Portal
- [ ] `APNS_TEAM_ID` - From Apple Developer Account
- [ ] `APNS_PRIVATE_KEY` - From Apple Developer Portal (.p8 file)
- [ ] `FIREBASE_PROJECT_ID` - From Firebase Console
- [ ] `FIREBASE_CLIENT_EMAIL` - From Firebase Service Account JSON
- [ ] `FIREBASE_PRIVATE_KEY` - From Firebase Service Account JSON
- [ ] `APPLE_SHARED_SECRET` - From App Store Connect
- [ ] `ORG_SECRET` - Generated random string (min 32 chars)
- [ ] `BASE_URL` - Render service URL (after first deploy)

### Post-Deployment Verification

#### 1. Health Check
```bash
curl https://afetnet-backend.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-...",
  "database": {
    "connected": true,
    "health": "healthy"
  },
  "pool": {
    "total": 2,
    "idle": 2,
    "active": 0,
    "waiting": 0,
    "max": 20,
    "utilization": "10%"
  },
  "metrics": {
    "totalQueries": 0,
    "failedQueries": 0,
    "averageQueryTime": "0ms",
    "slowQueries": 0,
    "connectionErrors": 0
  },
  "monitoring": "disabled"
}
```

#### 2. Database Metrics Endpoint
```bash
curl https://afetnet-backend.onrender.com/health/db
```

**Expected Response:**
```json
{
  "total": 2,
  "idle": 2,
  "active": 0,
  "waiting": 0,
  "metrics": {
    "totalConnections": 2,
    "idleConnections": 2,
    "activeConnections": 0,
    "waitingRequests": 0,
    "totalQueries": 0,
    "failedQueries": 0,
    "averageQueryTime": 0,
    "slowQueries": 0,
    "connectionErrors": 0
  },
  "health": "healthy",
  "activeConnections": [],
  "timestamp": "2024-..."
}
```

#### 3. Database Connection Test
- Check logs for: `✅ Database connection successful`
- Check logs for: `✅ Database migrations completed`
- Check logs for: `✅ Schema validation passed`
- Check logs for: `✅ Configuration validation passed`

#### 4. Service Status
- Check Render.com dashboard for service status
- Verify build completed successfully
- Verify service is running (green status)
- Check logs for any errors

## Common Issues & Solutions

### Issue: Build Failed
**Solution**: 
- Check `server/package.json` build script
- Verify TypeScript compilation succeeds locally: `cd server && npm run build`
- Check for missing dependencies

### Issue: Database Connection Failed
**Solution**:
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running on Render
- Verify SSL mode is `require` in connection string

### Issue: Service Won't Start
**Solution**:
- Check logs for missing environment variables
- Verify all required env vars are set
- Check `startCommand` is correct: `cd server && npm start`

### Issue: Health Check Failing
**Solution**:
- Verify `/health` endpoint exists
- Check database connection
- Verify migrations ran successfully

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "feat: Backend updates"
   git push
   ```

2. **Render.com Auto-Deploy**
   - Render automatically detects GitHub push
   - Starts build process
   - Runs migrations on startup
   - Starts service

3. **Verify Deployment**
   - Check Render dashboard
   - Test `/health` endpoint
   - Check logs for errors
   - Verify database connection

4. **Set BASE_URL**
   - After first deploy, get Render URL
   - Add `BASE_URL` environment variable
   - Redeploy if necessary

## Current Status

**Last Commit**: `2a83d9d` - Backend ve database elite seviyeye çıkarıldı

**Features Implemented**:
- ✅ Elite database connection pool
- ✅ Advanced monitoring and metrics
- ✅ Connection leak detection
- ✅ Circuit breaker pattern
- ✅ Query performance tracking
- ✅ Slow query detection
- ✅ Transaction management
- ✅ Database schema validation
- ✅ Automatic migrations
- ✅ Health check endpoints
- ✅ Graceful shutdown

**Next Steps**:
1. Verify Render.com deployment status
2. Check environment variables are set
3. Test health endpoints
4. Verify database connection
5. Monitor logs for any issues

