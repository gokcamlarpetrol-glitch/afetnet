import * as SecureStore from 'expo-secure-store';
export async function save(key:string, val:string){ try{ await SecureStore.setItemAsync(key,val); }catch{
  // Ignore secure store errors
} }
export async function load(key:string){ try{ return await SecureStore.getItemAsync(key); }catch{ return null; } }
export const KEYS = { api: 'afn:apiBase', secret: 'afn:secret' };



