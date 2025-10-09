import * as Crypto from "expo-crypto";

export async function hkdf(input: Uint8Array, salt: Uint8Array, info: string, len=32){
  // HKDF-SHA256 simple expand (derive len bytes)
  const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, Buffer.from(salt).toString("hex")+Buffer.from(input).toString("hex")+info);
  // Produce len bytes by iterative hashing (very small, ok offline)
  const out = new Uint8Array(len);
  let material = Buffer.from(key, "hex");
  if(material.length < len){
    const ext = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, material.toString("hex")+info);
    material = Buffer.concat([material, Buffer.from(ext, "hex")]);
  }
  out.set(material.subarray(0,len));
  return out;
}



