import * as Crypto from "expo-crypto";
import { HelpPayload } from "../entities/help/types";

export type Envelope = {
  t: "help";
  hash: string;         // sha256 of canonical payload
  createdAt: number;    // epoch ms
  payload: HelpPayload; // includes the same fields; hash duplicated for convenience
};

// stable stringify (sorted keys) to ensure deterministic hash
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {return JSON.stringify(obj);}
  if (Array.isArray(obj)) {return "[" + obj.map(stableStringify).join(",") + "]";}
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export async function makeEnvelope(p: HelpPayload): Promise<Envelope> {
  const base: HelpPayload = {
    type: "help",
    note: p.note ?? "",
    people: p.people ?? 1,
    priority: p.priority ?? "med",
    lat: p.lat ?? null,
    lon: p.lon ?? null,
  };
  const canon = stableStringify(base);
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canon);
  return {
    t: "help",
    hash,
    createdAt: Date.now(),
    payload: { ...base, hash }
  };
}

export type EnvelopeBatch = {
  v: 1;              // version
  c: number;         // count
  items: Envelope[]; // payloads
};



