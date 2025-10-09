import * as Battery from "expo-battery";
const arr: number[] = [];

export async function startBatt(){
  const lvl = await Battery.getBatteryLevelAsync().catch(()=>null);
  if (lvl!=null) {arr.push(Math.round(lvl*100));}
  setInterval(async ()=>{
    const v = await Battery.getBatteryLevelAsync().catch(()=>null);
    if (v!=null){
      arr.push(Math.round(v*100));
      if (arr.length>60) {arr.shift();}
    }
  }, 60_000);
}

export function getBattSeries(){ return arr.slice(); }



