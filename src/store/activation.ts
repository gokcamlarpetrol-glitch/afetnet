import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';

export type Activation = {
  serverUrl: string;     // 'https://...' or 'local://offline'
  secret?: string;
  createdAt: number;
};

const ACTIVATION_KEY = 'afetnet:activation';

export function defaultActivation(): Activation {
  // Public default: works fully offline; server can be added later via deep link
  return {
    serverUrl: 'local://offline',
    secret: '',
    createdAt: Date.now(),
  };
}

export async function loadActivation(): Promise<Activation | null> {
  try {
    const stored = await AsyncStorage.getItem(ACTIVATION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    logger.warn('Failed to load activation:', e);
    return null;
  }
}

export async function saveActivation(activation: Activation): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVATION_KEY, JSON.stringify(activation));
  } catch (e) {
    logger.warn('Failed to save activation:', e);
  }
}

export async function clearActivation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVATION_KEY);
  } catch (e) {
    logger.warn('Failed to clear activation:', e);
  }
}



