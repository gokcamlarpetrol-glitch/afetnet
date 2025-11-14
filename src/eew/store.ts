import { create } from 'zustand';
import { Platform } from 'react-native';

export type ActiveEEW = {
  eventId: string;
  etaSec: number;
  mag?: number;
  region?: string;
  issuedAt: number;
  source: string;
};

type EEWConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type EEWState = {
  active?: ActiveEEW;
  connectionStatus: EEWConnectionStatus;
  lastError: string | null;
  setActive: (a: ActiveEEW) => void;
  setStatus: (status: EEWConnectionStatus, error?: string | null) => void;
  clear: () => void;
};

export const useEEWStore = create<EEWState>((set) => ({
  active: undefined,
  connectionStatus: 'disconnected',
  lastError: null,
  setActive: (a) => set({ active: a }),
  setStatus: (status, error = null) => set({ connectionStatus: status, lastError: error }),
  clear: () => set({ active: undefined, connectionStatus: 'disconnected', lastError: null }),
}));

// ELITE: Zero static dependencies - lazy load expo-notifications
import * as FileSystem from 'expo-file-system';
import { EEWAlert } from './types';
import { computeGrid, saveGrid } from '../risk/grid';
import { loadRiskSettings } from '../risk/settings';

let NotificationsModule: any = null;
let isNotificationsLoading = false;

async function getNotificationsAsync(): Promise<any> {
  if (NotificationsModule) return NotificationsModule;
  if (isNotificationsLoading) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return NotificationsModule;
  }
  
  isNotificationsLoading = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // ELITE: Use eval to prevent static analysis
    const moduleName = 'expo-' + 'notifications';
    NotificationsModule = eval(`require('${moduleName}')`);
    return NotificationsModule;
  } catch (error) {
    return null;
  } finally {
    isNotificationsLoading = false;
  }
}

const DIR = '/tmp/';
const FILE = DIR + 'eew.jsonl';

export async function pushEEW(a: EEWAlert){
  const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>'');
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(a)+'\n');
  try{ const s=await loadRiskSettings(); const g = await computeGrid(a, s.stepDeg ?? 0.2); await saveGrid(g); }catch{
    // Ignore grid computation errors
  }
}

export async function listEEW(limit=200): Promise<EEWAlert[]>{
  const ex = await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  const lines = txt.trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map(l=>JSON.parse(l) as EEWAlert);
}

// ELITE: Export notifyEEW as alias for sendEEWNotification for backward compatibility
export const notifyEEW = sendEEWNotification;

export async function sendEEWNotification(a: EEWAlert){
  try {
    const Notifications = await getNotificationsAsync();
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      return;
    }
    
    // ELITE: Validate EEWAlert input
    if (!a || typeof a !== 'object') {
      return;
    }
    
    // ELITE: EEWAlert uses mag, id, lat, lng - compute derived values
    const magnitude = Math.max(0, Math.min(10, a.mag || 0));
    const eventId = String(a.id || '').trim();
    const latitude = typeof a.lat === 'number' && !isNaN(a.lat) ? a.lat : 0;
    const longitude = typeof a.lng === 'number' && !isNaN(a.lng) ? a.lng : 0;
    
    // Note: etaSec and region are computed elsewhere, using defaults here
    const etaSec = 0; // Will be computed by EEW service
    const region = latitude !== 0 && longitude !== 0 
      ? `Lat: ${latitude.toFixed(2)}, Lng: ${longitude.toFixed(2)}`
      : 'Bilinmeyen konum';
    
    // ELITE: Determine priority based on magnitude
    const priority = magnitude >= 6.0 ? 'critical' : magnitude >= 4.5 ? 'high' : 'normal';
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 Erken Uyarı: ${magnitude.toFixed(1)}M`,
        body: `${region} - ${etaSec > 0 ? `${etaSec}s sonra` : 'Tespit edildi'}`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority?.MAX || 5,
        data: {
          type: 'EEW',
          eventId: eventId,
          etaSec: etaSec,
          magnitude: magnitude,
          region: region,
          latitude,
          longitude,
          issuedAt: Date.now(),
          source: 'local',
          priority,
        },
        badge: 1,
      },
      trigger: null,
      ...(Platform.OS === 'android' && {
        android: {
          channelId: magnitude >= 6.0 ? 'sos' : 'earthquake',
          importance: Notifications.AndroidImportance?.MAX || 5,
          vibrationPattern: magnitude >= 6.0 ? [0, 500, 250, 500] : [0, 250, 250, 250],
          priority: magnitude >= 6.0 ? 'high' : 'default',
          sound: 'default',
        },
      }),
    });
  } catch (error) {
    // ELITE: Silent fail - EEW notifications are best-effort
    if (__DEV__) {
      console.debug('EEW notification skipped:', error);
    }
  }
}
