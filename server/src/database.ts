// Database Connection Module - Render PostgreSQL Compatible
// Single source of truth for PostgreSQL connection using DATABASE_URL

import { Pool, PoolClient } from 'pg';

// Get DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// ELITE: Optimized connection pool settings for production
// Render.com PostgreSQL free tier: 90 connections max
// We use conservative settings to avoid connection exhaustion
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Connection pool settings
  max: 20, // Maximum pool size (Render free tier allows 90, we use conservative 20)
  min: 2, // Minimum idle connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Wait 5 seconds for connection
  // Note: query_timeout and statement_timeout are handled in queryWithRetry function
  // PostgreSQL statement_timeout can be set via connection string or per-query
});

// ELITE: Connection pool error handling
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
  // Don't exit - pool will handle reconnection
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Database connection established');
  }
});

pool.on('acquire', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Database connection acquired from pool');
  }
});

pool.on('remove', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔌 Database connection removed from pool');
  }
});

// ELITE: Enhanced database ping with retry logic
export async function pingDb(retries: number = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await pool.query('SELECT 1 as ok');
      if (result.rows[0]?.ok === 1) {
        return true;
      }
    } catch (error) {
      if (i === retries - 1) {
        console.error('❌ Database ping failed after retries:', error);
        return false;
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
}

// ELITE: Get database connection pool statistics
export async function getPoolStats(): Promise<{
  total: number;
  idle: number;
  waiting: number;
}> {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

// ELITE: Execute query with timeout and retry
export async function queryWithRetry<T = any>(
  queryText: string,
  values?: any[],
  retries: number = 3,
  timeoutMs: number = 30000
): Promise<T[]> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
      });
      
      // Race query against timeout
      const result = await Promise.race([
        pool.query(queryText, values),
        timeoutPromise,
      ]);
      
      return result.rows as T[];
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.code === '42P01' || error.code === '42703') {
        // Table/column doesn't exist - don't retry
        throw error;
      }
      
      if (i < retries - 1) {
        // Wait before retry (exponential backoff)
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        console.warn(`⚠️ Database query failed, retrying (${i + 1}/${retries})...`);
      }
    }
  }
  
  throw lastError || new Error('Query failed after retries');
}

// ELITE: Execute transaction with automatic rollback on error
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
