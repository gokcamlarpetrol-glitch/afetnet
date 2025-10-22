import * as FileSystem from 'expo-file-system';

const DIR = '/tmp/';

export type OpRow = {
  ts: number;
  type: 'msg'|'sos'|'evidence'|'attest'|'board'|'logistics'|'system';
  id?: string;
  ref?: string;
  note?: string;
};

async function readLines(path:string, max=2000){
  const ex = await FileSystem.getInfoAsync(path);
  if(!ex.exists) {return [];}
  const txt = await FileSystem.readAsStringAsync(path);
  return txt.split('\n').filter(Boolean).slice(-max);
}

export async function collect(): Promise<OpRow[]>{
  const rows: OpRow[] = [];
  // messages
  for(const ln of await readLines(DIR+'msg.inbox.jsonl', 5000)){
    try{ const m = JSON.parse(ln); rows.push({ ts:m.ts, type: m.kind==='sos'?'sos':'msg', id:m.id, ref:m.threadId, note:m.body?.slice?.(0,60) }); }catch{
      // Ignore JSON parse errors
    }
  }
  for(const ln of await readLines(DIR+'p2p.outbox.jsonl', 5000)){
    try{ const m = JSON.parse(ln); if(m.kind==='evidence_notice'){ rows.push({ ts:m.ts, type:'evidence', id:m.id, note:'notice' }); } }catch{
      // Ignore JSON parse errors
    }
  }
  // evidence / attest files
  try{
    const ev = await FileSystem.readDirectoryAsync(DIR+'evidence/');
    for(const f of ev){
      if(f.endsWith('_signature.json')){ rows.push({ ts: Date.now(), type:'evidence', ref:f, note:'signature' }); }
      if(f.startsWith('attest/')){ rows.push({ ts: Date.now(), type:'attest', ref:f }); }
    }
  }catch{
    // Ignore errors
  }
  // board
  try{
    const b = JSON.parse(await FileSystem.readAsStringAsync(DIR+'board.json'));
    for(const it of b){ rows.push({ ts: it.ts, type:'board', id: it.id, note: `${it.kind}:${(it.text||'').slice(0,60)}` }); }
  }catch{
    // Ignore errors
  }
  // logistics
  try{
    const l = JSON.parse(await FileSystem.readAsStringAsync(DIR+'logistics.json'));
    for(const it of l){ rows.push({ ts: it.ts, type:'logistics', id: it.id, note: `${it.mode}:${it.cat}` }); }
  }catch{
    // Ignore errors
  }
  // sort
  return rows.sort((a,b)=>a.ts-b.ts).slice(-5000);
}

export function toCSV(rows: OpRow[]){
  const esc = (s:any)=> `"${String(s??'').replace(/"/g,'""')}"`;
  const head = 'ts,type,id,ref,note';
  const body = rows.map(r=>[r.ts, r.type, r.id||'', r.ref||'', r.note||''].map(esc).join(',')).join('\n');
  return head+'\n'+body;
}
