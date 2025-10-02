import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export interface AlarmConfig {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  duration: number; // seconds
  repeat: boolean;
  respectSilentMode: boolean;
}

export class EEWAlarmManager {
  private static instance: EEWAlarmManager;
  private sound: Audio.Sound | null = null;
  private config: AlarmConfig;
  private isPlaying = false;
  private alarmTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enabled: true,
      volume: 1.0,
      duration: 10, // 10 seconds
      repeat: true,
      respectSilentMode: Platform.OS === 'ios', // iOS respects silent mode by default
    };
  }

  static getInstance(): EEWAlarmManager {
    if (!EEWAlarmManager.instance) {
      EEWAlarmManager.instance = new EEWAlarmManager();
    }
    return EEWAlarmManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Configure audio mode for alarm
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: !this.config.respectSilentMode,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      console.log('EEWAlarmManager initialized');
    } catch (error) {
      console.error('Failed to initialize EEWAlarmManager:', error);
    }
  }

  async playEEWAlarm(): Promise<void> {
    if (!this.config.enabled || this.isPlaying) {
      return;
    }

    try {
      console.log('Playing EEW alarm...');

      // Stop any existing alarm
      await this.stopEEWAlarm();

      // Create alarm sound (using system alert sound as fallback)
      const alarmSound = await this.createAlarmSound();
      
      if (!alarmSound) {
        console.warn('Could not create alarm sound, falling back to system sound');
        await this.playSystemAlarm();
        return;
      }

      this.sound = alarmSound;

      // Set volume
      await this.sound.setVolumeAsync(this.config.volume);

      // Set up playback status update
      this.sound.setOnPlaybackStatusUpdate(this.onPlaybackStatusUpdate);

      // Play the alarm
      await this.sound.playAsync();
      this.isPlaying = true;

      // Set up auto-stop timer if not repeating
      if (!this.config.repeat && this.config.duration > 0) {
        this.alarmTimer = setTimeout(() => {
          this.stopEEWAlarm();
        }, this.config.duration * 1000);
      }

      console.log('EEW alarm started');
    } catch (error) {
      console.error('Failed to play EEW alarm:', error);
      this.isPlaying = false;
    }
  }

  async stopEEWAlarm(): Promise<void> {
    try {
      if (this.alarmTimer) {
        clearTimeout(this.alarmTimer);
        this.alarmTimer = null;
      }

      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }

      this.isPlaying = false;
      console.log('EEW alarm stopped');
    } catch (error) {
      console.error('Failed to stop EEW alarm:', error);
    }
  }

  private async createAlarmSound(): Promise<Audio.Sound | null> {
    try {
      // Try to load a bundled alarm sound file
      // In a real app, you would bundle an alarm sound file
      // For now, we'll create a synthetic alarm sound
      
      // This is a placeholder - in reality you would:
      // 1. Bundle an alarm sound file (e.g., alarm.mp3, alarm.wav)
      // 2. Use require() or import to load it
      // 3. For this demo, we'll use a system sound as fallback
      
      return null; // Return null to trigger fallback
    } catch (error) {
      console.error('Failed to create alarm sound:', error);
      return null;
    }
  }

  private async playSystemAlarm(): Promise<void> {
    try {
      // Use system alert sound as fallback
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' }, // Placeholder URL
        { shouldPlay: true, volume: this.config.volume, isLooping: this.config.repeat }
      );

      this.sound = sound;
      this.isPlaying = true;

      // Set up auto-stop timer
      if (!this.config.repeat && this.config.duration > 0) {
        this.alarmTimer = setTimeout(() => {
          this.stopEEWAlarm();
        }, this.config.duration * 1000);
      }
    } catch (error) {
      console.error('Failed to play system alarm:', error);
      this.isPlaying = false;
    }
  }

  private onPlaybackStatusUpdate = (status: any) => {
    if (status.didJustFinish && this.config.repeat) {
      // Restart the alarm if it should repeat
      this.playEEWAlarm();
    } else if (status.didJustFinish) {
      // Stop the alarm if it shouldn't repeat
      this.stopEEWAlarm();
    }
  };

  // Configuration methods
  updateConfig(updates: Partial<AlarmConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): AlarmConfig {
    return { ...this.config };
  }

  // Utility methods
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  async setVolume(volume: number): Promise<void> {
    this.config.volume = Math.max(0, Math.min(1, volume));
    
    if (this.sound) {
      await this.sound.setVolumeAsync(this.config.volume);
    }
  }

  async testAlarm(): Promise<void> {
    console.log('Testing EEW alarm...');
    await this.playEEWAlarm();
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.stopEEWAlarm();
  }
}

// Export convenience functions
export const playEEWAlarm = async (): Promise<void> => {
  const alarmManager = EEWAlarmManager.getInstance();
  return await alarmManager.playEEWAlarm();
};

export const stopEEWAlarm = async (): Promise<void> => {
  const alarmManager = EEWAlarmManager.getInstance();
  return await alarmManager.stopEEWAlarm();
};

export const testEEWAlarm = async (): Promise<void> => {
  const alarmManager = EEWAlarmManager.getInstance();
  return await alarmManager.testAlarm();
};
