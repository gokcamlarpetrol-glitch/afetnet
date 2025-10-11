import { decodeULB } from "./codec";
import { subscribeULB } from "./p2p_sub";

type Acc = { total:number; parts:Set<number>; hasParity:boolean; ts:number };
const acc: Record<string,Acc> = {};

export function initNAK(){
  return subscribeULB(async (raw:string)=>{
    try{
      const obj = JSON.parse(raw);
      if(!obj || !obj.gid || obj.idx==null) {return;}
      const a = acc[obj.gid] || (acc[obj.gid] = { total: obj.total, parts: new Set(), hasParity:false, ts: Date.now() });
      if(obj.parity) {a.hasParity=true;} else {a.parts.add(Number(obj.idx));}
      // if after small delay we still miss some, emit NAK
      setTimeout(()=> {
        const arr:number[]=[]; for(let i=0;i<a.total;i++){ if(!a.parts.has(i)) {arr.push(i);} }
        if(arr.length>0 && a.hasParity && (Date.now()-a.ts>500)){
          // call back to broadcaster (local optimization) — for remote, receiver would broadcast a nak ulb payload
          const fn = (global as typeof globalThis).__AFN_ULB_NAK__; if(typeof fn==="function") {fn(obj.gid, arr);}
        }
      }, 600);
    }catch{}
  });
}



