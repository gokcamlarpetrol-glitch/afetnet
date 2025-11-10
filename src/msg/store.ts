import * as FileSystem from 'expo-file-system';
import { InboxItem, Msg } from './types';
import { openDecrypt, EncEnvelope } from './e2eeEnvelope';

const DIR = '/tmp/';
const INBOX = DIR + 'msg.inbox.jsonl';      // append-only for received (dedup by id)
const OUTBOX = DIR + 'msg.outbox.jsonl';    // append-only for to-send/forward
const ACKDB = DIR + 'msg.acks.json';        // map: msgId -> true

function now(){ return Date.now(); }
function cutoff(ttlSec:number, ts:number){ return (now()-ts) <= ttlSec*1000; }

export async function appendInbox(m: Msg){
  // dedup by id
  const ex = await FileSystem.getInfoAsync(INBOX);
  const body = ex.exists ? await FileSystem.readAsStringAsync(INBOX) : '';
  if(body.includes(`"${m.id}"`)) {return;} // coarse dedup; OK for short logs
  await FileSystem.writeAsStringAsync(INBOX+'.tmp', body + JSON.stringify(m)+'\n');
  await FileSystem.moveAsync({ from: INBOX+'.tmp', to: INBOX });
}

export async function listInbox(threadId?:string, limit=200): Promise<InboxItem[]>{
  const ex = await FileSystem.getInfoAsync(INBOX);
  if(!ex.exists) {return [];}
  const body = await FileSystem.readAsStringAsync(INBOX);
  const lines = body.split('\n').filter(Boolean).slice(-1000);
  const items: InboxItem[] = [];
  for(const ln of lines){
    try{
      const m = JSON.parse(ln) as InboxItem;
      if(!cutoff(m.ttlSec, m.ts)) {continue;}
      if(!threadId || m.threadId===threadId) {
        // try E2EE unwrap
        if(typeof m.body==='string' && m.body.startsWith('{') && m.body.includes('"_e2ee"')){
          try{
            const o = JSON.parse(m.body);
            if(o?._e2ee && o?.env){
              const r = await openDecrypt(o.env as EncEnvelope);
              if(r.ok) {(m as any).__dec = r.text;}
            }
          }catch{
            // Ignore decryption errors
          }
        }
        items.push(m);
      }
    }catch{
      // Ignore file read errors
    }
  }
  // sort by time
  return items.sort((a,b)=>a.ts-b.ts).slice(-limit);
}

export async function appendOutbox(m: Msg){
  const ex = await FileSystem.getInfoAsync(OUTBOX);
  const cur = ex.exists ? await FileSystem.readAsStringAsync(OUTBOX) : '';
  await FileSystem.writeAsStringAsync(OUTBOX+'.tmp', cur + JSON.stringify(m)+'\n');
  await FileSystem.moveAsync({ from: OUTBOX+'.tmp', to: OUTBOX });
}

export async function readOutboxBatch(max=20): Promise<Msg[]>{
  const ex = await FileSystem.getInfoAsync(OUTBOX);
  if(!ex.exists) {return [];}
  const body = await FileSystem.readAsStringAsync(OUTBOX);
  const lines = body.split('\n').filter(Boolean);
  const items: Msg[] = [];
  for(const ln of lines){
    try{
      const m = JSON.parse(ln) as Msg;
      if(!cutoff(m.ttlSec, m.ts)) {continue;}
      if(m.hops >= m.maxHops) {continue;}
      items.push(m);
      if(items.length>=max) {break;}
    }catch{
      // Ignore JSON parse errors
    }
  }
  return items;
}

export async function markAcked(msgId:string){
  const ex = await FileSystem.getInfoAsync(ACKDB);
  const cur = ex.exists ? JSON.parse(await FileSystem.readAsStringAsync(ACKDB)) : {};
  if(!cur[msgId]){ cur[msgId]=true; await FileSystem.writeAsStringAsync(ACKDB, JSON.stringify(cur)); }
}

export async function isAcked(msgId:string): Promise<boolean>{
  const ex = await FileSystem.getInfoAsync(ACKDB);
  if(!ex.exists) {return false;}
  try{ const cur = JSON.parse(await FileSystem.readAsStringAsync(ACKDB)); return !!cur[msgId]; }catch{ return false; }
}
