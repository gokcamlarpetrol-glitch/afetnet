# AfetNet IAP Verification Server

## Overview
Server-side IAP verification system for AfetNet app with Apple App Store receipt validation and entitlement management.

## Features
- ✅ Apple App Store receipt verification (production & sandbox)
- ✅ User entitlement management
- ✅ Apple Server Notifications V2 webhook support
- ✅ Premium gating and subscription management
- ✅ Lifetime vs subscription product handling
- ✅ Comprehensive logging and error handling

## API Endpoints

### GET /api/iap/products
Returns only the three valid product IDs:
- `org.afetapp.premium.monthly.v2`
- `org.afetapp.premium.yearly.v2` 
- `org.afetapp.premium.lifetime.v2`

### POST /api/iap/verify
Verifies Apple receipt and sets user entitlements.

**Request:**
```json
{
  "receiptData": "base64_receipt_data",
  "userId": "user_123",
  "productId": "org.afetapp.premium.monthly.v2"
}
```

**Response:**
```json
{
  "success": true,
  "entitlements": {
    "isPremium": true,
    "productId": "org.afetapp.premium.monthly.v2",
    "expiresAt": 1704067200000,
    "source": "monthly"
  }
}
```

### GET /api/user/entitlements
Gets user entitlements.

**Query:** `?userId=user_123`

**Response:**
```json
{
  "success": true,
  "entitlements": {
    "isPremium": true,
    "source": "monthly",
    "expiresAt": 1704067200000
  }
}
```

### POST /api/iap/apple-notifications
Apple Server Notifications V2 webhook for handling:
- RENEWAL
- EXPIRED
- REFUND
- REVOKE

## Setup

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your Apple Shared Secret
```

3. **Start development server:**
```bash
npm run dev
```

4. **Build for production:**
```bash
npm run build
npm start
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `APPLE_SHARED_SECRET`: Apple App Store Shared Secret
- `JWT_SECRET`: JWT signing secret
- `LOG_LEVEL`: Logging level (info/debug/error)

## Apple App Store Configuration

1. **Get Shared Secret:**
   - Go to App Store Connect
   - Select your app
   - Go to "App Information"
   - Copy "App-Specific Shared Secret"

2. **Configure Webhook:**
   - Set webhook URL: `https://your-server.com/api/iap/apple-notifications`
   - Enable Server Notifications V2

## Security Features

- ✅ Production vs Sandbox receipt validation
- ✅ User-transaction mapping verification
- ✅ Receipt signature validation
- ✅ Comprehensive error handling
- ✅ Rate limiting (implement as needed)

## Testing

Test the server endpoints:

```bash
# Get products
curl http://localhost:3001/api/iap/products

# Check entitlements
curl "http://localhost:3001/api/user/entitlements?userId=test_user"

# Verify receipt (with actual receipt data)
curl -X POST http://localhost:3001/api/iap/verify \
  -H "Content-Type: application/json" \
  -d '{"receiptData":"...","userId":"test_user","productId":"org.afetapp.premium.monthly.v2"}'
```

## Production Deployment

1. Set up production environment variables
2. Configure Apple App Store webhook URL
3. Deploy to your hosting platform
4. Update client app with production server URL
5. Test with TestFlight sandbox purchases

## Monitoring

The server logs all IAP events:
- Purchase verifications
- Entitlement updates
- Apple notifications
- Error conditions

Monitor logs for:
- Failed receipt verifications
- Expired subscriptions
- Refund/revocation events
- Server errors
