import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Alert, Platform } from 'react-native';
import { logEvent } from '../store/devlog';
import { logger } from '../utils/productionLogger';

const BACKGROUND_TASK_NAME = 'afetnet-mesh-sync';
const FOREGROUND_SERVICE_TASK = 'afetnet-foreground-service';

interface BackgroundConfig {
  isEnabled: boolean;
  lastRun: number;
  runCount: number;
  errorCount: number;
}

class BackgroundHardeningManager {
  private static instance: BackgroundHardeningManager;
  private config: BackgroundConfig = {
    isEnabled: false,
    lastRun: 0,
    runCount: 0,
    errorCount: 0,
  };

  static getInstance(): BackgroundHardeningManager {
    if (!BackgroundHardeningManager.instance) {
      BackgroundHardeningManager.instance = new BackgroundHardeningManager();
    }
    return BackgroundHardeningManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await this.setupAndroidForegroundService();
      } else if (Platform.OS === 'ios') {
        await this.setupIOSBackgroundTasks();
      }
      
      await this.setupBackgroundFetch();
      this.config.isEnabled = true;
      
      logEvent('BACKGROUND_HARDENING_INITIALIZED', {
        platform: Platform.OS,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Background hardening initialization error', error, { component: 'BackgroundHardening' });
      logEvent('BACKGROUND_HARDENING_INIT_ERROR', {
        error: String(error),
        platform: Platform.OS,
      });
    }
  }

  private async setupAndroidForegroundService(): Promise<void> {
    try {
      // Register background task for Android foreground service
      TaskManager.defineTask(FOREGROUND_SERVICE_TASK, async () => {
        try {
          logEvent('FOREGROUND_SERVICE_TASK_RUN', {
            timestamp: Date.now(),
            runCount: this.config.runCount + 1,
          });
          
          this.config.runCount++;
          this.config.lastRun = Date.now();
          
          // Perform mesh sync and other background tasks
          await this.performBackgroundTasks();
          
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          this.config.errorCount++;
          logEvent('FOREGROUND_SERVICE_TASK_ERROR', {
            error: String(error),
            errorCount: this.config.errorCount,
          });
          
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
      
      logEvent('ANDROID_FOREGROUND_SERVICE_SETUP', {
        taskName: FOREGROUND_SERVICE_TASK,
      });
    } catch (error) {
      logger.error('Android foreground service setup error', error, { component: 'BackgroundHardening' });
      logEvent('ANDROID_FOREGROUND_SERVICE_ERROR', {
        error: String(error),
      });
    }
  }

  private async setupIOSBackgroundTasks(): Promise<void> {
    try {
      // Register background task for iOS
      TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
        try {
          logEvent('IOS_BACKGROUND_TASK_RUN', {
            timestamp: Date.now(),
            runCount: this.config.runCount + 1,
          });
          
          this.config.runCount++;
          this.config.lastRun = Date.now();
          
          // Perform mesh sync and other background tasks
          await this.performBackgroundTasks();
          
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          this.config.errorCount++;
          logEvent('IOS_BACKGROUND_TASK_ERROR', {
            error: String(error),
            errorCount: this.config.errorCount,
          });
          
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
      
      logEvent('IOS_BACKGROUND_TASKS_SETUP', {
        taskName: BACKGROUND_TASK_NAME,
      });
    } catch (error) {
      logger.error('iOS background tasks setup error', error, { component: 'BackgroundHardening' });
      logEvent('IOS_BACKGROUND_TASKS_ERROR', {
        error: String(error),
      });
    }
  }

  private async setupBackgroundFetch(): Promise<void> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        logEvent('BACKGROUND_FETCH_DENIED');
        return;
      }
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        logEvent('BACKGROUND_FETCH_RESTRICTED');
        return;
      }
      
      // Register background fetch task
      const taskName = Platform.OS === 'ios' ? BACKGROUND_TASK_NAME : FOREGROUND_SERVICE_TASK;
      
      await BackgroundFetch.registerTaskAsync(taskName, {
        minimumInterval: 15000, // 15 seconds minimum interval
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      logEvent('BACKGROUND_FETCH_REGISTERED', {
        taskName,
        status: String(status),
        platform: Platform.OS,
      });
    } catch (error) {
      logger.error('Background fetch setup error', error, { component: 'BackgroundHardening' });
      logEvent('BACKGROUND_FETCH_SETUP_ERROR', {
        error: String(error),
      });
    }
  }

  private async performBackgroundTasks(): Promise<void> {
    try {
      // Perform mesh sync
      await this.syncMeshData();
      
      // Update remote config
      await this.updateRemoteConfig();
      
      // Clean up old data
      await this.cleanupOldData();
      
      logEvent('BACKGROUND_TASKS_COMPLETED', {
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Background tasks error', error, { component: 'BackgroundHardening' });
      logEvent('BACKGROUND_TASKS_ERROR', {
        error: String(error),
      });
      throw error;
    }
  }

  private async syncMeshData(): Promise<void> {
    // This would sync mesh data and handle pending messages
    // Implementation depends on the mesh system
    logger.debug('Syncing mesh data', null, { component: 'BackgroundHardening' });
  }

  private async updateRemoteConfig(): Promise<void> {
    // This would update remote configuration
    // Implementation depends on the remote config system
    logger.debug('Updating remote config', null, { component: 'BackgroundHardening' });
  }

  private async cleanupOldData(): Promise<void> {
    // This would clean up old logs and cached data
    logger.debug('Cleaning up old data', null, { component: 'BackgroundHardening' });
  }

  showBatteryOptimizationWarning(): void {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Pil Optimizasyonu',
        'AfetNet\'in arka planda çalışması için pil optimizasyonunu devre dışı bırakın:\n\n' +
        '1. Ayarlar > Pil > Pil Optimizasyonu\n' +
        '2. AfetNet\'i bulun ve "Optimize Etme"\n' +
        '3. Uygulamayı yeniden başlatın\n\n' +
        'Bu, acil durumlarda güvenilir iletişim için gereklidir.',
        [
          { text: 'Tamam' },
          { text: 'Ayarlara Git', onPress: () => {
            // This would open device settings
            logger.debug('Opening battery optimization settings', null, { component: 'BackgroundHardening' });
          } },
        ],
      );
    } else if (Platform.OS === 'ios') {
      Alert.alert(
        'Arka Plan Yenileme',
        'iOS\'ta uygulama kapalıyken iletişim sınırlıdır:\n\n' +
        '1. Ayarlar > Genel > Arka Plan Uygulaması Yenileme\n' +
        '2. AfetNet\'i etkinleştirin\n' +
        '3. Uygulamayı açık tutmaya çalışın\n\n' +
        'Acil durumlarda uygulamayı açık tutmak önemlidir.',
        [{ text: 'Tamam' }],
      );
    }
  }

  async stopBackgroundTasks(): Promise<void> {
    try {
      const taskName = Platform.OS === 'ios' ? BACKGROUND_TASK_NAME : FOREGROUND_SERVICE_TASK;
      await BackgroundFetch.unregisterTaskAsync(taskName);
      
      this.config.isEnabled = false;
      
      logEvent('BACKGROUND_TASKS_STOPPED', {
        taskName,
        platform: Platform.OS,
      });
    } catch (error) {
      logger.error('Error stopping background tasks', error, { component: 'BackgroundHardening' });
      logEvent('BACKGROUND_TASKS_STOP_ERROR', {
        error: String(error),
      });
    }
  }

  getStatus(): BackgroundConfig & { platform: string } {
    return {
      ...this.config,
      platform: Platform.OS,
    };
  }

  isBackgroundEnabled(): boolean {
    return this.config.isEnabled;
  }
}

export const backgroundHardeningManager = BackgroundHardeningManager.getInstance();
