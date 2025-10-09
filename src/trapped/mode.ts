import { Accelerometer } from "expo-sensors";
import * as Haptics from "expo-haptics";
import { sendULB } from "../ulb/api";
import { startAudioDetect, stopAudioDetect } from "../audio/detect";
import { playPingLoop, stopPing } from "../sos/pinger";

let sub:any=null; let on=false; let lastMove=Date.now(); let timer:any=null;

export function startTrapped(){
  if(on) {return;} on=true; lastMove=Date.now();
  sub = Accelerometer.addListener(({x,y,z})=>{
    const g = Math.sqrt(x*x+y*y+z*z);
    if(Math.abs(g-1)>0.08){ lastMove=Date.now(); }
  });
  Accelerometer.setUpdateInterval(500);
  startAudioDetect();
  playPingLoop();
  timer = setInterval(async()=>{
    const idle = Date.now()-lastMove;
    if(idle > 5*60_000){ // 5 dk hareketsiz
      await sendULB("sos","TRAPPED"); // ACK ile tekrarlar outbox tarafından yönetilir
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, 60_000);
}
export function stopTrapped(){
  on=false; try{ sub?.remove(); }catch{} sub=null;
  stopAudioDetect(); stopPing();
  if(timer){ clearInterval(timer); timer=null; }
}



