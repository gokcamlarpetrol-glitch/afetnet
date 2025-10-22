import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';

const TASK = 'BG_FLUSH';

TaskManager.defineTask(TASK, async () => {
  try {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {return BackgroundFetch.BackgroundFetchResult.NoData;}
    // Access store indirectly to avoid bundler cyclic import
    const store = (globalThis as any).require('../store/app');
    const sent = store.useApp.getState().flush();
    return sent > 0 ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBgFlush() {
  try {
    await BackgroundFetch.registerTaskAsync(TASK, {
      minimumInterval: 15 * 60, // 15 min (system may throttle)
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Ignore background task registration errors
  }
}
