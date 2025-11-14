import { Accelerometer, Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { appendTrail } from './store';

let run=false;
let lastGps: {lat:number;lng:number;ts:number}|null=null;
let stepCount=0; let lastStepTs=0; let heading=0;
let stateUpdateInterval: ReturnType<typeof setInterval> | null = null; // ELITE: Track interval for cleanup

export async function startPDR(){
  if(run) {return;} run=true;
  // heading
  Magnetometer.setUpdateInterval(200);
  const m = Magnetometer.addListener((d)=>{ heading = (Math.atan2(d.y, d.x) * 180/Math.PI + 360) % 360; });
  // accel step
  Accelerometer.setUpdateInterval(80);
  const a = Accelerometer.addListener(async({ x,y,z })=>{
    const g = Math.sqrt(x*x+y*y+z*z);
    const now = Date.now();
    if(g>1.12 && (now-lastStepTs)>300){ // crude peak & refractory
      stepCount++; lastStepTs=now;
      // attempt PDR update if no fresh GPS
      const pos = await Location.getLastKnownPositionAsync({}); 
      if(pos && (now - (pos?.timestamp||0) < 4000)){
        // trust GPS; reset anchor
        lastGps = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: now };
        await appendTrail({ ts: now, lat: lastGps.lat, lng: lastGps.lng, src:'gps' });
      }else if(lastGps){
        const d = 0.7; // meters/step
        const rad = (heading) * Math.PI/180;
        const dLat = (d * Math.cos(rad)) / 111320; // meters to deg
        const dLng = (d * Math.sin(rad)) / (111320 * Math.cos(lastGps.lat*Math.PI/180));
        lastGps = { lat: lastGps.lat + dLat, lng: lastGps.lng + dLng, ts: now };
        await appendTrail({ ts: now, lat: lastGps.lat, lng: lastGps.lng, src:'pdr' });
      }
    }
  });
  // initial GPS anchor
  try{ const p = await Location.getLastKnownPositionAsync({}); if(p){ lastGps={ lat:p.coords.latitude, lng:p.coords.longitude, ts: Date.now() }; await appendTrail({ ts: Date.now(), lat:lastGps.lat, lng:lastGps.lng, src:'gps' }); } }catch{
    // Ignore GPS errors
  }
  // ELITE: Type-safe stop handle
  (startPDR as typeof startPDR & { _stop?: () => void })._stop = () => {
    run = false;
    m.remove();
    a.remove();
  };
}
export function stopPDR(){ 
  (startPDR as any)?._stop?.();
  // ELITE: Cleanup state update interval
  if (stateUpdateInterval) {
    (globalThis as any).clearInterval(stateUpdateInterval);
    stateUpdateInterval = null;
  }
}

// Legacy compatibility for existing screens
export const state = { stepCount: 0, heading: 0 };
export function reset(){ stepCount = 0; }
export function start(){ return startPDR(); }

// Update state for legacy compatibility
// ELITE: Store interval ID for cleanup
stateUpdateInterval = (globalThis as any).setInterval(() => {
  state.stepCount = stepCount;
  state.heading = heading;
}, 1000);