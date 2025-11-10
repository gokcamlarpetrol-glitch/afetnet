// SERVER CONFIGURATION WITH DATABASE
// Express server setup for IAP verification with PostgreSQL

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import iapRoutes from './iap-routes';
import pushRoutes from './push-routes';
import { pool, pingDb } from './database';
import eewRoutes from './routes/eew';
import newsRoutes from './routes/news';
import preparednessRoutes from './routes/preparedness';
import { startEEW } from './eew';
import { earthquakeDetectionService } from './earthquake-detection';
import { earthquakeWarningService } from './earthquake-warnings';
import { newsBackgroundService } from './services/newsBackgroundService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [/^https?:\/\/(localhost:|127\.0\.0\.1:)/, /render\.com$/, /afetnet/],
  credentials: true,
}));
app.set('trust proxy', 1);
app.use(express.json());

// Routes
app.use('/api', iapRoutes);
app.use('/push', pushRoutes);
app.use('/api', eewRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/preparedness', preparednessRoutes);

// Health check with database status
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await pingDb();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling
app.use((error: any, req: any, res: any, _next: any) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 AfetNet Server running on port ${PORT}`);
  console.log(`📱 Endpoints:`);
  console.log(`   GET  /api/iap/products`);
  console.log(`   POST /api/iap/verify`);
  console.log(`   GET  /api/user/entitlements`);
  console.log(`   POST /api/iap/apple-notifications`);
  console.log(`   GET  /health`);
  console.log(`   POST /push/register`);
  console.log(`   POST /push/unregister`);
  console.log(`   GET  /push/health`);
  console.log(`   GET  /push/tick`);
  console.log(`   GET  /api/eew/health`);
  console.log(`   POST /api/eew/test`);
  console.log(`   POST /api/news/summarize`);
  console.log(`   GET  /api/news/summary/:articleId`);
  console.log(`   POST /api/news/process`);
  console.log(`   GET  /api/news/cache/stats`);
  console.log(`   POST /api/news/cache/invalidate/:articleId`);
  console.log(`   POST /api/news/priority`);
  console.log(`   POST /api/preparedness/generate`);
  
  // Test database connection
  const dbConnected = await pingDb();
  if (!dbConnected) {
    console.error('❌ Database connection failed - server may not work properly');
  } else {
    // ELITE: Auto-create preparedness_plans table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS preparedness_plans (
          id SERIAL PRIMARY KEY,
          profile_key VARCHAR(255) UNIQUE NOT NULL,
          profile_params JSONB NOT NULL,
          plan_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_preparedness_plans_profile_key ON preparedness_plans(profile_key)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_preparedness_plans_expires_at ON preparedness_plans(expires_at)
      `);
      console.log('✅ Preparedness plans table ready');
    } catch (error) {
      console.warn('⚠️ Failed to create preparedness_plans table (may already exist):', error);
    }
  }
  
  // Start earthquake detection and warning services
  console.log('🌍 Starting earthquake services...');
  earthquakeDetectionService; // Auto-starts monitoring
  earthquakeWarningService.startMonitoring();
  console.log('✅ Earthquake services started');

  // Start news background service
  console.log('📰 Starting news background service...');
  newsBackgroundService.start();
  console.log('✅ News background service started');

  // Start EEW providers if enabled
  try{
    await startEEW(async (_evt)=>{
      // Hook for later: integrate with push sender / topic selection
      // Intentionally left as no-op to avoid altering existing push system
    });
    console.log('✅ EEW service initialized (MODE=%s)', process.env.EEW_PROVIDER_MODE||'poll');
  }catch(err){ console.warn('⚠️ EEW init skipped:', err); }
});

export default app;
