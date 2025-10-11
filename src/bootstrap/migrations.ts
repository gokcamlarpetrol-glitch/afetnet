import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';

const KEY = 'afn/migrations/v1';

export async function runMigrations(): Promise<void> {
  try {
    const seen = await AsyncStorage.getItem(KEY);
    
    // v1: enforce magThreshold=3.5 when missing/invalid
    if (seen !== 'done') {
      logger.debug('Running settings migration v1...');
      
      try {
        const raw = await AsyncStorage.getItem('afn/settings/v1');
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj?.state) {
            let needsUpdate = false;
            
            // Fix magThreshold
            if (typeof obj.state.magThreshold !== 'number' || Number.isNaN(obj.state.magThreshold)) {
              obj.state.magThreshold = 3.5;
              needsUpdate = true;
              logger.debug('Fixed magThreshold: set to 3.5');
            } else if (obj.state.magThreshold < 2.0 || obj.state.magThreshold > 7.5) {
              obj.state.magThreshold = 3.5;
              needsUpdate = true;
              logger.debug('Fixed magThreshold: clamped to 3.5');
            }
            
            // Fix liveMode
            if (typeof obj.state.liveMode !== 'boolean') {
              obj.state.liveMode = true;
              needsUpdate = true;
              logger.debug('Fixed liveMode: set to true');
            }
            
            // Fix pollFastMs
            if (typeof obj.state.pollFastMs !== 'number') {
              obj.state.pollFastMs = 5000;
              needsUpdate = true;
              logger.debug('Fixed pollFastMs: set to 5000');
            }
            
            // Fix pollSlowMs
            if (typeof obj.state.pollSlowMs !== 'number') {
              obj.state.pollSlowMs = 60000;
              needsUpdate = true;
              logger.debug('Fixed pollSlowMs: set to 60000');
            }
            
            if (needsUpdate) {
              await AsyncStorage.setItem('afn/settings/v1', JSON.stringify(obj));
              logger.debug('Settings migration completed successfully');
            }
          }
        }
      } catch (error) {
        logger.warn('Settings migration failed:', error);
      }
      
      await AsyncStorage.setItem(KEY, 'done');
      logger.debug('Migration v1 marked as completed');
    }
  } catch (error) {
    logger.error('Migration system error:', error);
  }
}
