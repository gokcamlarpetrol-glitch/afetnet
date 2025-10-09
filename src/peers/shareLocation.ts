import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import { quantizeLatLng } from "../geo/coarse";
import { getDeviceShortId } from "../p2p/bleCourier";

const DIR = "/tmp/";
const PEERS = DIR + "peers.volunteers.json";

let on=false; let timer:any=null;

export async function setVolunteerShare(onoff:boolean){
  on = onoff;
  if(on && !timer){
    timer = setInterval(async()=>{
      try{
        const me = await getDeviceShortId?.() || "me";
        const p = await Location.getLastKnownPositionAsync({}); if(!p) {return;}
        const q = quantizeLatLng(p.coords.latitude, p.coords.longitude);
        const ex = await FileSystem.getInfoAsync(PEERS);
        const arr = ex.exists ? JSON.parse(await FileSystem.readAsStringAsync(PEERS)) : [];
        const others = arr.filter((x:any)=>x.id!==me);
        const mine = { id: me, lat: q.lat, lng: q.lng, ts: Date.now() };
        await FileSystem.writeAsStringAsync(PEERS, JSON.stringify([...others, mine]));
      }catch{}
    }, 15000);
  }
  if(!on && timer){ clearInterval(timer); timer=null; }
}



