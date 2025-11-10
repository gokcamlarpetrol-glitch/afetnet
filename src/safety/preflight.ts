import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { SafetyReport } from './types';

export async function runPreflight(): Promise<SafetyReport>{
  const checks: SafetyReport['checks'] = [];
  try{
    const n = await Notifications.getPermissionsAsync();
    checks.push({ key:'notifPerm', ok: n.granted===true, note: n.granted? 'OK':'Bildirim izni yok' });
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



