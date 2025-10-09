import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { PackManifest } from "./types";

export async function makeManifest(path:string, kind: "tilepack"|"mbtiles"|"datapack", chunkSize=128*1024): Promise<PackManifest>{
  const info = await FileSystem.getInfoAsync(path); if(!info.exists) {throw new Error("file missing");}
  const size = info.size || 0;
  const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, (await FileSystem.readAsStringAsync(path)).slice(0, 2_000_000)); // NOTE: simplified hash (partial)
  return { name: path.split("/").pop()||"pack", kind, size, sha256, chunkSize, chunks: Math.ceil(size/chunkSize) };
}
