// Safe Background Service wrapper to prevent crashes when native modules are not available
let BackgroundService: any = null;

try {
  BackgroundService = require('react-native-background-actions');
} catch (e) {
  console.warn('react-native-background-actions not available');
}

export const SafeBackgroundService = {
  isAvailable: () => BackgroundService !== null,
  
  start: async (task: () => Promise<void>, options: any) => {
    if (!BackgroundService) {
      console.warn('BackgroundService not available, cannot start');
      return;
    }
    try {
      await BackgroundService.start(task, options);
    } catch (e) {
      console.warn('Failed to start background service:', e);
    }
  },
  
  stop: async () => {
    if (!BackgroundService) {
      console.warn('BackgroundService not available, cannot stop');
      return;
    }
    try {
      await BackgroundService.stop();
    } catch (e) {
      console.warn('Failed to stop background service:', e);
    }
  }
};



