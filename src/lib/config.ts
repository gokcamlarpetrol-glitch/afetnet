import Constants from 'expo-constants';
import { load, KEYS } from './secure';
import { loadActivation } from '../store/activation';

export async function getApiBase(): Promise<string>{
  // First try activation store
  const activation = await loadActivation();
  if (activation?.serverUrl && activation.serverUrl !== 'local://offline') {
    return activation.serverUrl;
  }
  
  // Fallback to secure store
  return (await load(KEYS.api)) || (Constants.expoConfig?.extra as any)?.apiBase || '';
}

export async function getSecret(): Promise<string|undefined>{
  // First try activation store
  const activation = await loadActivation();
  if (activation?.secret) {
    return activation.secret;
  }
  
  // Fallback to secure store
  return (await load(KEYS.secret)) || undefined;
}
