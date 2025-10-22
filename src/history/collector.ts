import * as Location from 'expo-location';
import { toENU } from '../map/localproj';
import { tx, prune } from '../db/core';

let running=false;
let origin:{lat0:number;lon0:number}|null=null;
let last:{lat:number;lon:number;ts:number}|null=null;

export async function startHistory(){
  if (running) {return;} running=true;
  try{
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status!=='granted'){ running=false; return; }
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    origin = { lat0: fix.coords.latitude, lon0: fix.coords.longitude };
  }catch{ /* fail-soft */ }

  const loop = async ()=>{
    while(running){
      try{
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const ts = Date.now();
        // 10m/20s eşiği
        if (last){
          const dt = ts - last.ts;
          const dl = haversine(last.lat,last.lon,loc.coords.latitude,loc.coords.longitude);
          if (dt<20000 && dl<10){ await sleep(5000); continue; }
        }
        const enu = origin ? toENU(loc.coords.latitude, loc.coords.longitude, origin) : { x:null, y:null };
        await tx(async d=>{
          await d.executeSql('INSERT INTO loc_points(ts,lat,lon,acc,enu_x,enu_y) VALUES(?,?,?,?,?,?)',
            [ts, loc.coords.latitude, loc.coords.longitude, loc.coords.accuracy ?? null, enu?.x ?? null, enu?.y ?? null]);
        });
        last = { lat: loc.coords.latitude, lon: loc.coords.longitude, ts };
        await prune();
      }catch{
        // Ignore location collection errors
      }
      await sleep(7000);
    }
  };
  loop();
}

export async function stopHistory(){ running=false; }

export async function listBetween(t0:number, t1:number){
  return tx(async d=>{
    const r = await d.executeSql('SELECT ts,lat,lon,acc FROM loc_points WHERE ts BETWEEN ? AND ? ORDER BY ts ASC', [t0,t1]);
    const out:{ts:number;lat:number;lon:number;acc:number|null}[] = [];
    for (let i=0;i<r[0].rows.length;i++){ const it=r[0].rows.item(i); out.push({ ts: it.ts, lat: it.lat, lon: it.lon, acc: it.acc ?? null }); }
    return out;
  });
}
export function speedsFrom(points:{ts:number;lat:number;lon:number}[]){
  // m/s hızlar (segment bazında)
  const sp:number[]=[]; if(points.length<2) {return sp;}
  for(let i=1;i<points.length;i++){
    const d = haversine(points[i-1].lat,points[i-1].lon,points[i].lat,points[i].lon);
    const dt = Math.max(1, (points[i].ts - points[i-1].ts)/1000);
    sp.push(d/dt);
  }
  return sp;
}

function sleep(ms:number){ return new Promise(res=>(globalThis as any).setTimeout(res,ms)); }
function haversine(lat1:number,lon1:number,lat2:number,lon2:number){
  const R=6371000; const toRad=(x:number)=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
