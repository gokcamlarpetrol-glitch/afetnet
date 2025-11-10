import * as Haptics from 'expo-haptics';
import { haversine } from '../geo/haversine';

let t:any=null;

export function startHapticHeading(getHead:()=>number, getMe:()=>{lat:number;lng:number}|null, getTarget:()=>{lat:number;lng:number}|null){
  stopHapticHeading();
  async function loop(){
    const target = getTarget(); const me = getMe();
    if(!target || !me){ t=(globalThis as any).setTimeout(loop, 1500) as any; return; }
    const head = getHead(); // 0..360, 0=N
    const bearing = bearingTo(me, target);
    const d = normAngle(bearing - head); // -180..180
    const dist = haversine(me, target); // m

    // pattern rate by distance
    const period = dist>800 ? 1800 : dist>300 ? 1200 : 700;

    if(Math.abs(d) <= 15){
      // on course → short tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    }else{
      if(d>0){
        // need to turn right → two long taps
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
        await sleep(120);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
      }else{
        // turn left → two short taps
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
        await sleep(120);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
      }
    }
    t=(globalThis as any).setTimeout(loop, period) as any;
  }
  loop();
}
export function stopHapticHeading(){ if(t){ (globalThis as any).clearTimeout(t); t=null; } }

function bearingTo(a:{lat:number;lng:number}, b:{lat:number;lng:number}){
  const toR=(x:number)=>x*Math.PI/180;
  const y = Math.sin(toR(b.lng-a.lng))*Math.cos(toR(b.lat));
  const x = Math.cos(toR(a.lat))*Math.sin(toR(b.lat)) - Math.sin(toR(a.lat))*Math.cos(toR(b.lat))*Math.cos(toR(b.lng-a.lng));
  const br = Math.atan2(y,x)*180/Math.PI;
  return (br+360)%360;
}
function normAngle(a:number){ const x=((a+540)%360)-180; return x; }
function sleep(ms:number){ return new Promise(r=>(globalThis as any).setTimeout(r,ms)); }



