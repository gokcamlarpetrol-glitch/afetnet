import { enqueue } from "../mesh/queue";
import { quantizeLatLng } from "../geo/coarse";
import * as Location from "expo-location";

export async function sendULB(type:"text"|"sos"|"hb"|"rv", body?:string, to?:string){
  const id = "ulb_"+Date.now().toString(36).slice(2,8);
  let q:any=undefined;
  try{ const p=await Location.getLastKnownPositionAsync({}); if(p){ q=quantizeLatLng(p.coords.latitude,p.coords.longitude); } }catch{}
  const payload = { kind:"ulb_msg", v:1, id, type, body, to, qlat:q?.lat, qlng:q?.lng, ts: Date.now() };
  await enqueue(payload, "msg");
  return id;
}
export async function ackULB(id:string){
  const a = { kind:"ulb_ack", v:1, id, seenBy:"me", ts: Date.now() };
  await enqueue(a, "ack");
}



