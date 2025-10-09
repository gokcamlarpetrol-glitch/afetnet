import * as Battery from "expo-battery";
import * as Location from "expo-location";
// import * as Beacon from "../ble/bridge"; // Removed to break circular dependency
import { note as logNote } from "../diag/autoLog";
let t:any=null, lastPkt=Date.now();

export function markBlePacket(){ lastPkt = Date.now(); }

export function startWatchdogs(){
  if (t) {return;}
  t = setInterval(async()=>{
    // BLE watchdog
    if (Date.now()-lastPkt > 45_000){
      logNote("WD BLE: restart scan");
      try{ 
        // Dynamic import to avoid circular dependency
        const { stop, start } = await import("../ble/bridge");
        await stop(); 
        await new Promise(r=>setTimeout(r,300)); 
        await start({}); 
      }catch{}
      lastPkt = Date.now();
    }
    // History watchdog
    try{
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status==="granted"){
        // ping location each 2 min to wake sensors
        if ((Date.now()%120_000) < 1500) {await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });}
      }
    }catch{}
    // EPM battery thresholds
    try{
      const lvl = await Battery.getBatteryLevelAsync();
      if (lvl!=null){
        const pct = Math.round(lvl*100);
        if (pct<=5){
          try{
            const epm = require("../power/epm");
            await epm.enableEPM();
            logNote("WD EPM: forced enable at 5%");
          }catch{}
        }
      }
    }catch{}
  }, 5000);
}
export function stopWatchdogs(){ if (t){ clearInterval(t); t=null; } }
