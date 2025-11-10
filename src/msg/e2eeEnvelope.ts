import { ratchetEncrypt, ratchetDecrypt, getSession, updateSession } from '../crypto/e2ee/session';

export type EncEnvelope = {
  v:1; threadId: string;
  hdr: { dh_pub_b64: string; pn: number };
  nonce_b64: string;
  ct_b64: string;
};

export async function wrapEncrypt(threadId:string, text:string){
  const s = await getSession(threadId);
  if(!s) {throw new Error('E2EE session not found');}
  const enc = new (globalThis as any).TextEncoder().encode(text);
  const { s:ns, nonce, ct, dh_pub_b64, pn } = await ratchetEncrypt(s, enc);
  await updateSession(ns);
  const env: EncEnvelope = { v:1, threadId, hdr:{ dh_pub_b64, pn }, nonce_b64: nonce, ct_b64: ct };
  return env;
}

export async function openDecrypt(env: EncEnvelope){
  const s = await getSession(env.threadId);
  if(!s) {return { ok:false as const, text:'' };}
  const r = await ratchetDecrypt(s, env.hdr.dh_pub_b64, env.nonce_b64, env.ct_b64);
  if(!r.ok) {return { ok:false as const, text:'' };}
  await updateSession(r.s);
  return { ok:true as const, text: new TextDecoder().decode(r.plaintext) };
}



