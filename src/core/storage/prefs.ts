import AsyncStorage from '@react-native-async-storage/async-storage';

export class Preferences {
  private static readonly PREFIX = 'afetnet_';

  static async get(key: string): Promise<any> {
    try {
      const value = await AsyncStorage.getItem(this.PREFIX + key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Failed to get preference:', key, error);
      return null;
    }
  }

  static async set(key: string, value: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to set preference:', key, error);
    }
  }

  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.PREFIX + key);
    } catch (error) {
      console.error('Failed to remove preference:', key, error);
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const prefKeys = keys.filter(key => key.startsWith(this.PREFIX));
      await AsyncStorage.multiRemove(prefKeys);
    } catch (error) {
      console.error('Failed to clear preferences:', error);
    }
  }

  // Specific preference getters/setters
  static async getShakeDetectionEnabled(): Promise<boolean> {
    return await this.get('shakeDetectionEnabled') || false;
  }

  static async setShakeDetectionEnabled(enabled: boolean): Promise<void> {
    await this.set('shakeDetectionEnabled', enabled);
  }

  static async getUltraLowPowerMode(): Promise<boolean> {
    return await this.get('ultraLowPowerMode') || true;
  }

  static async setUltraLowPowerMode(enabled: boolean): Promise<void> {
    await this.set('ultraLowPowerMode', enabled);
  }

  static async getFirstRun(): Promise<boolean> {
    return await this.get('firstRun') !== false;
  }

  static async setFirstRunCompleted(): Promise<void> {
    await this.set('firstRun', false);
  }

  static async getSmsGateway(): Promise<string> {
    return await this.get('smsGateway') || 'default';
  }

  static async setSmsGateway(gateway: string): Promise<void> {
    await this.set('smsGateway', gateway);
  }

  static async getTelemetryEnabled(): Promise<boolean> {
    return await this.get('telemetryEnabled') || false;
  }

  static async setTelemetryEnabled(enabled: boolean): Promise<void> {
    await this.set('telemetryEnabled', enabled);
  }

  static async getLanguage(): Promise<string> {
    return await this.get('language') || 'tr';
  }

  static async setLanguage(language: string): Promise<void> {
    await this.set('language', language);
  }

  static async getLastExport(): Promise<number | null> {
    return await this.get('lastExport');
  }

  static async setLastExport(timestamp: number): Promise<void> {
    await this.set('lastExport', timestamp);
  }
}