/**
 * Configuration Module
 * Loads and validates environment variables
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  // API Keys
  usgsApiKey: z.string().optional(),
  ambeeApiKey: z.string().min(1, 'AMBEE_API_KEY is required'),
  xweatherApiKey: z.string().min(1, 'XWEATHER_API_KEY is required'),
  zylaApiKey: z.string().min(1, 'ZYLA_API_KEY is required'),

  // Message Queue
  rabbitmqUrl: z.string().default('amqp://localhost:5672'),
  rabbitmqExchange: z.string().default('earthquake.events'),
  rabbitmqRoutingKey: z.string().default('earthquake.detected'),
  
  kafkaBrokers: z.string().optional(),
  kafkaTopic: z.string().default('earthquake.events'),
  kafkaClientId: z.string().default('earthquake-watcher'),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),
  redisTtlSeconds: z.number().default(3600),

  // Service Configuration
  pollIntervalMs: z.number().min(1000).default(5000),
  magnitudeThreshold: z.number().min(0).default(3.0),
  deduplicationWindowSeconds: z.number().min(1).default(3),
  deduplicationDistanceDegrees: z.number().min(0.01).default(0.1),
  notificationCooldownSeconds: z.number().min(1).default(60),
  userRadiusKm: z.number().min(1).default(50),

  // Performance
  maxRetries: z.number().min(1).default(3),
  retryBackoffBaseMs: z.number().min(100).default(1000),
  requestTimeoutMs: z.number().min(1000).default(10000),
  healthCheckPort: z.number().min(1).max(65535).default(3000),

  // Monitoring
  metricsPort: z.number().min(1).max(65535).default(9090),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Kubernetes
  podName: z.string().optional(),
  namespace: z.string().default('default'),
});

type Config = z.infer<typeof ConfigSchema>;

function parseConfig(): Config {
  const raw = {
    usgsApiKey: process.env.USGS_API_KEY,
    ambeeApiKey: process.env.AMBEE_API_KEY,
    xweatherApiKey: process.env.XWEATHER_API_KEY,
    zylaApiKey: process.env.ZYLA_API_KEY,
    rabbitmqUrl: process.env.RABBITMQ_URL,
    rabbitmqExchange: process.env.RABBITMQ_EXCHANGE,
    rabbitmqRoutingKey: process.env.RABBITMQ_ROUTING_KEY,
    kafkaBrokers: process.env.KAFKA_BROKERS,
    kafkaTopic: process.env.KAFKA_TOPIC,
    kafkaClientId: process.env.KAFKA_CLIENT_ID,
    redisUrl: process.env.REDIS_URL,
    redisTtlSeconds: parseInt(process.env.REDIS_TTL_SECONDS || '3600', 10),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
    magnitudeThreshold: parseFloat(process.env.MAGNITUDE_THRESHOLD || '3.0'),
    deduplicationWindowSeconds: parseInt(process.env.DEDUPLICATION_WINDOW_SECONDS || '3', 10),
    deduplicationDistanceDegrees: parseFloat(process.env.DEDUPLICATION_DISTANCE_DEGREES || '0.1'),
    notificationCooldownSeconds: parseInt(process.env.NOTIFICATION_COOLDOWN_SECONDS || '60', 10),
    userRadiusKm: parseInt(process.env.USER_RADIUS_KM || '50', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryBackoffBaseMs: parseInt(process.env.RETRY_BACKOFF_BASE_MS || '1000', 10),
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10),
    healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3000', 10),
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
    podName: process.env.POD_NAME,
    namespace: process.env.NAMESPACE || 'default',
  };

  return ConfigSchema.parse(raw);
}

export const config = parseConfig();
export type { Config };

