import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export async function registerRelayBackgroundTask() {
  if (Platform.OS === 'ios') {
    // iOS has strict background limitations for BLE
    console.log('Relay background task not supported on iOS');
    return;
  }
  
  try {
    await BackgroundFetch.registerTaskAsync('ble-relay-monitor', {
      minimumInterval: 300000, // 5 minutes minimum
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    console.log('BLE relay background task registered');
  } catch (error) {
    console.error('Failed to register relay background task:', error);
  }
}

export async function relayBackgroundTask() {
  if (Platform.OS === 'ios') {
    // iOS cannot perform BLE operations in background
    console.log('BLE relay background task skipped on iOS');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }
  
  try {
    console.log('Running BLE relay background task...');
    
    // Check if emergency mode is enabled
    const emergencyMode = await checkEmergencyMode();
    
    // Check if there are pending SOS messages in queue
    const hasPendingSOS = await checkPendingSOS();
    
    if (!emergencyMode && !hasPendingSOS) {
      console.log('No emergency mode or pending SOS, skipping relay task');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    // Wake BLE relay briefly for 10-20 seconds
    await wakeBLERelay(emergencyMode);
    
    console.log('BLE relay background task completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
    
  } catch (error) {
    console.error('BLE relay background task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

async function checkEmergencyMode(): Promise<boolean> {
  try {
    const emergencyData = await AsyncStorage.getItem('afn/emergency/v1');
    if (emergencyData) {
      const parsed = JSON.parse(emergencyData);
      return parsed.enabled === true;
    }
  } catch (error) {
    console.warn('Failed to check emergency mode:', error);
  }
  return false;
}

async function checkPendingSOS(): Promise<boolean> {
  try {
    const queueData = await AsyncStorage.getItem('afn/queue/v1');
    if (queueData) {
      const parsed = JSON.parse(queueData);
      const items = parsed.items || [];
      
      // Check if there are any SOS messages in the queue
      return items.some((item: any) => 
        item.type === 'sos' && 
        (Date.now() - item.ts) < 300000 // Within last 5 minutes
      );
    }
  } catch (error) {
    console.warn('Failed to check pending SOS:', error);
  }
  return false;
}

async function wakeBLERelay(emergencyMode: boolean) {
  try {
    // This would integrate with the actual BLE relay service
    // For now, we'll just log the action
    const duration = emergencyMode ? 20000 : 10000; // 20s for emergency, 10s normal
    
    console.log(`Waking BLE relay for ${duration}ms (emergency: ${emergencyMode})`);
    
    // In a real implementation, this would:
    // 1. Start BLE advertising briefly
    // 2. Perform a short scan for nearby devices
    // 3. Process any pending relay messages
    // 4. Stop after the duration
    
    // For now, we'll simulate this with a timeout
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second simulation
    
    console.log('BLE relay wake cycle completed');
    
  } catch (error) {
    console.error('Failed to wake BLE relay:', error);
  }
}

// Register the task
if (Platform.OS === 'android') {
  BackgroundFetch.setMinimumIntervalAsync(300000); // 5 minutes
}
