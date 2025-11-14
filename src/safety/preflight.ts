// ELITE: Zero static dependencies - lazy load expo-notifications
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { SafetyReport } from './types';

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

export async function runPreflight(): Promise<SafetyReport>{
  const checks: SafetyReport['checks'] = [];
  try{
    const Notifications = await getNotificationsAsync();
    if (Notifications && typeof Notifications.getPermissionsAsync === 'function') {
      const n = await Notifications.getPermissionsAsync();
      checks.push({ key:'notifPerm', ok: n.granted===true, note: n.granted? 'OK':'Bildirim izni yok' });
    } else {
      checks.push({ key:'notifPerm', ok:false, note:'Modül yüklenemedi' });
    }
  }catch{ checks.push({ key:'notifPerm', ok:false, note:'hata' }); }

  try{
    const l = await Location.getForegroundPermissionsAsync();
    checks.push({ key:'locPerm', ok: l.granted===true, note: l.granted? 'OK':'Konum izni yok' });
  }catch{ checks.push({ key:'locPerm', ok:false, note:'hata' }); }

  // DataPack / TilePack var mı?
  const tiles = await FileSystem.getInfoAsync('/tmp/tiles/');
  checks.push({ key:'tilePack', ok: tiles.exists===true, note: tiles.exists? 'Var':'Yok' });

  const roads = await FileSystem.getInfoAsync('/tmp/roads.graph.json');
  checks.push({ key:'roadGraph', ok: roads.exists===true, note: roads.exists? 'Var':'Yok' });

  const eew = await FileSystem.getInfoAsync('/tmp/eew.jsonl');
  checks.push({ key:'eewLog', ok: eew.exists===true, note: eew.exists? 'Var':'Yok' });

  return { time: Date.now(), checks };
}
