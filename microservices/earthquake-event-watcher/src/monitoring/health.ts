/**
 * Health Check Service
 * Provides health check endpoints for Kubernetes
 */

import express, { Express, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config';
import { usgsClient, ambeeClient, xweatherClient, zylaClient } from '../apiClients';
import { queuePublisher } from '../queue/publisher';

export class HealthCheckService {
  private app: Express;
  private server: any;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Liveness probe
    this.app.get('/health/live', (_req: Request, res: Response) => {
      res.json({ status: 'alive', timestamp: Date.now() });
    });

    // Readiness probe
    this.app.get('/health/ready', async (_req: Request, res: Response) => {
      const checks = await this.performHealthChecks();
      const allHealthy = Object.values(checks).every((check) => check.healthy);

      const statusCode = allHealthy ? 200 : 503;
      res.status(statusCode).json({
        status: allHealthy ? 'ready' : 'not ready',
        checks,
        timestamp: Date.now(),
      });
    });

    // Detailed health check
    this.app.get('/health', async (_req: Request, res: Response) => {
      const checks = await this.performHealthChecks();
      res.json({
        status: 'ok',
        checks,
        config: {
          pollIntervalMs: config.pollIntervalMs,
          magnitudeThreshold: config.magnitudeThreshold,
          sources: ['USGS', 'Ambee', 'Xweather', 'Zyla'],
        },
        timestamp: Date.now(),
      });
    });
  }

  private async performHealthChecks(): Promise<Record<string, any>> {
    const checks: Record<string, any> = {};

    // Check API clients
    checks.usgs = {
      healthy: usgsClient.isHealthy(),
      ...usgsClient.getHealthStatus(),
    };

    checks.ambee = {
      healthy: ambeeClient.isHealthy(),
      ...ambeeClient.getHealthStatus(),
    };

    checks.xweather = {
      healthy: xweatherClient.isHealthy(),
      ...xweatherClient.getHealthStatus(),
    };

    checks.zyla = {
      healthy: zylaClient.isHealthy(),
      ...zylaClient.getHealthStatus(),
    };

    // Check queue
    checks.queue = {
      healthy: queuePublisher.isConnected(),
      connected: queuePublisher.isConnected(),
    };

    return checks;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(config.healthCheckPort, () => {
          logger.info(`Health check server started on port ${config.healthCheckPort}`);
          resolve();
        });
      } catch (error: any) {
        logger.error('Failed to start health check server', { error: error.message });
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Health check server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const healthCheckService = new HealthCheckService();

