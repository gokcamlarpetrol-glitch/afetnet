import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer } from 'http';
import cron from 'node-cron';
import { Server } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger';

// Load environment variables
dotenv.config();

// CRITICAL: Validate environment variables before starting
import { validateEnv } from './utils/env';
validateEnv();

// Import routes
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import earthquakeRoutes from './routes/earthquake';
import familyRoutes from './routes/family';
import healthRoutes from './routes/health';
import meshRoutes from './routes/mesh';
import messageRoutes from './routes/message';
import paymentRoutes from './routes/payment';
import sosRoutes from './routes/sos';
import userRoutes from './routes/user';

// Import services
import { startEarthquakeMonitoring } from './services/earthquake';
import { initializeFirebase } from './services/firebase';
import { processNotificationQueue } from './services/notificationQueue';
import { setupSocketHandlers } from './services/socket';

// Import middleware
import { apiVersion } from './middleware/apiVersion';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { requestId } from './middleware/requestId';
import { logger } from './utils/logger';
import { getMetrics, metricsMiddleware } from './utils/metrics';
import { checkDatabaseHealth, disconnectPrisma, prisma } from './utils/prisma';

const app: Application = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security headers - CRITICAL: Protects against common attacks
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Compression - CRITICAL: Reduces bandwidth usage
app.use(compression());

// CORS - CRITICAL: Prevents unauthorized cross-origin requests
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',') 
  : ['http://localhost:8081', 'http://localhost:19000']; // Development only

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // In production, check whitelist
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    } else {
      // Development: allow all
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CRITICAL: Request tracking and monitoring
app.use(requestId);
app.use(apiVersion);
app.use(metricsMiddleware);
app.use(requestLogger);

// Rate limiting - CRITICAL: Prevents brute force attacks
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth endpoints - CRITICAL: Extra protection for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true, // Don't count successful requests
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    service: 'AfetNet Backend API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      family: '/api/family',
      messages: '/api/messages',
      sos: '/api/sos',
      earthquakes: '/api/earthquakes',
      payments: '/api/payments',
      mesh: '/api/mesh',
      analytics: '/api/analytics',
      admin: '/api/admin',
      health: '/api/health',
    },
  });
});

app.get('/health', async (req, res) => {
  try {
    // CRITICAL: Check database connection
    const dbHealthy = await checkDatabaseHealth();
    
    const health = {
      status: dbHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      database: dbHealthy ? 'connected' : 'disconnected',
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: 'Health check failed',
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/earthquakes', earthquakeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/mesh', meshRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/health', healthRoutes);

// Prometheus Metrics - CRITICAL: Monitoring endpoint
app.get('/metrics', getMetrics);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AfetNet API Documentation',
}));

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// ==================== SOCKET.IO ====================

setupSocketHandlers(io);

// ==================== BACKGROUND JOBS ====================

// Earthquake monitoring (every 1 minute)
cron.schedule('*/1 * * * *', async () => {
  try {
    await startEarthquakeMonitoring();
  } catch (error: any) {
    logger.error('❌ Earthquake monitoring error:', error);
  }
});

// Cleanup expired mesh messages (every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  try {
    const deleted = await prisma.meshMessage.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    
    if (deleted.count > 0) {
      logger.info(`🧹 Cleaned up ${deleted.count} expired mesh messages`);
    }
  } catch (error: any) {
    logger.error('❌ Mesh cleanup error:', error);
  }
});

// Process notification queue (every 30 seconds) - CRITICAL: Reliable notifications
cron.schedule('*/30 * * * * *', async () => {
  try {
    await processNotificationQueue();
  } catch (error: any) {
    logger.error('❌ Notification queue error:', error);
  }
});

// ==================== INITIALIZATION ====================

async function startServer() {
  try {
    // CRITICAL: Initialize Firebase Admin SDK for push notifications
    await initializeFirebase();
    logger.info('✅ Firebase Admin SDK initialized');
    
    // CRITICAL: Verify database connection
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    logger.info('✅ Database connection verified');
    
    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              🚀 AfetNet Backend API Server                ║
║                                                            ║
║  Status: RUNNING                                          ║
║  Port: ${PORT}                                               ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                  ║
║  Time: ${new Date().toLocaleString()}                     ║
║                                                            ║
║  Endpoints:                                               ║
║    - REST API: http://localhost:${PORT}/api                  ║
║    - WebSocket: ws://localhost:${PORT}                       ║
║    - Health: http://localhost:${PORT}/health                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
    
    // CRITICAL: Start earthquake monitoring
    logger.info('🌍 Starting earthquake monitoring...');
    await startEarthquakeMonitoring();
    logger.info('✅ Earthquake monitoring started');
    
  } catch (error: any) {
    logger.error('❌ CRITICAL: Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown - CRITICAL: Properly close all connections
process.on('SIGTERM', async () => {
  logger.warn('⚠️  SIGTERM signal received: initiating graceful shutdown');
  
  try {
    // Close HTTP server
    httpServer.close(() => {
      logger.info('✅ HTTP server closed');
    });
    
    // Disconnect Prisma
    await disconnectPrisma();
    logger.info('✅ Database connections closed');
    
    // Close Socket.IO
    io.close(() => {
      logger.info('✅ Socket.IO closed');
    });
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.warn('⚠️  SIGINT signal received: initiating graceful shutdown');
  
  try {
    // Close HTTP server
    httpServer.close(() => {
      logger.info('✅ HTTP server closed');
    });
    
    // Disconnect Prisma
    await disconnectPrisma();
    logger.info('✅ Database connections closed');
    
    // Close Socket.IO
    io.close(() => {
      logger.info('✅ Socket.IO closed');
    });
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

export { io };
