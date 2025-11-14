# Architecture Overview

## System Design

### Components

1. **API Clients** (`src/apiClients/`)
   - `usgs.ts` - USGS Earthquake Catalog API
   - `ambee.ts` - Ambee Earthquake API
   - `xweather.ts` - Xweather Earthquakes API
   - `zyla.ts` - Zyla Earthquake Tracker API
   - `base.ts` - Base client with retry logic and health tracking

2. **Normalization** (`src/normalization/`)
   - Converts all API formats to unified `NormalizedEarthquake` model
   - Handles timestamp parsing, coordinate conversion, validation

3. **Deduplication** (`src/deduplication/`)
   - Groups events by location (±0.1°) and time (±3s)
   - Prioritizes fastest detection (lowest latency)
   - Implements notification cooldown per region

4. **Message Queue** (`src/queue/`)
   - RabbitMQ publisher (primary)
   - Kafka publisher (optional)
   - Persistent message delivery

5. **Monitoring** (`src/monitoring/`)
   - Prometheus metrics
   - Health check endpoints
   - Latency tracking

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Poll Cycle (Every 5s)                    │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼───┐          ┌───▼───┐          ┌───▼───┐
    │ USGS  │          │ Ambee │          │ Xwthr │
    └───┬───┘          └───┬───┘          └───┬───┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼───────┐
                    │ Normalization │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │   Filter      │
                    │ (Magnitude ≥3)│
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │ Deduplication │
                    │ & Prioritize  │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │ Message Queue │
                    │  (RabbitMQ)   │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  Flutter App  │
                    │  (Mobile)     │
                    └───────────────┘
```

## Performance Targets

- **Detection Latency**: < 10 seconds from earthquake occurrence
- **API Polling**: Every 5 seconds
- **Processing Time**: < 1 second per cycle
- **Queue Publishing**: < 100ms per event
- **Total End-to-End**: ~6-11 seconds

## Scalability

- **Horizontal Scaling**: Kubernetes HPA (2-10 replicas)
- **Queue**: RabbitMQ cluster for high throughput
- **Caching**: Redis for deduplication and cooldown tracking
- **Database**: Optional PostgreSQL for event history

## Reliability

- **Retry Logic**: Exponential backoff for API failures
- **Circuit Breaker**: Mark APIs as degraded after 3 failures
- **Fallback**: Continue with remaining APIs if one fails
- **Health Checks**: Kubernetes liveness/readiness probes
- **Graceful Shutdown**: Cleanup on SIGTERM/SIGINT

## Security

- **API Keys**: Stored in Kubernetes secrets
- **Network**: Internal cluster communication
- **TLS**: HTTPS for external APIs
- **Rate Limiting**: Respect API rate limits

## Monitoring

- **Metrics**: Prometheus (latency, errors, events)
- **Logs**: Structured JSON logs (Winston)
- **Alerts**: Prometheus alerting rules
- **Dashboard**: Grafana visualization









