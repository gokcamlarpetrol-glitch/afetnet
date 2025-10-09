import * as Crypto from "expo-crypto";
export function makeRV(): string{
  // short human-friendly 6-char code from time+rand
  const seed = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  return (seed.replace(/[^a-z0-9]/gi,"").toUpperCase()).slice(0,6);
}
export async function threadFromRV(rv:string){
  const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rv);
  return h.slice(0,16); // threadId
}



