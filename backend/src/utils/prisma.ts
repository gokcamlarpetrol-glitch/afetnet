import { backendLogger } from '../utils/productionLogger';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma Client
 * CRITICAL: Prevents memory leaks and optimizes connection pooling
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma
 * CRITICAL: Call this on server shutdown
 */
export const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    backendLogger.debug('✅ Prisma disconnected gracefully');
  } catch (error) {
    backendLogger.error('❌ Error disconnecting Prisma:', error);
    throw error;
  }
};

/**
 * Health check for database connection
 * CRITICAL: Used in health endpoint
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    backendLogger.error('❌ Database health check failed:', error);
    return false;
  }
};

