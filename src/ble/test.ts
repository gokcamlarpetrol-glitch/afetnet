// Simple test to verify BLE manager works
import { logger } from '../utils/productionLogger';
import { ble, isBleMock } from './manager';

export async function testBleManager() {
  logger.debug('🧪 Testing BLE Manager...');
  
  try {
    const state = await ble.state();
    logger.debug('✅ BLE State:', state);
    
    const mockMode = isBleMock();
    logger.debug('✅ Mock Mode:', mockMode);
    
    return {
      success: true,
      state,
      mockMode,
      message: mockMode ? 'Running in mock mode (Expo Go)' : 'Running in native mode (Development Build)'
    };
  } catch (error) {
    logger.error('❌ BLE Test Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'BLE test failed'
    };
  }
}
