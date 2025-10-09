import { setLatestEEW } from "./state";
import * as Notifications from "expo-notifications";

const ringSeen = new Set<string>();
export async function handleEEWIncoming(m:any){
  if(m.kind!=="eew_alert" || !m.id) {return;}
  const id=String(m.id); if(ringSeen.has(id)) {return;} ringSeen.add(id); setTimeout(()=>ringSeen.delete(id), 120_000);
  await setLatestEEW({ id, mag: Number.isFinite(m.mag)? Number(m.mag): NaN, distKm: m.distKm, when: Date.now(), src:"gateway" });
  try{ await Notifications.scheduleNotificationAsync({ content:{ title:"Deprem Uyarısı", body:"Acil korunma pozisyonu alın." }, trigger:null }); }catch{}
  // forward ring if ttl/hop allow (simplified)
  const ttl = (m.ttl||0)-1; const hop = (m.ring||0)+1;
  if(ttl>0 && hop<8){ const { p2pLocalSend } = require("../p2p/send"); p2pLocalSend({ ...m, ttl, ring: hop }); }
}
