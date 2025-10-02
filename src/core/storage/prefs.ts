import AsyncStorage from '@react-native-async-storage/async-storage';

export class Preferences {
  private static readonly PREFIX = 'afetnet_';

  static async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.PREFIX + key);
    } catch (error) {
      console.error('Error getting preference:', error);
      return null;
    }
  }

  static async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.PREFIX + key, value);
    } catch (error) {
      console.error('Error setting preference:', error);
    }
  }

  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.PREFIX + key);
    } catch (error) {
      console.error('Error removing preference:', error);
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const afetnetKeys = keys.filter(key => key.startsWith(this.PREFIX));
      await AsyncStorage.multiRemove(afetnetKeys);
    } catch (error) {
      console.error('Error clearing preferences:', error);
    }
  }

  static async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
    const value = await this.get(key);
    return value ? value === 'true' : defaultValue;
  }

  static async setBoolean(key: string, value: boolean): Promise<void> {
    await this.set(key, value.toString());
  }

  static async getNumber(key: string, defaultValue: number = 0): Promise<number> {
    const value = await this.get(key);
    return value ? parseFloat(value) : defaultValue;
  }

  static async setNumber(key: string, value: number): Promise<void> {
    await this.set(key, value.toString());
  }

  static async getObject<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Error parsing preference object:', error);
      return null;
    }
  }

  static async setObject<T>(key: string, value: T): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }
}

export class PreferencesManager {
  private static instance: PreferencesManager;
  
  private constructor() {}
  
  static getInstance(): PreferencesManager {
    if (!PreferencesManager.instance) {
      PreferencesManager.instance = new PreferencesManager();
    }
    return PreferencesManager.instance;
  }

  async getPrefs(): Promise<Record<string, any>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const afetnetKeys = keys.filter(key => key.startsWith('afetnet_'));
      const pairs = await AsyncStorage.multiGet(afetnetKeys);
      const prefs: Record<string, any> = {};
      
      pairs.forEach(([key, value]) => {
        if (value) {
          const prefKey = key.replace('afetnet_', '');
          try {
            prefs[prefKey] = JSON.parse(value);
          } catch {
            prefs[prefKey] = value;
          }
        }
      });
      
      return prefs;
    } catch (error) {
      console.error('Error getting all preferences:', error);
      return {};
    }
  }

  async updatePrefs(prefs: Record<string, any>): Promise<void> {
    try {
      const pairs = Object.entries(prefs).map(([key, value]) => [
        'afetnet_' + key,
        typeof value === 'string' ? value : JSON.stringify(value)
      ]);
      await AsyncStorage.multiSet(pairs);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  }
}