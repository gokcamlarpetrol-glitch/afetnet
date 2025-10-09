import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Brightness from "expo-brightness";
import { setDutyCycle } from "../ble/bridge";
import { noteConfigConflict } from "../diag/autoLog";

const KEY="afn:epm:v1";
type Snapshot = { scan:number; pause:number; brightness:number };
let on = false;
let snap: Snapshot | null = null;

export function isEpmOn(){ return on; }

export async function enableEPM(){
  if (on) {return;}
  on = true;
  // capture brightness
  let b=0.5;
  try{ b = await Brightness.getBrightnessAsync(); }catch{}
  snap = { scan: 6000, pause: 4000, brightness: b }; // defaults; may be overridden by last known
  // read last custom baseline (optional)
  try{
    const raw = await AsyncStorage.getItem("afn:duty:last");
    if (raw){
      const d = JSON.parse(raw);
      snap.scan = d.scan ?? snap.scan;
      snap.pause = d.pause ?? snap.pause;
    }
  }catch{}
  // apply low-power profile
  setDutyCycle(3000, 12000);
  noteConfigConflict("EPM enabled → duty 3/12 enforced");
  try{ await Brightness.setBrightnessAsync(Math.max(0.02, Math.min(0.15, b*0.35))); }catch{}
  await AsyncStorage.setItem(KEY, JSON.stringify({ on: true }));
}

export async function disableEPM(){
  if (!on) {return;}
  on = false;
  // restore duty + brightness
  if (snap){ setDutyCycle(snap.scan, snap.pause); try{ await Brightness.setBrightnessAsync(snap.brightness); }catch{} }
  await AsyncStorage.setItem(KEY, JSON.stringify({ on: false }));
}

export async function loadEpmState(){
  try{
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : { on:false };
    if (v.on) {await enableEPM();}
  }catch{}
}
