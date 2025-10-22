import * as Crypto from 'expo-crypto';

export async function hkdf(input: Uint8Array, salt: Uint8Array, info: string, len=32){
  // HKDF-SHA256 simple expand (derive len bytes)
  const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, (globalThis as any).Buffer.from(salt).toString('hex')+(globalThis as any).Buffer.from(input).toString('hex')+info);
  // Produce len bytes by iterative hashing (very small, ok offline)
  const out = new Uint8Array(len);
  let material = (globalThis as any).Buffer.from(key, 'hex');
  if(material.length < len){
    const ext = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, material.toString('hex')+info);
    material = (globalThis as any).Buffer.concat([material, (globalThis as any).Buffer.from(ext, 'hex')]);
  }
  out.set(material.subarray(0,len));
  return out;
}



