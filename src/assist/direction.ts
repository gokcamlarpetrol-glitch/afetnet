/**
 * Acoustic direction estimation (heuristic):
 * - We can't access raw stereo PCM easily with expo-av mic on all devices.
 * - We approximate "bearing to max signal" by sampling mic level while the user rotates the phone.
 * - Keep last N samples: {headingDeg, level0..1}, compute heading where level was max.
 * - Haptic guidance pulses when user heading approaches target heading.
 */
import * as Haptics from "expo-haptics";

type Sample = { h: number; l: number; t: number };
const buf: Sample[] = [];
let target: number | null = null;

export function resetDir(){ buf.length = 0; target = null; }
export function pushSample(headingDeg:number, level01:number){
  buf.push({ h: ((headingDeg%360)+360)%360, l: Math.max(0, Math.min(1, level01)), t: Date.now() });
  if (buf.length>120) {buf.shift();}
  // recompute target as the heading with highest 90th percentile over last 10s
  const recent = buf.filter(s=> Date.now()-s.t < 10000);
  if (!recent.length) {return;}
  const sorted = recent.slice().sort((a,b)=> b.l - a.l);
  const pick = sorted[Math.min( Math.floor(sorted.length*0.1), sorted.length-1 )];
  target = pick?.h ?? null;
}

export function getTarget(){ return target; }

/** Returns -180..+180 signed diff: positive means "turn right" */
export function headingDiff(currentDeg:number){
  if (target==null) {return null;}
  const d = ((target - currentDeg + 540) % 360) - 180;
  return d;
}

/** Haptic feedback: faster pulses when |diff| small and level higher */
export async function hapticFor(diff:number|null, level01:number){
  if (diff==null) {return;}
  const a = Math.abs(diff);
  if (a < 10 && level01>0.6) {await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);}
  else if (a < 30 && level01>0.4) {await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);}
  else if (a < 60 && level01>0.25) {await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);}
}



