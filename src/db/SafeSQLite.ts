// Safe SQLite wrapper to prevent crashes when native modules are not available
let SQLite: any = null;

try {
  SQLite = require('react-native-sqlite-storage');
  if (SQLite) {
    SQLite.enablePromise(true);
  }
} catch (e) {
  console.warn('react-native-sqlite-storage not available');
}

export const SafeSQLite = {
  isAvailable: () => SQLite !== null,
  
  openDatabase: async (options: any) => {
    if (!SQLite) {
      console.warn('SQLite not available, returning mock database');
      return {
        executeSql: async () => [{ rows: { length: 0 } }],
        transaction: async (fn: any) => fn({ executeSql: async () => [{ rows: { length: 0 } }] }),
        close: async () => {}
      };
    }
    try {
      return await SQLite.openDatabase(options);
    } catch (e) {
      console.warn('Failed to open SQLite database:', e);
      return {
        executeSql: async () => [{ rows: { length: 0 } }],
        transaction: async (fn: any) => fn({ executeSql: async () => [{ rows: { length: 0 } }] }),
        close: async () => {}
      };
    }
  }
};



