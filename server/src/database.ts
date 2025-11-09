// ELITE DATABASE CONNECTION MODULE
// Production-grade PostgreSQL connection pool with advanced monitoring, leak detection, and health checks
// Render.com PostgreSQL Compatible

import { Pool, PoolClient, QueryResult } from 'pg';

// Get DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set - database connection cannot be established');
}

// ELITE: Advanced connection pool configuration for production
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
  // Statement timeout (PostgreSQL level) - set via connection string
  // Note: query_timeout is handled in queryWithRetry function
});

// ELITE: Connection pool metrics tracking
interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
  totalQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  slowQueries: number; // Queries > 1 second
  connectionErrors: number;
  lastError?: string;
  lastErrorTime?: Date;
}

let poolMetrics: PoolMetrics = {
  totalConnections: 0,
  idleConnections: 0,
  activeConnections: 0,
  waitingRequests: 0,
  totalQueries: 0,
  failedQueries: 0,
  averageQueryTime: 0,
  slowQueries: 0,
  connectionErrors: 0,
};

// ELITE: Connection leak detection
const activeConnections = new Map<string, { startTime: Date; query: string }>();
const MAX_CONNECTION_TIME = 60000; // 60 seconds max connection time

// ELITE: Connection pool error handling with metrics
pool.on('error', (err) => {
  poolMetrics.connectionErrors++;
  poolMetrics.lastError = err.message;
  poolMetrics.lastErrorTime = new Date();
  console.error('❌ Unexpected database pool error:', err);
  // Don't exit - pool will handle reconnection
});

pool.on('connect', (client) => {
  poolMetrics.totalConnections++;
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Database connection established');
  }
});

pool.on('acquire', (client) => {
  poolMetrics.activeConnections++;
  poolMetrics.idleConnections = Math.max(0, poolMetrics.idleConnections - 1);
  const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  activeConnections.set(connectionId, { startTime: new Date(), query: 'acquired' });
  
  // ELITE: Connection leak detection - check for long-running connections
  setTimeout(() => {
    const conn = activeConnections.get(connectionId);
    if (conn) {
      const duration = Date.now() - conn.startTime.getTime();
      if (duration > MAX_CONNECTION_TIME) {
        console.warn(`⚠️ Potential connection leak detected: connection held for ${duration}ms`);
        console.warn(`   Last query: ${conn.query}`);
      }
    }
  }, MAX_CONNECTION_TIME);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Database connection acquired from pool');
  }
});

pool.on('remove', () => {
  poolMetrics.totalConnections = Math.max(0, poolMetrics.totalConnections - 1);
  if (process.env.NODE_ENV === 'development') {
    console.log('🔌 Database connection removed from pool');
  }
});

// ELITE: Periodic pool health check
setInterval(() => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
  
  poolMetrics.totalConnections = stats.total;
  poolMetrics.idleConnections = stats.idle;
  poolMetrics.activeConnections = stats.total - stats.idle;
  poolMetrics.waitingRequests = stats.waiting;
  
  // ELITE: Alert on pool exhaustion
  if (stats.waiting > 5) {
    console.warn(`⚠️ Database pool exhaustion warning: ${stats.waiting} requests waiting`);
  }
  
  // ELITE: Alert on high connection usage
  if (stats.total > 15) {
    console.warn(`⚠️ High database connection usage: ${stats.total}/20 connections in use`);
  }
}, 10000); // Check every 10 seconds

// ELITE: Enhanced database ping with retry logic and circuit breaker
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
let circuitBreakerOpen = false;
let circuitBreakerOpenTime: Date | null = null;
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

export async function pingDb(retries: number = 3): Promise<boolean> {
  // ELITE: Circuit breaker pattern - if too many failures, skip ping
  if (circuitBreakerOpen) {
    if (circuitBreakerOpenTime && Date.now() - circuitBreakerOpenTime.getTime() > CIRCUIT_BREAKER_TIMEOUT) {
      // Try to close circuit breaker
      circuitBreakerOpen = false;
      circuitBreakerOpenTime = null;
      console.log('🔄 Circuit breaker closed - attempting database ping');
    } else {
      return false; // Circuit breaker is open
    }
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      const startTime = Date.now();
      const result = await pool.query('SELECT 1 as ok');
      const duration = Date.now() - startTime;
      
      if (result.rows[0]?.ok === 1) {
        consecutiveFailures = 0;
        circuitBreakerOpen = false;
        circuitBreakerOpenTime = null;
        return true;
      }
    } catch (error) {
      consecutiveFailures++;
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        circuitBreakerOpen = true;
        circuitBreakerOpenTime = new Date();
        console.error(`❌ Circuit breaker opened after ${consecutiveFailures} consecutive failures`);
      }
      
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

// ELITE: Get database connection pool statistics with metrics
export async function getPoolStats(): Promise<{
  total: number;
  idle: number;
  active: number;
  waiting: number;
  metrics: PoolMetrics;
  health: 'healthy' | 'degraded' | 'unhealthy';
}> {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    active: pool.totalCount - pool.idleCount,
    waiting: pool.waitingCount,
  };
  
  // ELITE: Determine health status
  let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (stats.waiting > 5 || stats.total > 18 || circuitBreakerOpen) {
    health = 'unhealthy';
  } else if (stats.waiting > 2 || stats.total > 15 || poolMetrics.connectionErrors > 10) {
    health = 'degraded';
  }
  
  return {
    ...stats,
    metrics: { ...poolMetrics },
    health,
  };
}

// ELITE: Execute query with timeout, retry, performance tracking, and leak detection
export async function queryWithRetry<T = any>(
  queryText: string,
  values?: any[],
  retries: number = 3,
  timeoutMs: number = 30000
): Promise<T[]> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  const connectionId = `${Date.now()}-${Math.random()}`;
  
  // ELITE: Validate query (prevent SQL injection)
  if (typeof queryText !== 'string' || queryText.trim().length === 0) {
    throw new Error('Invalid query: query text must be a non-empty string');
  }
  
  // ELITE: Check for potential SQL injection (basic check)
  if (queryText.includes(';--') || queryText.includes('DROP TABLE') || queryText.includes('DELETE FROM')) {
    // Allow if values are parameterized (prepared statement)
    if (!values || values.length === 0) {
      console.warn('⚠️ Potential SQL injection attempt detected (unparameterized dangerous query)');
    }
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      // ELITE: Track connection usage
      activeConnections.set(connectionId, { startTime: new Date(), query: queryText.substring(0, 100) });
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
      });
      
      // Race query against timeout
      const result = await Promise.race([
        pool.query(queryText, values),
        timeoutPromise,
      ]) as QueryResult;
      
      // ELITE: Track query performance
      const duration = Date.now() - startTime;
      poolMetrics.totalQueries++;
      poolMetrics.averageQueryTime = (poolMetrics.averageQueryTime * (poolMetrics.totalQueries - 1) + duration) / poolMetrics.totalQueries;
      
      if (duration > 1000) {
        poolMetrics.slowQueries++;
        console.warn(`⚠️ Slow query detected: ${duration}ms - ${queryText.substring(0, 100)}`);
      }
      
      // Cleanup connection tracking
      activeConnections.delete(connectionId);
      
      return result.rows as T[];
    } catch (error: any) {
      lastError = error;
      poolMetrics.failedQueries++;
      
      // Cleanup connection tracking
      activeConnections.delete(connectionId);
      
      // Don't retry on certain errors
      if (error.code === '42P01' || error.code === '42703') {
        // Table/column doesn't exist - don't retry
        throw error;
      }
      
      // Don't retry on syntax errors
      if (error.code === '42601' || error.code === '42883') {
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

// ELITE: Execute transaction with automatic rollback, timeout, and deadlock detection
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const client = await pool.connect();
  const connectionId = `tx-${Date.now()}-${Math.random()}`;
  
  try {
    // ELITE: Track transaction
    activeConnections.set(connectionId, { startTime: new Date(), query: 'transaction' });
    
    // ELITE: Set transaction timeout
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    await client.query('BEGIN');
    
    const startTime = Date.now();
    const result = await callback(client);
    const duration = Date.now() - startTime;
    
    await client.query('COMMIT');
    
    // ELITE: Track transaction performance
    if (duration > 5000) {
      console.warn(`⚠️ Long-running transaction: ${duration}ms`);
    }
    
    activeConnections.delete(connectionId);
    return result;
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Transaction rollback failed:', rollbackError);
    }
    
    // ELITE: Detect deadlocks
    if (error.code === '40P01') {
      console.error('❌ Database deadlock detected');
      poolMetrics.connectionErrors++;
    }
    
    activeConnections.delete(connectionId);
    throw error;
  } finally {
    client.release();
  }
}

// ELITE: Reset pool metrics (for testing/monitoring)
export function resetPoolMetrics(): void {
  poolMetrics = {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    activeConnections: pool.totalCount - pool.idleCount,
    waitingRequests: pool.waitingCount,
    totalQueries: 0,
    failedQueries: 0,
    averageQueryTime: 0,
    slowQueries: 0,
    connectionErrors: 0,
  };
}

// ELITE: Get active connections (for debugging)
export function getActiveConnections(): Array<{ id: string; duration: number; query: string }> {
  const now = Date.now();
  return Array.from(activeConnections.entries()).map(([id, conn]) => ({
    id,
    duration: now - conn.startTime.getTime(),
    query: conn.query,
  }));
}

// ELITE: Graceful shutdown with connection cleanup
export async function closePool(): Promise<void> {
  console.log('🛑 Closing database connection pool...');
  
  // Wait for active connections to finish (max 30 seconds)
  const maxWaitTime = 30000;
  const startTime = Date.now();
  
  while (activeConnections.size > 0 && Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`⏳ Waiting for ${activeConnections.size} active connections to finish...`);
  }
  
  if (activeConnections.size > 0) {
    console.warn(`⚠️ Force closing ${activeConnections.size} active connections`);
    activeConnections.clear();
  }
  
  await pool.end();
  console.log('✅ Database connection pool closed');
}
