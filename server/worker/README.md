# AfetNet FCM Worker

Bu Cloudflare Worker, deprem verilerini izler ve FCM push bildirimleri gönderir.

## Deployment

### Cloudflare Workers CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy

# Set environment variables
wrangler secret put FCM_SERVER_KEY
wrangler secret put ORG_SECRET
```

### Environment Variables

- `FCM_SERVER_KEY`: Firebase Cloud Messaging server key
- `ORG_SECRET`: Client authentication secret
- `PROVIDER`: "AFAD" or "KANDILLI" (default: "AFAD")
- `POLL_MS`: Polling interval in ms (default: 5000)
- `MAG_MIN`: Minimum magnitude threshold (default: 3.5)

## Endpoints

- `GET /health` - Health check
- `POST /register` - Register FCM token with provinces
- `POST /unregister` - Unregister FCM token
- `GET /tick` - Manual trigger (for testing)

## Usage

1. Deploy worker to Cloudflare
2. Set environment variables
3. Configure client app with worker URL
4. Users register for province notifications

## iOS Notes

iOS background pushes require APNs (Apple) and FCM v1 setup. This implementation focuses on Android FCM. iOS users can still use foreground Live mode.

## Testing

```bash
# Health check
curl https://your-worker.dev/health

# Manual trigger
curl https://your-worker.dev/tick
```