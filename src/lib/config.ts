import Constants from 'expo-constants';
import { load, KEYS } from './secure';

export async function getApiBase(): Promise<string>{
  // Get from secure store or constants
  return (await load(KEYS.api)) || (Constants.expoConfig?.extra as any)?.apiBase || 'https://afetnet-backend.onrender.com';
}

export async function getSecret(): Promise<string|undefined>{
  // Get from secure store
  return (await load(KEYS.secret)) || undefined;
}
