import * as Battery from 'expo-battery';
const arr: number[] = [];
let batteryInterval: ReturnType<typeof setInterval> | null = null; // ELITE: Track interval for cleanup

export async function startBatt(){
  const lvl = await Battery.getBatteryLevelAsync().catch(()=>null);
  if (lvl!=null) {arr.push(Math.round(lvl*100));}
  // ELITE: Store interval ID for cleanup
  batteryInterval = (globalThis as any).setInterval(async ()=>{
    const v = await Battery.getBatteryLevelAsync().catch(()=>null);
    if (v!=null){
      arr.push(Math.round(v*100));
      if (arr.length>60) {arr.shift();}
    }
  }, 60_000);
}

export function stopBatt(){
  // ELITE: Cleanup battery monitoring interval
  if (batteryInterval) {
    (globalThis as any).clearInterval(batteryInterval);
    batteryInterval = null;
  }
}

export function getBattSeries(){ return arr.slice(); }



