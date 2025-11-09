// Tries to use WebCrypto AES-GCM if available; otherwise returns null (fallback XOR already exists)
export async function aesGcmEncrypt(keyRaw:string, plain:string): Promise<string|null>{
  try{
    // derive key 256-bit from keyRaw via subtle.importKey raw
    // @ts-ignore
    const cryptoRef = globalThis.crypto;
    const subtle = cryptoRef?.subtle;
    if(!subtle || !cryptoRef?.getRandomValues) {return null;}
    const enc = new (globalThis as any).TextEncoder();
    const keyData = enc.encode(keyRaw).slice(0,32);
    const key = await subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt']);
    const iv = new Uint8Array(12);
    cryptoRef.getRandomValues(iv);
    const ct = await subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(plain));
    const ivB64 = (globalThis as any).Buffer.from(iv).toString('base64');
    const ctB64 = (globalThis as any).Buffer.from(new Uint8Array(ct)).toString('base64');
    return `${ivB64}:${ctB64}`;
  }catch{ return null; }
}
export async function aesGcmDecrypt(keyRaw:string, b64:string): Promise<string|null>{
  try{
    // @ts-ignore
    const cryptoRef = globalThis.crypto;
    const subtle = cryptoRef?.subtle; if(!subtle) {return null;}
    const enc = new (globalThis as any).TextEncoder();
    const key = await subtle.importKey('raw', enc.encode(keyRaw).slice(0,32), 'AES-GCM', false, ['decrypt']);
    let iv: Uint8Array;
    let ciphertext: Uint8Array;

    if (b64.includes(':')) {
      const [ivPart, ctPart] = b64.split(':', 2);
      if (!ivPart || !ctPart) { return null; }
      iv = Uint8Array.from((globalThis as any).Buffer.from(ivPart, 'base64'));
      ciphertext = Uint8Array.from((globalThis as any).Buffer.from(ctPart, 'base64'));
    } else {
      // Legacy payloads without embedded IV
      iv = enc.encode(keyRaw).slice(0,12);
      ciphertext = Uint8Array.from((globalThis as any).Buffer.from(b64,'base64'));
    }

    if (iv.length !== 12) { return null; }

    // @ts-ignore - Uint8Array is compatible with BufferSource
    const pt = await subtle.decrypt({ name:'AES-GCM', iv }, key, ciphertext);
    return new (globalThis as any).TextDecoder().decode(pt);
  }catch{ return null; }
}



