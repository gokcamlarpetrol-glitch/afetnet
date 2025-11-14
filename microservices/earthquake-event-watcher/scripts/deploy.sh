#!/bin/bash

# Deployment script for Earthquake Event Watcher
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
IMAGE_NAME="earthquake-event-watcher"
IMAGE_TAG="${IMAGE_NAME}:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

echo "🚀 Deploying Earthquake Event Watcher to ${ENVIRONMENT}"

# Build Docker image
echo "📦 Building Docker image..."
docker build -t ${IMAGE_TAG} -t ${IMAGE_NAME}:latest .

# Push to registry (if configured)
if [ -n "$DOCKER_REGISTRY" ]; then
  echo "📤 Pushing to registry..."
  docker tag ${IMAGE_TAG} ${DOCKER_REGISTRY}/${IMAGE_TAG}
  docker push ${DOCKER_REGISTRY}/${IMAGE_TAG}
fi

# Deploy to Kubernetes
if command -v kubectl &> /dev/null; then
  echo "☸️  Deploying to Kubernetes..."
  kubectl set image deployment/earthquake-event-watcher \
    watcher=${IMAGE_TAG} \
    --namespace=${ENVIRONMENT}
  
  kubectl rollout status deployment/earthquake-event-watcher \
    --namespace=${ENVIRONMENT}
  
  echo "✅ Deployment complete!"
else
  echo "⚠️  kubectl not found, skipping Kubernetes deployment"
fi









