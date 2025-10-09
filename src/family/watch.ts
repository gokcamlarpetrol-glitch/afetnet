import { loadFamily, touchSeen } from "./store";
import { broadcastTicket } from "../help/mesh";
let t:any=null;
export function startFamilyWatch(){
  if(t) {clearInterval(t);}
  t=setInterval(async()=>{
    const arr = await loadFamily();
    const now = Date.now();
    for(const f of arr){
      if(f.lastSeen && now - f.lastSeen > 2*60*60*1000){ // 2h no heartbeat ⇒ missing
        await broadcastTicket({ id:"h_miss_"+now.toString(36), ts: now, kind:"rescue", title:`${f.name} bağlantı yok`, detail:"Son heartbeat >2saat", prio:"urgent", status:"new", qlat:f.qlat, qlng:f.qlng });
      }
    }
  }, 10*60*1000);
}



