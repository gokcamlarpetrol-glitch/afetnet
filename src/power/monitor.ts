import * as Battery from "expo-battery";
import { useProfile } from "../state/profileStore";

let started=false;
export async function startPowerMonitor(){
  if(started) {return;} started=true;
  try{
    const lev = await Battery.getBatteryLevelAsync();
    if(lev<=0.15){ useProfile.getState().setProfile("low_power"); }
    Battery.addBatteryLevelListener(({ batteryLevel })=>{
      if(batteryLevel<=0.08){ useProfile.getState().setProfile("silent"); }
      else if(batteryLevel<=0.15){ useProfile.getState().setProfile("low_power"); }
    });
  }catch{}
}



