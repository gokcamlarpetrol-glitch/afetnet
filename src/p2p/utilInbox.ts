import * as FileSystem from "expo-file-system";
import { list } from "../queue/v2";
import { CourierBundle } from "./types";
import * as Crypto from "expo-crypto";

const DIR = "/tmp/";

async function shortId(){
  const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, Date.now().toString());
  return h.slice(0,8);
}

export async function buildInboxBundle(): Promise<CourierBundle>{
  const items = (await list(10,false)).map(r=>({ v:1 as const, id:r.id, ts:r.ts, kind:r.kind as any, payload:r.payload, hash:r.hash }));
  return { v:1, from: await shortId(), items };
}
