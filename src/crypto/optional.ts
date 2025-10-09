// Tries to use WebCrypto AES-GCM if available; otherwise returns null (fallback XOR already exists)
export async function aesGcmEncrypt(keyRaw:string, plain:string): Promise<string|null>{
  try{
    // derive key 256-bit from keyRaw via subtle.importKey raw
    // @ts-ignore
    const subtle = globalThis.crypto?.subtle; if(!subtle) {return null;}
    const enc = new TextEncoder();
    const key = await subtle.importKey("raw", enc.encode(keyRaw).slice(0,32), "AES-GCM", false, ["encrypt"]);
    const iv = enc.encode(keyRaw).slice(0,12);
    const ct = await subtle.encrypt({ name:"AES-GCM", iv }, key, enc.encode(plain));
    return Buffer.from(new Uint8Array(ct)).toString("base64");
  }catch{ return null; }
}
export async function aesGcmDecrypt(keyRaw:string, b64:string): Promise<string|null>{
  try{
    // @ts-ignore
    const subtle = globalThis.crypto?.subtle; if(!subtle) {return null;}
    const enc = new TextEncoder();
    const key = await subtle.importKey("raw", enc.encode(keyRaw).slice(0,32), "AES-GCM", false, ["decrypt"]);
    const iv = enc.encode(keyRaw).slice(0,12);
    const buf = Uint8Array.from(Buffer.from(b64,"base64"));
    const pt = await subtle.decrypt({ name:"AES-GCM", iv }, key, buf);
    return new TextDecoder().decode(pt);
  }catch{ return null; }
}



