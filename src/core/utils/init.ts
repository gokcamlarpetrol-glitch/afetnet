import { Database } from '../database';
import { MBTilesLoader } from '../offline/mbtiles';

export const initializeApp = async (): Promise<void> => {
  try {
    console.log('Initializing AfetNet app...');

    // Initialize database
    await Database.getInstance().initialize();

    // Initialize MBTiles loader
    await MBTilesLoader.getInstance().initialize();

    // Initialize other services here
    console.log('AfetNet app initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AfetNet app:', error);
    throw error;
  }
};