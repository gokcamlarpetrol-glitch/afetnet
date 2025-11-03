import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// SecureStore keys must only contain alphanumeric, ".", "-", and "_" characters
// Changed from 'afn:deviceId' to 'afn_deviceId' to fix SecureStore error
const KEY = 'afn_deviceId';

/**
 * Get device-specific ID (created once per device, stored securely)
 * Format: afn-XXXXXXXX (8 alphanumeric characters)
 * This ID is unique per device and persistent across app reinstalls
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing ID from SecureStore
    const existingId = await SecureStore.getItemAsync(KEY);
    if (existingId) {
      return existingId;
    }
    
    // Generate new unique ID for this device
    // Use Crypto.randomUUID() for better randomness than Math.random()
    const uuid = await Crypto.randomUUID();
    // Format: afn-XXXXXXXX (8 chars from UUID)
    const newId = `afn-${uuid.replace(/-/g, '').slice(0, 8)}`;
    
    // Store in SecureStore (device-specific, encrypted)
    await SecureStore.setItemAsync(KEY, newId);
    
    return newId;
  } catch (error) {
    // Fallback if SecureStore fails (should be rare)
    console.warn('SecureStore error, using fallback device ID:', error);
    // Generate a temporary ID (won't persist, but app can still function)
    const uuid = await Crypto.randomUUID();
    return `afn-${uuid.replace(/-/g, '').slice(0, 8)}`;
  }
}

/**
 * Validate device ID format
 * Expected format: afn-XXXXXXXX (where X is alphanumeric)
 */
export function isValidDeviceId(id: string): boolean {
  return /^afn-[a-zA-Z0-9]{8}$/.test(id);
}
export function short16(id: string){
  // simple stable 16-bit hash
  let h=0; for (let i=0;i<id.length;i++){ h = (h*31 + id.charCodeAt(i)) & 0xffff; }
  return h;
}



