import { database } from '../data/db';
import { MBTilesLoader } from '../offline/mbtiles';
import { BLEMeshManager } from '../p2p/ble';
import { MessageQueue } from '../p2p/queue';
import '../app/i18n';

export const initializeApp = async (): Promise<void> => {
  try {
    console.log('Initializing AfetNet app...');

    // Initialize database
    await database.adapter.schema.migrations?.();
    console.log('Database initialized');

    // Initialize MBTiles
    const mbtilesLoader = MBTilesLoader.getInstance();
    await mbtilesLoader.initialize();
    console.log('MBTiles initialized');

    // Initialize BLE Mesh Manager
    const bleManager = BLEMeshManager.getInstance();
    console.log('BLE Mesh Manager initialized');

    // Initialize Message Queue
    const messageQueue = MessageQueue.getInstance();
    console.log('Message Queue initialized');

    // Start queue processor
    await messageQueue.startQueueProcessor(5000);
    console.log('Queue processor started');

    console.log('AfetNet app initialization completed');
  } catch (error) {
    console.error('App initialization failed:', error);
    throw error;
  }
};
