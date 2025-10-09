import express, { Request, Response } from 'express';
import os from 'os';
import { checkDatabaseHealth, prisma } from '../utils/prisma';

const router = express.Router();

// GET /api/health - Comprehensive health check
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Check database
    const dbHealthy = await checkDatabaseHealth();

    // Check database stats
    let dbStats: any = null;
    if (dbHealthy) {
      try {
        const [userCount, messageCount, sosCount] = await Promise.all([
          prisma.user.count(),
          prisma.message.count(),
          prisma.sosAlert.count({ where: { status: 'active' } }),
        ]);

        dbStats = {
          users: userCount,
          messages: messageCount,
          activeSOS: sosCount,
        };
      } catch (error) {
        console.error('Database stats error:', error);
      }
    }

    const responseTime = Date.now() - startTime;

    const health = {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      
      // System info
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: {
          total: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          free: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          used: `${((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2)} GB`,
          processUsage: process.memoryUsage(),
        },
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'unknown',
          loadAverage: os.loadavg(),
        },
      },

      // Services
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        api: 'operational',
        socketIO: 'operational',
      },

      // Database stats (if available)
      ...(dbStats && { database: dbStats }),
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/health/ready - Readiness probe (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await checkDatabaseHealth();

    if (dbHealthy) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Database not ready' });
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'Service not ready' });
  }
});

// GET /api/health/live - Liveness probe (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

export default router;

