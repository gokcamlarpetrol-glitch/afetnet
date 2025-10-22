import nacl from 'tweetnacl';
import * as FileSystem from 'expo-file-system';
import { hkdf } from './kdf';

const DIR = '/tmp/';
const S_PATH = DIR + 'e2ee.sessions.json';

export type Session = {
  threadId: string;
  // DH state
  our_sk_b64: string;        // current ratchet private
  our_pk_b64: string;
  their_pk_b64: string;      // last seen ratchet public
  // chain keys
  ck_s_b64: string;          // sending chain key
  ck_r_b64: string;          // receiving chain key
  // counters
  pn: number; rn: number;
  created: number;
};

async function loadAll(): Promise<Session[]>{
  const ex = await FileSystem.getInfoAsync(S_PATH);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(S_PATH)); }catch{ return []; }
}
async function saveAll(list: Session[]){ await FileSystem.writeAsStringAsync(S_PATH, JSON.stringify(list)); }

export async function getSession(threadId:string){ return (await loadAll()).find(s=>s.threadId===threadId) || null; }

export async function createSessionFromBundles(threadId:string, myPre:{sk:Uint8Array; pk:Uint8Array}, peer:{ik_pub:Uint8Array; spk_pub:Uint8Array}){
  // X3DH-lite: shared = DH(myPre.sk, peer.ik_pub) || DH(myPre.sk, peer.spk_pub)
  const dh1 = nacl.scalarMult(myPre.sk, peer.ik_pub);
  const dh2 = nacl.scalarMult(myPre.sk, peer.spk_pub);
  const seed = new Uint8Array([...dh1, ...dh2]);
  const master = await hkdf(seed, seed, 'afn-e2ee-master', 32);
  // set initial ratchet keypair
  const rk = nacl.box.keyPair();
  const ck_s = await hkdf(master, rk.publicKey, 'ck_s', 32);
  const ck_r = await hkdf(master, peer.spk_pub, 'ck_r', 32);
  const s: Session = {
    threadId,
    our_sk_b64: (globalThis as any).Buffer.from(rk.secretKey).toString('base64'),
    our_pk_b64: (globalThis as any).Buffer.from(rk.publicKey).toString('base64'),
    their_pk_b64: (globalThis as any).Buffer.from(peer.spk_pub).toString('base64'),
    ck_s_b64: (globalThis as any).Buffer.from(ck_s).toString('base64'),
    ck_r_b64: (globalThis as any).Buffer.from(ck_r).toString('base64'),
    pn:0, rn:0, created: Date.now(),
  };
  const all = await loadAll(); all.push(s); await saveAll(all);
  return s;
}

function b64(s:string){ return new Uint8Array((globalThis as any).Buffer.from(s,'base64')); }

async function kdfChain(ck: Uint8Array){ return hkdf(ck, ck, 'chain', 32); }

export async function ratchetEncrypt(s: Session, plaintext: Uint8Array){
  // derive message key from sending chain
  const ck_s = b64(s.ck_s_b64); await kdfChain(ck_s);
  const nonce = nacl.randomBytes(24);
  const their = b64(s.their_pk_b64);
  const ourSk = b64(s.our_sk_b64);
  const ct = nacl.box(plaintext, nonce, their, ourSk);
  // advance sending chain
  const nextCk = await kdfChain(ck_s);
  s.ck_s_b64 = (globalThis as any).Buffer.from(nextCk).toString('base64'); s.pn++;
  return { s, nonce: (globalThis as any).Buffer.from(nonce).toString('base64'), ct: (globalThis as any).Buffer.from(ct).toString('base64'), dh_pub_b64: s.our_pk_b64, pn: s.pn };
}

export async function ratchetDecrypt(s: Session, dh_pub_b64: string, nonce_b64: string, ct_b64: string){
  const theirPub = new Uint8Array((globalThis as any).Buffer.from(dh_pub_b64,'base64'));
  // if new DH pub → perform DH ratchet: set their_pk=theirPub, gen new our keypair, reset chain keys based on DH
  if(dh_pub_b64 !== s.their_pk_b64){
    const newOur = nacl.box.keyPair();
    const dh = nacl.scalarMult(newOur.secretKey, theirPub);
    const base = await hkdf(dh, theirPub, 'ratchet', 32);
    s.their_pk_b64 = dh_pub_b64;
    s.our_sk_b64 = (globalThis as any).Buffer.from(newOur.secretKey).toString('base64');
    s.our_pk_b64 = (globalThis as any).Buffer.from(newOur.publicKey).toString('base64');
    s.ck_r_b64 = (globalThis as any).Buffer.from(await hkdf(base, newOur.publicKey, 'ck_r', 32)).toString('base64');
    s.ck_s_b64 = (globalThis as any).Buffer.from(await hkdf(base, theirPub, 'ck_s', 32)).toString('base64');
    s.pn=0; s.rn=0;
  }
  const ck_r = b64(s.ck_r_b64);
  await kdfChain(ck_r); // symmetric step
  const nonce = new Uint8Array((globalThis as any).Buffer.from(nonce_b64,'base64'));
  const ct = new Uint8Array((globalThis as any).Buffer.from(ct_b64,'base64'));
  const plain = nacl.box.open(ct, nonce, new Uint8Array((globalThis as any).Buffer.from(s.their_pk_b64,'base64')), b64(s.our_sk_b64));
  if(!plain) {return { ok:false as const, s };}
  const nextCk = await kdfChain(ck_r); s.ck_r_b64 = (globalThis as any).Buffer.from(nextCk).toString('base64'); s.rn++;
  return { ok:true as const, s, plaintext: plain };
}

export async function updateSession(s: Session){
  const all = await loadAll();
  const i = all.findIndex(x=>x.threadId===s.threadId);
  if(i>=0) {all[i]=s;} else {all.push(s);}
  await saveAll(all);
}
