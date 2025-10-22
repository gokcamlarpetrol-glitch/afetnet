import * as FileSystem from 'expo-file-system';
import { HelpTicket } from '../relief/types';
const FILE = '/tmp/help.queue.jsonl';

export async function addTicket(t: HelpTicket){
  const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>'');
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(t)+'\n');
}
export async function listTickets(limit=200): Promise<HelpTicket[]>{
  const ex = await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  return txt.split('\n').filter(Boolean).slice(-limit).map(l=>{ try{return JSON.parse(l);}catch{return null;} }).filter(Boolean) as HelpTicket[];
}
export async function updateTicket(id:string, patch: Partial<HelpTicket>){
  const arr = await listTickets(500);
  const out = arr.map(x=> x.id===id? { ...x, ...patch }: x);
  await FileSystem.writeAsStringAsync(FILE, out.map(x=>JSON.stringify(x)).join('\n'));
}



