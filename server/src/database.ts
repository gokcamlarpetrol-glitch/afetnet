// Database Connection Module - Render PostgreSQL Compatible
// Single source of truth for PostgreSQL connection using DATABASE_URL

import { Pool } from 'pg';

// Get DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Create connection pool with SSL for Render
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Test database connection
export async function pingDb(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 as ok');
    return result.rows[0]?.ok === 1;
  } catch (error) {
    console.error('❌ Database ping failed:', error);
    return false;
  }
}
