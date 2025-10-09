import { p2pLocalSend } from "../p2p/send";
import { PackManifest, PackOffer } from "./types";
import * as FileSystem from "expo-file-system";

export async function broadcastOffer(man: PackManifest){
  const id = "offer_"+Date.now().toString(36).slice(2,8);
  const off: PackOffer = { id, man, ts: Date.now() };
  await p2pLocalSend({ kind:"pack_offer", v:1, off, ts: Date.now() });
}

export async function handleIncoming(msg:any){
  // offers are just cached in-memory via bleCourier (see patch)
}



