import { loadFamily } from './store';
import { broadcastTicket } from '../help/mesh';
let t:any=null;
export function startFamilyWatch(){
  if(t) {(globalThis as any).clearInterval(t);}
  t=(globalThis as any).setInterval(async()=>{
    const arr = await loadFamily();
    const now = Date.now();
    for(const f of arr){
      if(f.lastSeen && now - f.lastSeen > 2*60*60*1000){ // 2h no heartbeat ⇒ missing
        await broadcastTicket({
          id:'h_miss_'+now.toString(36),
          requesterId: 'current_user',
          title:`${f.name} bağlantı yok`,
          description:'Son heartbeat >2saat',
          detail:'Son heartbeat >2saat',
          kind:'rescue',
          prio:'urgent',
          priority:'high',
          status:'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ts: now,
          qlat:f.qlat,
          qlng:f.qlng
        });
      }
    }
  }, 10*60*1000);
}



