import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

/**
 * Prometheus Metrics
 * CRITICAL: Production-grade monitoring and alerting
 * Used by Grafana, Datadog, New Relic, etc.
 */

// Create a Registry
export const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics

// HTTP Request Duration
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

// HTTP Request Counter
export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Active Connections
export const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type'], // http, websocket
});

// SOS Alerts Counter - CRITICAL
export const sosAlertsTotal = new client.Counter({
  name: 'sos_alerts_total',
  help: 'Total number of SOS alerts created',
  labelNames: ['status', 'priority'],
});

// SOS Response Time - CRITICAL
export const sosResponseTime = new client.Histogram({
  name: 'sos_response_time_seconds',
  help: 'Time from SOS creation to first response',
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

// Messages Sent Counter
export const messagesSentTotal = new client.Counter({
  name: 'messages_sent_total',
  help: 'Total number of messages sent',
  labelNames: ['type', 'encrypted'],
});

// Earthquake Alerts Counter
export const earthquakeAlertsTotal = new client.Counter({
  name: 'earthquake_alerts_total',
  help: 'Total number of earthquake alerts',
  labelNames: ['magnitude_range', 'source'],
});

// Database Query Duration
export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// Failed Login Attempts - CRITICAL
export const failedLoginAttempts = new client.Counter({
  name: 'failed_login_attempts_total',
  help: 'Total number of failed login attempts',
  labelNames: ['reason'],
});

// Premium Subscriptions
export const premiumSubscriptions = new client.Gauge({
  name: 'premium_subscriptions_active',
  help: 'Number of active premium subscriptions',
});

// Mesh Messages
export const meshMessagesTotal = new client.Counter({
  name: 'mesh_messages_total',
  help: 'Total number of mesh messages relayed',
  labelNames: ['type', 'ttl'],
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(sosAlertsTotal);
register.registerMetric(sosResponseTime);
register.registerMetric(messagesSentTotal);
register.registerMetric(earthquakeAlertsTotal);
register.registerMetric(dbQueryDuration);
register.registerMetric(failedLoginAttempts);
register.registerMetric(premiumSubscriptions);
register.registerMetric(meshMessagesTotal);

/**
 * Metrics middleware
 * CRITICAL: Tracks all HTTP requests
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route?.path || req.path;

    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });

  next();
};

/**
 * Get metrics endpoint handler
 */
export async function getMetrics(req: Request, res: Response) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
}

