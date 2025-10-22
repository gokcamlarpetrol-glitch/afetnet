import { aesGcmEncrypt, aesGcmDecrypt } from '../crypto/optional';
export async function famEncrypt(secret:string, msg:string){
  const a = await aesGcmEncrypt(secret, msg); if(a) {return 'aes:'+a;}
  // fallback XOR (weak) — only if user opted-in older phases; keep for continuity
  return 'xor:'+xor(secret,msg);
}
export async function famDecrypt(secret:string, payload:string){
  if(payload.startsWith('aes:')){ const a = await aesGcmDecrypt(secret, payload.slice(4)); if(a!=null) {return a;} }
  if(payload.startsWith('xor:')) {return xor(secret, payload.slice(4));}
  return payload;
}
function xor(k:string, s:string){ 
  const kb=new (globalThis as any).TextEncoder().encode(k), 
    sb=new (globalThis as any).TextEncoder().encode(s); 
  const out=new Uint8Array(sb.length); 
  for(let i=0;i<sb.length;i++){ 
    out[i]=sb[i] ^ kb[i%kb.length]; 
  } 
  return new (globalThis as any).TextDecoder().decode(out); 
}