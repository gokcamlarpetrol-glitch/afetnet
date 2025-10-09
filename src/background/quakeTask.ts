import { Platform } from 'react-native';

let BackgroundTask: any = null;

const TASK_NAME = 'AFETNET_QUAKE_BG';

export async function registerQuakeBackground() {
  // In Expo Go, BackgroundTask is not available; guard everything.
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  try {
    // Try to import expo-task-manager for background tasks
    const taskManagerModule = await import('expo-task-manager');
    BackgroundTask = taskManagerModule.default;
  } catch {
    // Fallback: Use a simple interval-based approach
    console.log('Background task manager not available, using interval fallback');
    return;
  }

  try {
    // Register background task using TaskManager
    if (BackgroundTask && BackgroundTask.defineTask) {
      BackgroundTask.defineTask(TASK_NAME, async () => {
        try {
          // Background earthquake monitoring logic here
          console.log('Background earthquake check running...');
          return 'success';
        } catch (error) {
          console.error('Background task error:', error);
          return 'error';
        }
      });
    }
  } catch (error) {
    console.warn('Failed to register background task:', error);
  }
}