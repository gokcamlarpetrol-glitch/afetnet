# Deployment Guide

## 🚀 Production Deployment

### Prerequisites

- Kubernetes cluster (v1.20+)
- RabbitMQ or Kafka cluster
- Redis cluster (optional but recommended)
- Docker registry access
- API keys for Ambee, Xweather, Zyla

### Step 1: Build and Push Docker Image

```bash
# Build
docker build -t your-registry/earthquake-event-watcher:latest .

# Push
docker push your-registry/earthquake-event-watcher:latest
```

### Step 2: Create Kubernetes Secrets

```bash
kubectl create secret generic earthquake-watcher-secrets \
  --from-literal=ambee-api-key=YOUR_AMBEE_KEY \
  --from-literal=xweather-api-key=YOUR_XWEATHER_KEY \
  --from-literal=zyla-api-key=YOUR_ZYLA_KEY \
  --namespace=production
```

### Step 3: Deploy RabbitMQ

```bash
# Using RabbitMQ Operator or Helm
helm install rabbitmq bitnami/rabbitmq \
  --set auth.username=admin \
  --set auth.password=YOUR_PASSWORD
```

### Step 4: Deploy Redis (Optional)

```bash
helm install redis bitnami/redis \
  --set auth.password=YOUR_PASSWORD
```

### Step 5: Update Deployment YAML

Edit `kubernetes/deployment.yaml`:
- Update image registry
- Update RabbitMQ URL
- Update Redis URL
- Adjust resource limits

### Step 6: Deploy Service

```bash
kubectl apply -f kubernetes/deployment.yaml
```

### Step 7: Verify Deployment

```bash
# Check pods
kubectl get pods -l app=earthquake-event-watcher

# Check logs
kubectl logs -f deployment/earthquake-event-watcher

# Check health
kubectl port-forward svc/earthquake-event-watcher 3000:3000
curl http://localhost:3000/health
```

## 📊 Monitoring Setup

### Prometheus

Add scrape config:

```yaml
scrape_configs:
  - job_name: 'earthquake-watcher'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: earthquake-event-watcher
```

### Grafana Dashboard

Import dashboard JSON with these panels:
- Events detected per minute (by source)
- API latency histogram
- API health status
- Queue size
- Deduplication ratio

## 🔧 Troubleshooting

### Pods Not Starting

```bash
# Check events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Common issues:
# - Missing secrets
# - Wrong image registry
# - Resource limits too low
```

### API Connection Failures

```bash
# Test from pod
kubectl exec -it <pod-name> -- curl https://api.getambee.com/v1/earthquake

# Check network policies
kubectl get networkpolicies
```

### High Memory Usage

- Increase pod memory limits
- Reduce `MAX_EVENTS` in API store
- Enable Redis for distributed caching

## 🔄 Updates

```bash
# Rolling update
kubectl set image deployment/earthquake-event-watcher \
  watcher=your-registry/earthquake-event-watcher:v1.1.0

# Rollback if needed
kubectl rollout undo deployment/earthquake-event-watcher
```

## 📈 Scaling

The HPA automatically scales based on CPU/memory:

```bash
# Check HPA status
kubectl get hpa earthquake-event-watcher-hpa

# Manual scaling
kubectl scale deployment/earthquake-event-watcher --replicas=5
```

