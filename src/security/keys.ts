import * as SecureStore from 'expo-secure-store';
import * as nacl from 'tweetnacl';

const OWN_KEY = 'afn:own_keypair';
const PEERS = 'afn:peers'; // id -> publicKey(base64)

export async function getOwn(){
  const raw = await SecureStore.getItemAsync(OWN_KEY);
  if (raw) {return JSON.parse(raw);}
  const kp = nacl.box.keyPair();
  const obj = { publicKey: (globalThis as any).Buffer.from(kp.publicKey).toString('base64'), secretKey: (globalThis as any).Buffer.from(kp.secretKey).toString('base64') };
  await SecureStore.setItemAsync(OWN_KEY, JSON.stringify(obj));
  return obj;
}

export async function addPeer(id: string, pubB64: string){
  const raw = await SecureStore.getItemAsync(PEERS);
  const m = raw ? JSON.parse(raw) : {};
  m[id] = pubB64;
  await SecureStore.setItemAsync(PEERS, JSON.stringify(m));
}
export async function listPeers(): Promise<Record<string,string>>{
  const raw = await SecureStore.getItemAsync(PEERS);
  return raw ? JSON.parse(raw) : {};
}

export async function sealFor(peerPubB64: string, msg: Uint8Array){
  const own = await getOwn();
  const pub = (globalThis as any).Buffer.from(peerPubB64,'base64');
  const sk = (globalThis as any).Buffer.from(own.secretKey,'base64');
  const nonce = nacl.randomBytes(24);
  const boxed = nacl.box(msg, nonce, pub, sk);
  return (globalThis as any).Buffer.concat([(globalThis as any).Buffer.from(nonce), (globalThis as any).Buffer.from(boxed)]);
}

export async function openFrom(senderPubB64: string, blob: Uint8Array){
  const own = await getOwn();
  const pub = (globalThis as any).Buffer.from(senderPubB64,'base64');
  const sk = (globalThis as any).Buffer.from(own.secretKey,'base64');
  const nonce = blob.subarray(0,24);
  const cip = blob.subarray(24);
  const plain = nacl.box.open(cip, nonce, pub, sk);
  return plain ? (globalThis as any).Buffer.from(plain) : null;
}



