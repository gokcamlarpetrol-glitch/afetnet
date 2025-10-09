// Simple test to verify BLE manager works
import { ble, isBleMock } from './manager';

export async function testBleManager() {
  console.log('🧪 Testing BLE Manager...');
  
  try {
    const state = await ble.state();
    console.log('✅ BLE State:', state);
    
    const mockMode = isBleMock();
    console.log('✅ Mock Mode:', mockMode);
    
    return {
      success: true,
      state,
      mockMode,
      message: mockMode ? 'Running in mock mode (Expo Go)' : 'Running in native mode (Development Build)'
    };
  } catch (error) {
    console.error('❌ BLE Test Error:', error);
    return {
      success: false,
      error: error.message,
      message: 'BLE test failed'
    };
  }
}
