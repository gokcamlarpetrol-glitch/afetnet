import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'afn:ice:v1';
export type ICE = {
  name: string;
  blood?: string;
  allergies?: string;
  meds?: string;
  contacts?: { name: string; phone: string }[];
};

export async function saveICE(data: ICE) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
  
  // Save to Firebase
  try {
    const { getDeviceId } = await import('../lib/device');
    const deviceId = await getDeviceId();
    if (deviceId) {
      const { firebaseDataService } = await import('../core/services/FirebaseDataService');
      if (firebaseDataService.isInitialized) {
        await firebaseDataService.saveICE(deviceId, data);
      }
    }
  } catch (error) {
    console.error('Failed to save ICE to Firebase:', error);
  }
}

export async function loadICE(): Promise<ICE | null> {
  // First load from AsyncStorage
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    const ice = JSON.parse(raw);
    
    // Try to sync from Firebase
    try {
      const { getDeviceId } = await import('../lib/device');
      const deviceId = await getDeviceId();
      if (deviceId) {
        const { firebaseDataService } = await import('../core/services/FirebaseDataService');
        if (firebaseDataService.isInitialized) {
          const cloudICE = await firebaseDataService.loadICE(deviceId);
          if (cloudICE) {
            // Merge: Firebase takes precedence
            await AsyncStorage.setItem(KEY, JSON.stringify(cloudICE));
            return cloudICE;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load ICE from Firebase:', error);
    }
    
    return ice;
  }
  
  // Try Firebase if no local data
  try {
    const { getDeviceId } = await import('../lib/device');
    const deviceId = await getDeviceId();
    if (deviceId) {
      const { firebaseDataService } = await import('../core/services/FirebaseDataService');
      if (firebaseDataService.isInitialized) {
        const cloudICE = await firebaseDataService.loadICE(deviceId);
        if (cloudICE) {
          await AsyncStorage.setItem(KEY, JSON.stringify(cloudICE));
          return cloudICE;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load ICE from Firebase:', error);
  }
  
  return null;
}



