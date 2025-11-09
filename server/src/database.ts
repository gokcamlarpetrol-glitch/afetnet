// Database Connection Module - Render PostgreSQL Compatible
// Single source of truth for PostgreSQL connection using DATABASE_URL

import { Pool } from 'pg';

// Get DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Create connection pool with SSL for Render
// Optimized pool settings for Render free tier
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Optimize pool settings to reduce connection overhead
  max: 10, // Reduced from default 20 for free tier
  min: 1, // Keep at least 1 connection warm
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast if can't connect in 5s
});

// Test database connection with optimized query
export async function pingDb(): Promise<boolean> {
  try {
    const start = Date.now();
    // Use simple SELECT 1 instead of SELECT version() to avoid slow queries
    const result = await pool.query('SELECT 1 as ok');
    const duration = Date.now() - start;
    
    // Only log if query is unexpectedly slow (>500ms)
    if (duration > 500) {
      console.warn(`⚠️ Slow database ping: ${duration}ms`);
    }
    
    return result.rows[0]?.ok === 1;
  } catch (error) {
    console.error('❌ Database ping failed:', error);
    return false;
  }
}
