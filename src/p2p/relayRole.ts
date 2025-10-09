import * as Battery from "expo-battery";

export type RelayRole = "carrier"|"normal"|"sos_only";

let role: RelayRole="normal";

export async function updateRelayRole(){
  try{
    const lvl = await Battery.getBatteryLevelAsync(); // 0–1
    if(lvl===null) {return role;}
    if(lvl>0.6) {role="carrier";}
    else if(lvl>0.2) {role="normal";}
    else {role="sos_only";}
  }catch{}
  return role;
}
export function getRelayRole(){ return role; }



