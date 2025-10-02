import { Database as WatermelonDB } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { migrations } from './schema';

export class Database {
  private static instance: Database;
  private db: WatermelonDB;

  private constructor() {
    const adapter = new SQLiteAdapter({
      schema,
      migrations,
      jsi: true,
      onSetUpError: (error) => {
        console.error('Database setup error:', error);
      },
    });

    this.db = new WatermelonDB({
      adapter,
      modelClasses: [
        // Add model classes here when they're defined
      ],
    });
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Database is already initialized in constructor
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  getDatabase(): WatermelonDB {
    return this.db;
  }
}