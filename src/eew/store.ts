import { create } from 'zustand';

export type ActiveEEW = {
  eventId: string;
  etaSec: number;
  mag?: number;
  region?: string;
  issuedAt: number;
  source: string;
};

type EEWState = {
  active?: ActiveEEW;
  setActive: (a: ActiveEEW) => void;
  clear: () => void;
};

export const useEEWStore = create<EEWState>((set) => ({
  active: undefined,
  setActive: (a) => set({ active: a }),
  clear: () => set({ active: undefined }),
}));

import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { EEWAlert } from './types';
import { computeGrid, saveGrid } from '../risk/grid';
import { loadRiskSettings } from '../risk/settings';

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
  const lines = txt.split('\n').filter(Boolean).slice(-limit);
  return lines.map(l=>{ try{return JSON.parse(l);}catch{return null;} }).filter(Boolean) as EEWAlert[];
}

export async function notifyEEW(a: EEWAlert){
  const body = `M${a.mag.toFixed(1)} • ${a.lat.toFixed(2)}, ${a.lng.toFixed(2)} • ${new Date(a.ts).toLocaleTimeString()}`;
  await Notifications.scheduleNotificationAsync({ content: { title: 'Erken Uyarı (Deneysel)', body, priority: Notifications.AndroidNotificationPriority.MAX }, trigger: null });
}
