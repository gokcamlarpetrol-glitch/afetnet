// SERVER CONFIGURATION WITH DATABASE
// Express server setup for IAP verification with PostgreSQL

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import iapRoutes from './iap-routes';
import pushRoutes from './push-routes';
import { pool, pingDb, closePool } from './database';
import { runMigrations, verifyTables, validateDatabase } from './database-init';
import eewRoutes from './routes/eew';
import earthquakesRoutes from './routes/earthquakes';
import { startEEW } from './eew';
import { earthquakeDetectionService } from './earthquake-detection';
import { earthquakeWarningService } from './earthquake-warnings';
import { monitoringService, errorLoggingMiddleware, performanceMonitoringMiddleware } from './monitoring';
import {
  globalRateLimiter,
  strictRateLimiter,
  apiRateLimiter,
  publicRateLimiter,
  pushRegistrationRateLimiter,
  eewRateLimiter,
} from './middleware/rateLimiter';
import {
  securityHeadersMiddleware,
  corsOptions,
  bodyLimitMiddleware,
  ipFilterMiddleware,
  requestIdMiddleware,
  suspiciousActivityMiddleware,
} from './middleware/securityHeaders';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Sentry monitoring (must be first)
monitoringService.initialize({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1, // 10% of transactions
  profilesSampleRate: 0.1, // 10% of transactions
  enabled: process.env.SENTRY_ENABLED === 'true',
});

// Setup Sentry Express middleware (must be before other middleware)
monitoringService.setupExpressMiddleware(app);

// Security middleware (MUST be first!)
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware);
app.use(ipFilterMiddleware);
app.use(suspiciousActivityMiddleware);

// Middleware
app.use(cors(corsOptions));
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(bodyLimitMiddleware);

// Performance monitoring middleware
app.use(performanceMonitoringMiddleware);

// Global rate limiting (applies to all routes)
app.use(globalRateLimiter);

// Routes with specific rate limiters
app.use('/api/iap', strictRateLimiter, iapRoutes); // Strict for IAP
app.use('/push/register', pushRegistrationRateLimiter); // Very strict for registration
app.use('/push', apiRateLimiter, pushRoutes); // Moderate for other push endpoints
app.use('/api/eew', eewRateLimiter, eewRoutes); // Lenient for critical EEW service
app.use('/api/earthquakes', eewRateLimiter, earthquakesRoutes); // Lenient for critical earthquake data
app.use('/api', apiRateLimiter); // Moderate for other API endpoints

// ELITE: Comprehensive health check with detailed database metrics
app.get('/health', publicRateLimiter, async (req, res) => {
  try {
    const dbConnected = await pingDb();
    const { getPoolStats } = await import('./database');
    const poolStats = await getPoolStats();
    
    res.json({
      status: poolStats.health === 'healthy' ? 'OK' : poolStats.health.toUpperCase(),
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        health: poolStats.health,
      },
      pool: {
        total: poolStats.total,
        idle: poolStats.idle,
        active: poolStats.active,
        waiting: poolStats.waiting,
        max: 20,
        utilization: `${Math.round((poolStats.total / 20) * 100)}%`,
      },
      metrics: {
        totalQueries: poolStats.metrics.totalQueries,
        failedQueries: poolStats.metrics.failedQueries,
        averageQueryTime: `${Math.round(poolStats.metrics.averageQueryTime)}ms`,
        slowQueries: poolStats.metrics.slowQueries,
        connectionErrors: poolStats.metrics.connectionErrors,
      },
      monitoring: monitoringService ? 'active' : 'disabled',
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        health: 'unhealthy',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ELITE: Database metrics endpoint (for monitoring)
app.get('/health/db', apiRateLimiter, async (req, res) => {
  try {
    const { getPoolStats, getActiveConnections } = await import('./database');
    const poolStats = await getPoolStats();
    const activeConnections = getActiveConnections();
    
    res.json({
      ...poolStats,
      activeConnections: activeConnections,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Sentry error handler (must be before other error handlers)
monitoringService.setupErrorHandler(app);

// Custom error logging middleware
app.use(errorLoggingMiddleware);

// Final error handling
app.use((error: any, req: any, res: any, _next: any) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ELITE: Graceful shutdown with proper cleanup
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await monitoringService.flush(2000); // Flush Sentry events
  await closePool(); // ELITE: Graceful pool closure
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  await monitoringService.flush(2000); // Flush Sentry events
  await closePool(); // ELITE: Graceful pool closure
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 AfetNet Server running on port ${PORT}`);
  console.log(`📊 Monitoring: ${process.env.SENTRY_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🛡️ Rate Limiting: ENABLED`);
  console.log(`🌐 Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`📱 Endpoints:`);
  console.log(`   GET  /api/iap/products (strict rate limit)`);
  console.log(`   POST /api/iap/verify (strict rate limit)`);
  console.log(`   GET  /api/user/entitlements`);
  console.log(`   POST /api/iap/apple-notifications`);
  console.log(`   GET  /health (public rate limit)`);
  console.log(`   POST /push/register (very strict rate limit)`);
  console.log(`   POST /push/unregister`);
  console.log(`   POST /push/send-warning (earthquake warnings)`);
  console.log(`   GET  /push/health`);
  console.log(`   GET  /push/tick`);
  console.log(`   GET  /api/eew/health (lenient rate limit)`);
  console.log(`   POST /api/eew/test (lenient rate limit)`);
  
  // Test database connection
  const dbConnected = await pingDb();
  if (!dbConnected) {
    console.error('❌ Database connection failed - server may not work properly');
    console.warn('⚠️ Some features may be limited without database');
    monitoringService.captureMessage('Database connection failed on startup', 'error');
  } else {
    console.log('✅ Database connection successful');
    
    // Run migrations
    await runMigrations();
    
    // Verify tables exist
    const tablesOk = await verifyTables();
    if (!tablesOk) {
      console.warn('⚠️ Some database tables are missing - features may not work properly');
      monitoringService.captureMessage('Database tables verification failed', 'warning');
    }
    
    // ELITE: Validate database schema and configuration
    const validationOk = await validateDatabase();
    if (!validationOk) {
      console.warn('⚠️ Database validation failed - some features may not work optimally');
      monitoringService.captureMessage('Database validation failed', 'warning');
    }
  }
  
  // Start earthquake detection and warning services
  console.log('🌍 Starting earthquake services...');
  try {
    earthquakeDetectionService; // Auto-starts monitoring
    earthquakeWarningService.startMonitoring();
    console.log('✅ Earthquake services started');
  } catch (error) {
    console.error('❌ Failed to start earthquake services:', error);
    monitoringService.captureException(error as Error, { context: 'Earthquake services initialization' });
  }

  // Start EEW providers if enabled
  try{
    await startEEW(async (_evt)=>{
      // Hook for later: integrate with push sender / topic selection
      // Intentionally left as no-op to avoid altering existing push system
    });
    console.log('✅ EEW service initialized (MODE=%s)', process.env.EEW_PROVIDER_MODE||'poll');
  }catch(err){ 
    console.warn('⚠️ EEW init skipped:', err);
    monitoringService.captureException(err as Error, { context: 'EEW initialization' });
  }
  
  console.log('🎉 Server initialization complete!');
});

export default app;
