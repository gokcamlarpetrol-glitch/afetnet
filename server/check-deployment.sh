#!/bin/bash

# Backend Deployment Status Check Script
# Bu script Render.com backend servisinin deploy durumunu kontrol eder

echo "🔍 Backend Deployment Status Check"
echo "===================================="
echo ""

# Render.com service URL (değiştirin)
BACKEND_URL="${BACKEND_URL:-https://afetnet-backend.onrender.com}"

echo "📡 Checking backend at: $BACKEND_URL"
echo ""

# Health check
echo "1️⃣ Health Check Endpoint:"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BACKEND_URL/health" 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed (HTTP $HTTP_CODE)"
    echo "$HEALTH_BODY" | jq '.' 2>/dev/null || echo "$HEALTH_BODY"
else
    echo "❌ Health check failed (HTTP $HTTP_CODE)"
    echo "$HEALTH_BODY"
fi

echo ""
echo "2️⃣ Database Metrics Endpoint:"
DB_METRICS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BACKEND_URL/health/db" 2>&1)
DB_HTTP_CODE=$(echo "$DB_METRICS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
DB_BODY=$(echo "$DB_METRICS_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$DB_HTTP_CODE" = "200" ]; then
    echo "✅ Database metrics endpoint accessible (HTTP $DB_HTTP_CODE)"
    echo "$DB_BODY" | jq '.' 2>/dev/null || echo "$DB_BODY"
else
    echo "⚠️ Database metrics endpoint returned HTTP $DB_HTTP_CODE"
    echo "$DB_BODY"
fi

echo ""
echo "===================================="
echo "📊 Summary:"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Backend is deployed and running"
else
    echo "❌ Backend may not be deployed or is experiencing issues"
fi
echo ""
echo "💡 To check Render.com dashboard:"
echo "   1. Go to https://dashboard.render.com"
echo "   2. Find 'afetnet-backend' service"
echo "   3. Check service status and logs"
echo ""

