import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';

const DIR = '/tmp/';
const FILE = DIR + 'quakes.log.jsonl';

export type Quake = { id:string; ts:number; lat:number; lng:number; depth?:number; mag:number; src:'AFAD'|'KANDILLI'|'USGS'|'LOCAL' };

export async function appendQuake(q: Quake){
  const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>'');
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(q)+'\n');
}

export async function readQuakes24h(): Promise<Quake[]>{
  const ex = await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  const lines = txt.split('\n').filter(Boolean);
  const t0 = Date.now()-24*3600*1000;
  const arr = lines.map(l=>{ try{return JSON.parse(l);}catch{return null;} }).filter(Boolean) as Quake[];
  return arr.filter(q=>q.ts>=t0);
}

export async function notifyQuake(q: Quake){
  await Notifications.scheduleNotificationAsync({
    content: { title: `Deprem M${q.mag.toFixed(1)} (${q.src})`, body: `${q.lat.toFixed(3)}, ${q.lng.toFixed(3)} • ${new Date(q.ts).toLocaleTimeString()}` },
    trigger: null,
  });
}
