import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { P2PManager } from '../p2p';
import { MessageQueue } from '../p2p/queue';
import { EphemeralIdManager } from '../crypto/id';

const BACKGROUND_TASK_NAME = 'afetnet-background-sync';

// Background task for P2P message processing
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    console.log('Running background P2P sync task');

    // Get P2P manager instance
    const p2pManager = P2PManager.getInstance();
    const messageQueue = MessageQueue.getInstance();
    const ephemeralIdManager = EphemeralIdManager.getInstance();

    // Process queued messages
    await messageQueue.processQueue();

    // Check if ephemeral ID needs rotation
    const currentId = ephemeralIdManager.getCurrentId();
    if (!currentId) {
      await ephemeralIdManager.forceRotation();
    }

    // Update P2P status
    const discoveredDevices = p2pManager.getDiscoveredDevices();
    console.log(`Background task: Found ${discoveredDevices.length} devices`);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTasks(): Promise<void> {
  try {
    // Register background fetch
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 15000, // 15 seconds minimum
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('Background tasks registered successfully');
  } catch (error) {
    console.error('Failed to register background tasks:', error);
  }
}

export async function unregisterBackgroundTasks(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
    console.log('Background tasks unregistered successfully');
  } catch (error) {
    console.error('Failed to unregister background tasks:', error);
  }
}

export async function startBackgroundTasks(): Promise<void> {
  try {
    // Start P2P manager
    const p2pManager = P2PManager.getInstance();
    await p2pManager.startP2P();

    // Register background tasks
    await registerBackgroundTasks();

    console.log('Background tasks started successfully');
  } catch (error) {
    console.error('Failed to start background tasks:', error);
  }
}

export async function stopBackgroundTasks(): Promise<void> {
  try {
    // Stop P2P manager
    const p2pManager = P2PManager.getInstance();
    await p2pManager.stopP2P();

    // Unregister background tasks
    await unregisterBackgroundTasks();

    console.log('Background tasks stopped successfully');
  } catch (error) {
    console.error('Failed to stop background tasks:', error);
  }
}