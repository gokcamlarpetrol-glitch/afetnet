// Safe SQLite wrapper to prevent crashes when native modules are not available
import { logger } from '../utils/productionLogger';
import { open } from 'react-native-quick-sqlite';

export const SafeSQLite = {
  isAvailable: () => true, // react-native-quick-sqlite will throw an error if it's not available
  
  openDatabase: (options: { name: string, location?: string }) => {
    try {
      return open(options);
    } catch (error) {
      logger.error('Failed to open SQLite database:', error);
      throw new Error('SQLite not available');
    }
  },
};
