import { PermissionsAndroid } from "react-native";
import { encodeSOSWithStatus as codecSOSWithStatus, encodeTextV2 as codecTextV2, encodeLoc, encodeTextChunk } from "./codec";
import { SafeBLE } from "./SafeBLE";

async function perm(){
  const perms = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  ];
  for (const p of perms){ await PermissionsAndroid.request(p); }
}

export async function startScan(onFrame:(from:string, frame:any)=>void){
  await perm();
  return SafeBLE.startScan(onFrame);
}

export async function stopScan(){ return SafeBLE.stopScan(); }

export async function advertise(data: Uint8Array){
  await perm();
  return SafeBLE.advertise(data);
}
export async function stopAdvertise(){ 
  return SafeBLE.stopAdvertise();
}

export function encodeLocation(lat:number, lon:number, batt:number, seq:number){ return encodeLoc(lat,lon,batt,seq); }
export function encodeText(seq:number, idx:number, total:number, payload:Uint8Array){ return encodeTextChunk(seq,idx,total,payload); }
export function encodeTextV2(msgId16:number, ttl:number, hops:number, idx:number, total:number, payload:Uint8Array){ return codecTextV2(msgId16, ttl, hops, idx, total, payload); }
export function packLoc2(payload: Uint8Array){
  const b = new Uint8Array(2 + payload.length);
  b[0]=1; b[1]=0x04; b.set(payload, 2);
  return b;
}
export function encodeSOSWithStatus(lat:number, lon:number, batt:number, statuses:string[]){ 
  return codecSOSWithStatus(lat, lon, batt, statuses); 
}
