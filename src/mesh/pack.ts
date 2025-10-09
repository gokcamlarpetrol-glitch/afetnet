import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { MeshBatch, MeshEnvelope } from "../entities/help/types";

export type AfetPack = {
  kind: "afet-pack";
  v: 1;
  createdAt: number;
  count: number;
  items: MeshEnvelope[];
  packHash: string; // sha256 of JSON({v,createdAt,items})
};

async function sha256(s: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);
}

export async function createPack(envelopes: MeshEnvelope[]): Promise<{path:string, pack:AfetPack}> {
  const meta = { v:1, createdAt: Date.now(), items: envelopes };
  const body = JSON.stringify(meta);
  const packHash = await sha256(body);
  const pack: AfetPack = { kind:"afet-pack", v:1, createdAt: meta.createdAt, count: envelopes.length, items: envelopes, packHash };
  const filename = `afn_${pack.createdAt}_${envelopes.length}.afet`;
  const path = `/tmp/${filename}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(pack));
  return { path, pack };
}

export async function sharePack(path: string) {
  const can = await Sharing.isAvailableAsync();
  if (!can) {throw new Error("sharing_unavailable");}
  await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "AfetNet Paketi" });
}

export async function pickAndReadPack(): Promise<AfetPack> {
  const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) {throw new Error("cancelled");}
  const asset = res.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri);
  const pack = JSON.parse(content) as AfetPack;
  if (pack?.kind !== "afet-pack" || pack?.v !== 1) {throw new Error("invalid_pack");}
  const body = JSON.stringify({ v: pack.v, createdAt: pack.createdAt, items: pack.items });
  const check = await sha256(body);
  if (check !== pack.packHash) {throw new Error("integrity_error");}
  return pack;
}
