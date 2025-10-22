/**
 * Simple acoustic transport: encodes short Base32 payload into ultrasonic tones.
 * Payload: { id, threadId, kind, body(<=12c), ts }
 * WARNING: demo-grade, not cryptographic, bandwidth ~10bps.
 */
import { Audio } from 'expo-av';
 
import * as Crypto from 'expo-crypto';
import { Msg } from '../msg/types';
 
import { appendInbox, appendOutbox } from '../msg/store';

function base32encode(bytes: Uint8Array){
  const alph = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let out=''; let val=0, valb=-5;
  for(const b of bytes){
    val = (val<<8)|b; valb+=8;
    while(valb>=0){ out+=alph[(val>>valb)&31]; valb-=5; }
  }
  if(valb>-5) {out+=alph[((val<<8)>>(valb+5))&31];}
  return out;
}
function base32decode(str:string){
  const alph = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; const map:Record<string,number>={};
  for(let i=0;i<alph.length;i++) {map[alph[i]]=i;}
  let val=0,valb=-5;
  const out: number[] = [];
  for(const c of str){
    if(map[c]===undefined) {continue;}
    val=(val<<5)|(map[c] as number); valb+=5;
    if(valb>=8){ out.push((val>> (valb-8)) & 255); valb-=8; }
  }
  return new Uint8Array(out);
}

export async function acousticSend(m: Msg){
  const txt = JSON.stringify({ id:m.id, t:m.threadId, k:m.kind, b:m.body, ts:m.ts });
  const bytes = new (globalThis as any).TextEncoder().encode(txt);
  const code = base32encode(bytes).slice(0,16); // limit ~16 chars
  // For each char, play tone
  for(const c of code){
    const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);
    if(idx<0) {continue;}
    const tone = new Audio.Sound();
    // generate tone buffer? (omitted: in real code use AudioContext or expo-av tone generation)
    await tone.unloadAsync();
  }
}

export async function acousticReceive(payload:string){
  try{
    const bytes = base32decode(payload);
    const txt = new (globalThis as any).TextDecoder().decode(bytes);
    const o = JSON.parse(txt);
    const m: Msg = { v:1, id:o.id, threadId:o.t, from:'acoustic', ts:o.ts, kind:o.k, body:o.b, ttlSec:3600, hops:0, maxHops:1 };
    await appendInbox(m);
    return m;
  }catch{
    // Ignore errors
  }
}



