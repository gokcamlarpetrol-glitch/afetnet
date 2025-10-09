import { logger } from './logger';
import { prisma } from './prisma';

/**
 * Database Transaction Helper
 * CRITICAL: Ensures data consistency for complex operations
 * Used for operations that must succeed or fail atomically
 */

/**
 * Execute multiple operations in a transaction
 * CRITICAL: All operations succeed or all fail (ACID compliance)
 */
export async function executeTransaction<T>(
  operations: (tx: typeof prisma) => Promise<T>,
  context?: string
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      return await operations(tx);
    });

    const duration = Date.now() - startTime;
    logger.info(`✅ Transaction completed${context ? ` [${context}]` : ''} in ${duration}ms`);

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Transaction failed${context ? ` [${context}]` : ''} after ${duration}ms:`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Execute with retry logic
 * CRITICAL: Retries failed operations (useful for network issues)
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context?: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`✅ Operation succeeded on attempt ${attempt}${context ? ` [${context}]` : ''}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        logger.warn(`⚠️  Operation failed (attempt ${attempt}/${maxRetries})${context ? ` [${context}]` : ''}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }

  logger.error(`❌ Operation failed after ${maxRetries} attempts${context ? ` [${context}]` : ''}`, {
    error: lastError?.message,
  });

  throw lastError;
}

/**
 * Batch operations helper
 * CRITICAL: Processes large datasets efficiently
 */
export async function batchProcess<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>,
  context?: string
): Promise<void> {
  const totalBatches = Math.ceil(items.length / batchSize);
  
  logger.info(`📦 Processing ${items.length} items in ${totalBatches} batches${context ? ` [${context}]` : ''}`);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    try {
      await processor(batch);
      logger.info(`✅ Batch ${batchNumber}/${totalBatches} processed (${batch.length} items)`);
    } catch (error: any) {
      logger.error(`❌ Batch ${batchNumber}/${totalBatches} failed:`, {
        error: error.message,
        batchSize: batch.length,
      });
      throw error;
    }
  }

  logger.info(`✅ All ${totalBatches} batches processed successfully${context ? ` [${context}]` : ''}`);
}
