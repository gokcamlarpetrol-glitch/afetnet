// Safe Torch wrapper to prevent crashes when native modules are not available
import { logger } from '../utils/productionLogger';
let Torch: any = null;

try {
  Torch = require('react-native-torch');
} catch (e) {
  logger.warn('react-native-torch not available');
}

export const SafeTorch = {
  isAvailable: () => Torch !== null,
  
  switchState: async (state: boolean) => {
    if (!Torch) {
      logger.warn('Torch not available, cannot switch state');
      return;
    }
    try {
      await Torch.switchState(state);
    } catch (e) {
      logger.warn('Failed to switch torch state:', e);
    }
  }
};



