# Earthquake Event Watcher

Real-time earthquake detection microservice that integrates multiple earthquake data APIs (USGS, Ambee, Xweather, Zyla) and emits normalized events to a message queue for near-instant mobile notifications.

## 🎯 Objective

Provide **minimum 10-second early warning** by detecting earthquakes from multiple sources simultaneously, deduplicating events, prioritizing by detection latency, and pushing to mobile clients via message queue.

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    USGS     │     │    Ambee    │     │  Xweather   │     │    Zyla     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Normalization     │
                          │  & Deduplication   │
                          └─────────┬──────────┘
                                    │
                          ┌─────────▼──────────┐
                          │   Message Queue    │
                          │  (RabbitMQ/Kafka)  │
                          └─────────┬──────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Flutter Mobile    │
                          │     App            │
                          └────────────────────┘
```

## 📋 Features

- **Multi-Source Integration**: Fetches from 4 APIs simultaneously (USGS, Ambee, Xweather, Zyla)
- **Real-Time Detection**: Polls every 5 seconds (configurable)
- **Intelligent Deduplication**: Matches events by location (±0.1°) and time (±3s)
- **Latency-Based Prioritization**: Fastest detection source gets priority
- **Message Queue Integration**: RabbitMQ/Kafka for reliable event delivery
- **Monitoring & Metrics**: Prometheus metrics, health checks, latency tracking
- **Kubernetes Ready**: Horizontal autoscaling, health probes, graceful shutdown
- **Early Warning**: Designed for 10+ second advance notice

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- RabbitMQ (or Kafka)
- Redis (optional, for distributed caching)
- API Keys: Ambee, Xweather, Zyla

### Installation

```bash
cd microservices/earthquake-event-watcher
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your API keys:
```env
AMBEE_API_KEY=your_ambee_key
XWEATHER_API_KEY=your_xweather_key
ZYLA_API_KEY=your_zyla_key
RABBITMQ_URL=amqp://localhost:5672
REDIS_URL=redis://localhost:6379
```

### Running Locally

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### Docker

```bash
# Build image
docker build -t earthquake-event-watcher .

# Run container
docker run --env-file .env -p 3000:3000 -p 9090:9090 earthquake-event-watcher
```

### Kubernetes

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

## 🔑 API Key Acquisition

### USGS
- **Free**: No API key required
- **Documentation**: https://earthquake.usgs.gov/fdsnws/event/1/

### Ambee
1. Sign up at https://www.getambee.com
2. Navigate to API section
3. Get your API key from dashboard
4. **Documentation**: https://www.getambee.com/api/earthquake

### Xweather
1. Sign up at https://www.xweather.com
2. Create API key in dashboard
3. **Documentation**: https://www.xweather.com/docs/weather-api/endpoints/earthquakes

### Zyla
1. Sign up at https://zylalabs.com
2. Subscribe to Earthquake Tracker API
3. Get API key from dashboard
4. **Documentation**: https://zylalabs.com/api-marketplace/data/earthquake+tracker+api/941

## 📊 Monitoring

### Health Checks

- **Liveness**: `GET /health/live`
- **Readiness**: `GET /health/ready`
- **Detailed**: `GET /health`

### Metrics (Prometheus)

- **Endpoint**: `GET /metrics`
- **Port**: 9090

**Key Metrics**:
- `earthquake_events_detected_total` - Total events detected by source
- `earthquake_events_published_total` - Total events published
- `api_request_latency_seconds` - API request latency histogram
- `api_errors_total` - API error counter
- `api_health_status` - API health gauge
- `deduplication_ratio` - Deduplication efficiency

### Logging

Structured JSON logs with Winston:
- **Console**: Development
- **Files**: Production (`logs/combined.log`, `logs/error.log`)

## ⚙️ Configuration

All configuration via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `POLL_INTERVAL_MS` | 5000 | Polling interval in milliseconds |
| `MAGNITUDE_THRESHOLD` | 3.0 | Minimum magnitude to process |
| `DEDUPLICATION_WINDOW_SECONDS` | 3 | Time window for deduplication |
| `DEDUPLICATION_DISTANCE_DEGREES` | 0.1 | Distance threshold (~11km) |
| `NOTIFICATION_COOLDOWN_SECONDS` | 60 | Cooldown between notifications for same region |
| `USER_RADIUS_KM` | 50 | Default user radius for filtering |
| `MAX_RETRIES` | 3 | Maximum retry attempts |
| `REQUEST_TIMEOUT_MS` | 10000 | API request timeout |

## 🔄 Event Flow

1. **Poll**: Every 5 seconds, fetch from all 4 APIs in parallel
2. **Normalize**: Convert each API's format to unified model
3. **Filter**: Remove events below magnitude threshold
4. **Deduplicate**: Group events by location/time, keep fastest detection
5. **Prioritize**: Sort by detection latency (lower = faster)
6. **Publish**: Send to message queue (RabbitMQ/Kafka)
7. **Mobile**: Flutter app receives, filters by user location, shows notification

## 📱 Mobile Integration (Flutter)

The Flutter app subscribes to the message queue and filters events:

```dart
// Example Flutter integration
void listenToEarthquakes() {
  // Subscribe to RabbitMQ queue
  // Filter by user location (within USER_RADIUS_KM)
  // Show push notification: "Deprem oluştu: Magnitüd X, Konum Y"
}
```

## ⚠️ Operational Concerns

### Latency

- **Target**: < 10 seconds from earthquake occurrence to notification
- **Factors**: API response time, network latency, processing time
- **Optimization**: Parallel fetching, efficient deduplication, fast queue publishing

### Rate Limits

- Each API has rate limits (check documentation)
- Service implements exponential backoff
- Monitor `api_errors_total` metric for rate limit errors

### Early Warning Caveats

⚠️ **Important**: This service provides **detection**, not **prediction**.

- **Detection Time**: Depends on API update frequency (typically 5-30 seconds)
- **Network Latency**: Adds 1-3 seconds
- **Processing**: < 1 second
- **Total**: ~6-34 seconds from occurrence to notification

For true **10-second early warning**, you need:
- P-wave detection sensors
- Seismic network integration
- Real-time data processing
- This service complements but doesn't replace official early warning systems

### Reliability

- **Fallback**: If one API fails, others continue
- **Health Checks**: Kubernetes monitors and restarts unhealthy pods
- **Message Queue**: Ensures no events are lost
- **Monitoring**: Prometheus alerts on failures

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📈 Scaling

- **Horizontal**: Kubernetes HPA scales based on CPU/memory
- **Vertical**: Increase pod resources if needed
- **Queue**: Scale RabbitMQ/Kafka for higher throughput

## 🔒 Security

- API keys stored in Kubernetes secrets
- No keys in code or Docker images
- Health endpoints don't expose sensitive data
- Metrics endpoint can be secured with authentication

## 📝 License

ISC

## 🤝 Contributing

See main project README for contribution guidelines.

## 📞 Support

For issues or questions, contact the AfetNet team.

