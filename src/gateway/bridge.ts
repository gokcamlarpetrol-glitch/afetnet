import * as Power from "expo-battery";
import NetInfo from "@react-native-community/netinfo";
import { pollQuakes } from "../quake/fetchers";
import { listBulletins, addBulletin } from "../ops/bulletinStore";
import { broadcastBulletin } from "../ops/bulletinMesh";
import { applyTileDiff } from "../map/tilediff";

let on=false; let t:any=null;

export async function startGateway(){
  on=true;
  if(t) {clearInterval(t);}
  t=setInterval(async()=>{
    if(!on) {return;}
    try{
      const p = await Power.getPowerStateAsync(); const net = await NetInfo.fetch();
      const ok = ((p as any).isCharging || (p.batteryLevel||0)>=0.8) && !!net.isConnected;
      if(!ok) {return;}
      // 1) Deprem fonu: poll + log (already notifies locally)
      await pollQuakes();

      // 2) Kurum duyuruları varsa (varsayım: online API ile) → simge: örnek amaçlı son yerel duyuruyu yayınla
      const bs = await listBulletins(10); if(bs.length){ await broadcastBulletin(bs[bs.length-1]); }

      // 3) Karo güncelleme (opsiyonel diff URL biliniyorsa)
      // await applyTileDiff("https://example.com/tiles/diff.json");
    }catch{}
  }, 60_000);
}

export function stopGateway(){ on=false; if(t){ clearInterval(t); t=null; } }
