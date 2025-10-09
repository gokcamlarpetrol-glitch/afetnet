import { CourierBundle } from "./types";
import * as FileSystem from "expo-file-system";
import { buildInboxBundle } from "./utilInbox";

const DIR = "/tmp/";

let writeBuf = "";
export function onInboxChunk(b64: string){
  try{
    const part = atob(b64);
    if(part.includes('"end":true')){ flushInbox(); }
    else { writeBuf += b64; }
  }catch{ /* ignore */ }
}
async function flushInbox(){
  try{
    const json = atob(writeBuf);
    await FileSystem.writeAsStringAsync(DIR+"p2p.inbox.json", json);
  }catch{}
  writeBuf = "";
}

export async function readOutboxB64(): Promise<string>{
  const bundle: CourierBundle = await buildInboxBundle();
  return btoa(JSON.stringify(bundle));
}



