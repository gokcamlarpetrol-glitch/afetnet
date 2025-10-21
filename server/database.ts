// Database Connection Module
// PostgreSQL connection for AfetNet IAP system

import { Pool, PoolClient } from 'pg';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'afetnet_iap',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Database interface
export interface User {
  id: string;
  email: string;
  device_id?: string;
  apple_user_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Purchase {
  id: string;
  user_id: string;
  product_id: string;
  original_transaction_id: string;
  transaction_id: string;
  status: 'active' | 'expired' | 'refunded' | 'revoked';
  expires_at?: Date;
  is_lifetime: boolean;
  last_event?: any;
  purchase_date: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Entitlement {
  user_id: string;
  is_premium: boolean;
  source?: 'monthly' | 'yearly' | 'lifetime';
  expires_at?: Date;
  active_product_id?: string;
  last_purchase_id?: string;
  updated_at: Date;
}

// Database operations
export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    this.pool = pool;
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  // Get or create user
  async getOrCreateUser(email: string, deviceId?: string, appleUserId?: string): Promise<User> {
    const client = await this.pool.connect();
    try {
      // Try to find existing user by email or device_id
      let query = 'SELECT * FROM users WHERE email = $1';
      let params = [email];
      
      if (deviceId) {
        query += ' OR device_id = $2';
        params.push(deviceId);
      }
      
      const existingUser = await client.query(query, params);
      
      if (existingUser.rows.length > 0) {
        return existingUser.rows[0];
      }

      // Create new user
      const newUser = await client.query(
        'INSERT INTO users (email, device_id, apple_user_id) VALUES ($1, $2, $3) RETURNING *',
        [email, deviceId, appleUserId]
      );
      
      console.log('👤 Created new user:', newUser.rows[0].id);
      return newUser.rows[0];
    } finally {
      client.release();
    }
  }

  // Create purchase record
  async createPurchase(
    userId: string,
    productId: string,
    originalTransactionId: string,
    transactionId: string,
    purchaseDate: Date,
    expiresAt?: Date,
    isLifetime: boolean = false
  ): Promise<Purchase> {
    const client = await this.pool.connect();
    try {
      const purchase = await client.query(
        `INSERT INTO purchases 
         (user_id, product_id, original_transaction_id, transaction_id, purchase_date, expires_at, is_lifetime) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [userId, productId, originalTransactionId, transactionId, purchaseDate, expiresAt, isLifetime]
      );
      
      console.log('💳 Created purchase:', purchase.rows[0].id);
      return purchase.rows[0];
    } finally {
      client.release();
    }
  }

  // Update purchase status
  async updatePurchaseStatus(
    originalTransactionId: string,
    status: 'active' | 'expired' | 'refunded' | 'revoked',
    lastEvent?: any
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE purchases SET status = $1, last_event = $2, updated_at = NOW() WHERE original_transaction_id = $3',
        [status, lastEvent ? JSON.stringify(lastEvent) : null, originalTransactionId]
      );
      
      console.log('🔄 Updated purchase status:', originalTransactionId, status);
    } finally {
      client.release();
    }
  }

  // Get user entitlements
  async getUserEntitlements(userId: string): Promise<Entitlement | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM entitlements WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      return null;
    } finally {
      client.release();
    }
  }

  // Get user purchases
  async getUserPurchases(userId: string): Promise<Purchase[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Clean up expired purchases
  async cleanupExpiredPurchases(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT cleanup_expired_purchases()');
      console.log('🧹 Cleaned up expired purchases');
    } finally {
      client.release();
    }
  }

  // Get purchase by transaction ID
  async getPurchaseByTransactionId(transactionId: string): Promise<Purchase | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM purchases WHERE transaction_id = $1 OR original_transaction_id = $1',
        [transactionId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      return null;
    } finally {
      client.release();
    }
  }

  // Close database connection
  async close(): Promise<void> {
    await this.pool.end();
    console.log('🔌 Database connection closed');
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();
export default db;
