import * as FileSystem from 'expo-file-system';
import { AuditEvent } from './types';

const FILE = '/tmp/audit.jsonl';
const FLAG = '/tmp/audit.inspect.flag';

export async function writeAudit(actor:'system'|'user', action:string, detail?:Record<string,any>){
  const ev: AuditEvent = { ts: Date.now(), actor, action, detail: sanitize(detail) };
  const existing = await FileSystem.readAsStringAsync(FILE).catch(()=>'');
  await FileSystem.writeAsStringAsync(FILE, existing + JSON.stringify(ev)+'\n');
  try{
    const txt = await FileSystem.readAsStringAsync(FILE);
    const lines = txt.split('\n').filter(Boolean);
    if(lines.length>500){ const keep = lines.slice(-500).join('\n'); await FileSystem.writeAsStringAsync(FILE, keep); }
  }catch{
    // Ignore file truncation errors
  }
}
function sanitize(d?:Record<string,any>){ if(!d) {return d;}
  const out = { ...d }; if(out['name']) {out['name']='*';} if(out['phone']) {out['phone']='*';} if(out['email']) {out['email']='*';} return out;
}

export async function readAudit(limit=300): Promise<AuditEvent[]>{
  const ex = await FileSystem.getInfoAsync(FILE); if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(FILE);
  return txt.split('\n').filter(Boolean).slice(-limit).map(l=>{ try{return JSON.parse(l);}catch{
    // Ignore JSON parse errors
    return null;
  } }).filter(Boolean) as AuditEvent[];
}

export async function setInspect(on:boolean){
  if(on){ await FileSystem.writeAsStringAsync(FLAG, '1'); }
  else{ await FileSystem.deleteAsync(FLAG, { idempotent:true }); }
}

export async function isInspect(): Promise<boolean>{
  const ex = await FileSystem.getInfoAsync(FLAG); return !!ex.exists;
}
