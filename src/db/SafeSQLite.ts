// Safe SQLite wrapper to prevent crashes when native modules are not available
import { logger } from '../utils/productionLogger';
let SQLite: any = null;

try {
  SQLite = (globalThis as any).require('react-native-sqlite-storage');
  if (SQLite) {
    SQLite.enablePromise(true);
  }
} catch {
  logger.warn('react-native-sqlite-storage not available');
}

export const SafeSQLite = {
  isAvailable: () => SQLite !== null,
  
  openDatabase: async (options: Record<string, unknown>) => {
    if (!SQLite) {
      logger.warn('SQLite not available, returning mock database');
      return {
        executeSql: async () => [{ rows: { length: 0 } }],
        transaction: async (fn: any) => fn({ executeSql: async () => [{ rows: { length: 0 } }] }),
        close: async () => {},
      };
    }
    try {
      return await SQLite.openDatabase(options);
    } catch {
      logger.warn('Failed to open SQLite database');
      return {
        executeSql: async () => [{ rows: { length: 0 } }],
        transaction: async (fn: any) => fn({ executeSql: async () => [{ rows: { length: 0 } }] }),
        close: async () => {},
      };
    }
  },
};



