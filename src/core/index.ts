// Core module entry point
export * from './data/db';
export * from './data/models';
export * from './data/repositories';
export * from './data/seeds';
export * from './crypto/keys';
export * from './crypto/cbor';
export * from './crypto/sign';
export * from './crypto/id';
export * from './p2p/index';
export * from './p2p/ble';
export * from './p2p/nearby';
export * from './p2p/multipeer';
export * from './p2p/queue';
export * from './p2p/scheduler';
export * from './p2p/dedup';
export * from './p2p/ttl';
export * from './logic/triage';
export * from './logic/sms';
export * from './logic/geo';
export * from './offline/mbtiles';
export * from './utils/smsFallback';

// Initialize core services
import { database } from './data/db';
import { P2PManager } from './p2p/index';
import { seedDatabase } from './data/seeds';

export const initializeCore = async (): Promise<void> => {
  try {
    // Initialize database
    await database.initialize();
    
    // Seed with initial data
    await seedDatabase();
    
    // Initialize P2P manager
    const p2pManager = P2PManager.getInstance(database);
    await p2pManager.initialize();
    
    console.log('Core services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize core services:', error);
    throw error;
  }
};

export const getP2PManager = (): P2PManager => {
  return P2PManager.getInstance(database);
};

export const getDatabase = () => {
  return database;
};