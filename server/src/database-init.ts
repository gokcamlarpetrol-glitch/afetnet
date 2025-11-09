/**
 * DATABASE INITIALIZATION MODULE
 * Runs migrations on server startup
 */

import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');
    
    // Migration files in order
    const migrations = [
      '001_create_iap_tables.sql',
      '002_create_earthquake_analyses_table.sql',
    ];
    
    for (const migrationFile of migrations) {
      // Try multiple paths (development and production)
      const migrationPaths = [
        path.join(__dirname, 'migrations', migrationFile), // Production (dist/migrations)
        path.join(process.cwd(), 'server', 'src', 'migrations', migrationFile), // Development
        path.join(process.cwd(), 'src', 'migrations', migrationFile), // Alternative
      ];
      
      let migrationPath: string | null = null;
      for (const testPath of migrationPaths) {
        if (fs.existsSync(testPath)) {
          migrationPath = testPath;
          break;
        }
      }
      
      if (!migrationPath) {
        console.warn(`⚠️ Migration file not found: ${migrationFile} (tried: ${migrationPaths.join(', ')})`);
        continue;
      }
      
      // Read migration SQL
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      
      // Execute migration with retry logic
      try {
        const { queryWithRetry } = await import('./database');
        await queryWithRetry(sql, [], 2, 60000); // 2 retries, 60 second timeout for migrations
        console.log(`✅ Migration completed: ${migrationFile}`);
      } catch (error: any) {
        // Ignore "already exists" errors (migration already run)
        if (error.message?.includes('already exists') || error.code === '42P07') {
          console.log(`ℹ️ Migration already applied: ${migrationFile}`);
        } else {
          console.error(`❌ Migration failed: ${migrationFile}`, error.message);
          // Continue with other migrations even if one fails
        }
      }
    }
    
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Database migration error:', error);
    // Don't throw - allow server to start even if migrations fail
    // (migrations might already be applied)
  }
}

/**
 * Verify database tables exist
 */
export async function verifyTables(): Promise<boolean> {
  try {
    const requiredTables = [
      'users',
      'purchases',
      'entitlements',
      'user_locations',
      'earthquake_analyses',
    ];
    
    const { queryWithRetry } = await import('./database');
    const result = await queryWithRetry<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `, [], 2, 10000); // 2 retries, 10 second timeout
    
    const existingTables = result.map((row) => row.table_name);
    const missingTables = requiredTables.filter(
      (table) => !existingTables.includes(table)
    );
    
    if (missingTables.length > 0) {
      console.warn(`⚠️ Missing tables: ${missingTables.join(', ')}`);
      return false;
    }
    
    console.log('✅ All required tables exist');
    return true;
  } catch (error) {
    console.error('❌ Table verification failed:', error);
    return false;
  }
}

