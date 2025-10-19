// SERVER CONFIGURATION WITH DATABASE
// Express server setup for IAP verification with PostgreSQL

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import iapRoutes from './iap-routes';
import { db } from './src/database';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', iapRoutes);

// Health check with database status
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await db.testConnection();
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  await db.close();
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 IAP Verification Server running on port ${PORT}`);
  console.log(`📱 Endpoints:`);
  console.log(`   GET  /api/iap/products`);
  console.log(`   POST /api/iap/verify`);
  console.log(`   GET  /api/user/entitlements`);
  console.log(`   POST /api/iap/apple-notifications`);
  console.log(`   GET  /health`);
  
  // Test database connection
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    console.error('❌ Database connection failed - server may not work properly');
  }
});

export default app;
