/**
 * ELITE DATABASE VALIDATION MODULE
 * Validates database schema, indexes, and configuration on startup
 */

import { queryWithRetry } from './database';

interface IndexInfo {
  tableName: string;
  indexName: string;
  columns: string[];
  unique: boolean;
}

interface TableInfo {
  tableName: string;
  columnCount: number;
  rowCount: number;
}

/**
 * Validate database schema
 */
export async function validateSchema(): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Check required tables
    const requiredTables = [
      'users',
      'purchases',
      'entitlements',
      'user_locations',
      'earthquake_analyses',
    ];
    
    const tables = await queryWithRetry<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `, [], 2, 10000);
    
    const existingTables = tables.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      errors.push(`Missing required tables: ${missingTables.join(', ')}`);
    }
    
    // Check critical indexes
    const indexes = await queryWithRetry<IndexInfo>(`
      SELECT 
        t.relname AS table_name,
        i.relname AS index_name,
        array_agg(a.attname ORDER BY c.ordinality) AS columns,
        idx.indisunique AS unique
      FROM pg_class t
      JOIN pg_index idx ON t.oid = idx.indrelid
      JOIN pg_class i ON i.oid = idx.indexrelid
      JOIN LATERAL unnest(idx.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE t.relkind = 'r'
        AND t.relname IN ('purchases', 'entitlements', 'user_locations', 'earthquake_analyses')
      GROUP BY t.relname, i.relname, idx.indisunique
      ORDER BY t.relname, i.relname
    `, [], 2, 15000);
    
    // Check for critical indexes
    const indexMap = new Map<string, Set<string>>();
    indexes.forEach(idx => {
      if (!indexMap.has(idx.tableName)) {
        indexMap.set(idx.tableName, new Set());
      }
      indexMap.get(idx.tableName)!.add(idx.indexName);
    });
    
    // Validate purchases table indexes
    if (indexMap.has('purchases')) {
      const purchaseIndexes = indexMap.get('purchases')!;
      if (!purchaseIndexes.has('idx_purchases_user_id')) {
        warnings.push('Missing index: idx_purchases_user_id (may impact performance)');
      }
      if (!purchaseIndexes.has('idx_purchases_expires_at')) {
        warnings.push('Missing index: idx_purchases_expires_at (may impact performance)');
      }
    }
    
    // Validate user_locations table indexes
    if (indexMap.has('user_locations')) {
      const locationIndexes = indexMap.get('user_locations')!;
      if (!locationIndexes.has('idx_user_locations_user_id')) {
        warnings.push('Missing index: idx_user_locations_user_id (may impact performance)');
      }
      if (!locationIndexes.has('idx_user_locations_updated_at')) {
        warnings.push('Missing index: idx_user_locations_updated_at (may impact performance)');
      }
    }
    
    // Check table row counts (for monitoring)
    const tableStats = await queryWithRetry<TableInfo>(`
      SELECT 
        schemaname || '.' || tablename AS table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) AS column_count,
        n_live_tup AS row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND tablename IN ('purchases', 'entitlements', 'user_locations', 'earthquake_analyses')
    `, [], 2, 10000);
    
    // Check for unusually large tables
    tableStats.forEach(stat => {
      if (stat.rowCount > 1000000) {
        warnings.push(`Large table detected: ${stat.tableName} has ${stat.rowCount.toLocaleString()} rows (consider archiving)`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
    };
  }
}

/**
 * Validate database configuration
 */
export async function validateConfiguration(): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Check PostgreSQL version
    const version = await queryWithRetry<{ version: string }>(`
      SELECT version()
    `, [], 1, 5000);
    
    if (version.length > 0) {
      const versionStr = version[0].version;
      const versionMatch = versionStr.match(/PostgreSQL (\d+\.\d+)/);
      if (versionMatch) {
        const majorVersion = parseFloat(versionMatch[1]);
        if (majorVersion < 12) {
          warnings.push(`PostgreSQL version ${majorVersion} is outdated (recommend 12+)`);
        }
      }
    }
    
    // Check connection settings
    const settings = await queryWithRetry<{ name: string; setting: string }>(`
      SELECT name, setting 
      FROM pg_settings 
      WHERE name IN ('max_connections', 'shared_buffers', 'work_mem', 'maintenance_work_mem')
    `, [], 1, 5000);
    
    const settingsMap = new Map(settings.map(s => [s.name, s.setting]));
    
    // Check max_connections
    const maxConnections = parseInt(settingsMap.get('max_connections') || '0');
    if (maxConnections < 20) {
      warnings.push(`max_connections is ${maxConnections} (may be too low for production)`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
    };
  }
}

/**
 * Run all validations
 */
export async function runAllValidations(): Promise<{
  schema: { valid: boolean; errors: string[]; warnings: string[] };
  configuration: { valid: boolean; errors: string[]; warnings: string[] };
}> {
  const [schema, configuration] = await Promise.all([
    validateSchema(),
    validateConfiguration(),
  ]);
  
  return { schema, configuration };
}

