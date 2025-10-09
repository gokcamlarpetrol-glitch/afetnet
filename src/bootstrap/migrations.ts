import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'afn/migrations/v1';

export async function runMigrations(): Promise<void> {
  try {
    const seen = await AsyncStorage.getItem(KEY);
    
    // v1: enforce magThreshold=3.5 when missing/invalid
    if (seen !== 'done') {
      console.log('Running settings migration v1...');
      
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
              console.log('Fixed magThreshold: set to 3.5');
            } else if (obj.state.magThreshold < 2.0 || obj.state.magThreshold > 7.5) {
              obj.state.magThreshold = 3.5;
              needsUpdate = true;
              console.log('Fixed magThreshold: clamped to 3.5');
            }
            
            // Fix liveMode
            if (typeof obj.state.liveMode !== 'boolean') {
              obj.state.liveMode = true;
              needsUpdate = true;
              console.log('Fixed liveMode: set to true');
            }
            
            // Fix pollFastMs
            if (typeof obj.state.pollFastMs !== 'number') {
              obj.state.pollFastMs = 5000;
              needsUpdate = true;
              console.log('Fixed pollFastMs: set to 5000');
            }
            
            // Fix pollSlowMs
            if (typeof obj.state.pollSlowMs !== 'number') {
              obj.state.pollSlowMs = 60000;
              needsUpdate = true;
              console.log('Fixed pollSlowMs: set to 60000');
            }
            
            if (needsUpdate) {
              await AsyncStorage.setItem('afn/settings/v1', JSON.stringify(obj));
              console.log('Settings migration completed successfully');
            }
          }
        }
      } catch (error) {
        console.warn('Settings migration failed:', error);
      }
      
      await AsyncStorage.setItem(KEY, 'done');
      console.log('Migration v1 marked as completed');
    }
  } catch (error) {
    console.error('Migration system error:', error);
  }
}
