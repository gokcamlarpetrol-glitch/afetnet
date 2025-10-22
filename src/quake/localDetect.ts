import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { setLatestEEW } from './state';
import { p2pLocalSend } from '../p2p/send';

let sub:any=null; let on=false;
export function startEEWLocal(){
  if(on) {return;} on=true;
  const buf:number[]=[]; let last=0;
  sub = Accelerometer.addListener(({ x,y,z })=>{
    const g = Math.sqrt(x*x+y*y+z*z);
    buf.push(g); if(buf.length>50) {buf.shift();}
    const mean = buf.reduce((a,b)=>a+b,0)/(buf.length||1);
    const varr = buf.reduce((a,b)=>a+(b-mean)*(b-mean),0)/(buf.length||1);
    // simple STA/LTA-lite: short spike + variance jump
    const spike = g>1.45 && varr>0.05;
    const now = Date.now();
    if(spike && now-last>20_000){ // debounce 20s
      last=now;
      const q = { id:'eew_'+now.toString(36), mag: NaN, when: now, src:'local' as const };
      setLatestEEW(q as any).catch(()=>{});
      notifyLocal('Sarsıntı Algılandı', 'Hemen güvenli pozisyona geçin.');
      p2pLocalSend({ kind:'eew_alert', v:1, id:q.id, mag:null, ts:now, ttl:30, ring:1 }).catch(()=>{});
    }
  });
  Accelerometer.setUpdateInterval(50);
}
export function stopEEWLocal(){ on=false; try{ sub && sub.remove(); }catch{
  // Ignore errors
} sub=null; }
async function notifyLocal(title:string, body:string){
  try{
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    await Notifications.scheduleNotificationAsync({ content:{ title, body }, trigger:null });
  }catch{
    // Ignore errors
  }
}



