# Setup Guide - Earthquake Event Watcher

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd microservices/earthquake-event-watcher
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Start Dependencies

**RabbitMQ** (using Docker):
```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
```

**Redis** (using Docker):
```bash
docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 4. Run Service

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

### 5. Verify

- Health check: http://localhost:3000/health
- Metrics: http://localhost:9090/metrics

## 🔑 API Key Setup

### Ambee
1. Visit https://www.getambee.com
2. Sign up for free account
3. Navigate to API section
4. Copy your API key

### Xweather
1. Visit https://www.xweather.com
2. Sign up and create API key
3. Copy API key to `.env`

### Zyla
1. Visit https://zylalabs.com
2. Subscribe to Earthquake Tracker API
3. Get API key from dashboard

## 🐳 Docker Deployment

```bash
# Build
docker build -t earthquake-event-watcher .

# Run
docker run --env-file .env \
  -p 3000:3000 \
  -p 9090:9090 \
  earthquake-event-watcher
```

## ☸️ Kubernetes Deployment

```bash
# Create secrets
kubectl create secret generic earthquake-watcher-secrets \
  --from-literal=ambee-api-key=YOUR_KEY \
  --from-literal=xweather-api-key=YOUR_KEY \
  --from-literal=zyla-api-key=YOUR_KEY

# Deploy
kubectl apply -f kubernetes/deployment.yaml

# Check status
kubectl get pods -l app=earthquake-event-watcher
kubectl logs -f deployment/earthquake-event-watcher
```

## 📊 Monitoring Setup

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'earthquake-watcher'
    static_configs:
      - targets: ['earthquake-event-watcher:9090']
```

### Grafana Dashboard

Import dashboard JSON (create from Prometheus metrics):
- `earthquake_events_detected_total`
- `api_request_latency_seconds`
- `api_health_status`

## 🔧 Troubleshooting

### API Errors
- Check API keys in `.env`
- Verify API rate limits
- Check network connectivity

### Queue Connection Failed
- Verify RabbitMQ is running: `docker ps | grep rabbitmq`
- Check `RABBITMQ_URL` in `.env`
- Test connection: `telnet localhost 5672`

### High Latency
- Check API response times in metrics
- Verify network connection
- Consider increasing `POLL_INTERVAL_MS` if APIs are slow

## 📝 Next Steps

1. Set up Flutter app to consume from queue (see `flutter-integration-example.md`)
2. Configure Prometheus alerts
3. Set up Grafana dashboards
4. Monitor metrics and adjust thresholds









