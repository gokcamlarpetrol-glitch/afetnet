// Safe import for react-native-get-random-values
try {
  require("react-native-get-random-values");
} catch (e) {
  console.warn("react-native-get-random-values not available");
}
import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";

const SK_KEY = "afn:ed25519:sk";
const PK_KEY = "afn:ed25519:pk";

export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

function u8ToB64(u8: Uint8Array){ return Buffer.from(u8).toString("base64"); }
function b64ToU8(b64: string){ return new Uint8Array(Buffer.from(b64, "base64")); }

export async function ensureKeypair(): Promise<KeyPair>{
  const skB64 = await SecureStore.getItemAsync(SK_KEY);
  const pkB64 = await SecureStore.getItemAsync(PK_KEY);
  if(skB64 && pkB64){
    return { secretKey: b64ToU8(skB64), publicKey: b64ToU8(pkB64) };
  }
  const kp = nacl.sign.keyPair();
  await SecureStore.setItemAsync(SK_KEY, u8ToB64(kp.secretKey));
  await SecureStore.setItemAsync(PK_KEY, u8ToB64(kp.publicKey));
  return kp;
}

export async function getPublicKeyB64(){
  const kp = await ensureKeypair();
  return Buffer.from(kp.publicKey).toString("base64");
}

export async function sign(detachedPayloadHashHex: string){
  const kp = await ensureKeypair();
  const bytes = Buffer.from(detachedPayloadHashHex, "hex");
  const sig = nacl.sign.detached(bytes, kp.secretKey);
  return Buffer.from(sig).toString("base64");
}

export function verify(pubKeyB64: string, payloadHashHex: string, sigB64: string){
  try{
    const pk = new Uint8Array(Buffer.from(pubKeyB64, "base64"));
    const ms = new Uint8Array(Buffer.from(sigB64, "base64"));
    const bytes = new Uint8Array(Buffer.from(payloadHashHex, "hex"));
    return nacl.sign.detached.verify(bytes, ms, pk);
  }catch{ return false; }
}
