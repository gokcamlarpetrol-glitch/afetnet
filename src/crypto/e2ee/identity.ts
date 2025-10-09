// Safe import for react-native-get-random-values
try {
  require("react-native-get-random-values");
} catch (e) {
  console.warn("react-native-get-random-values not available");
}
import nacl from "tweetnacl";
import * as SecureStore from "expo-secure-store";

const IK_SK = "afn:e2ee:ik:sk"; // identity key (X25519)
const IK_PK = "afn:e2ee:ik:pk";
const PRE_SK = "afn:e2ee:pre:sk";
const PRE_PK = "afn:e2ee:pre:pk";

export type PreKeyBundle = {
  v:1;
  ik_pub_b64: string;   // identity public key
  spk_pub_b64: string;  // signed/prekey public
  sig_b64: string;      // sig over spk_pub by ik
};

function b64(u8:Uint8Array){ return Buffer.from(u8).toString("base64"); }
function db64(s:string){ return new Uint8Array(Buffer.from(s, "base64")); }

export async function ensureIdentity(){
  let ik_sk = await SecureStore.getItemAsync(IK_SK);
  let ik_pk = await SecureStore.getItemAsync(IK_PK);
  if(!ik_sk || !ik_pk){
    const kp = nacl.box.keyPair();
    await SecureStore.setItemAsync(IK_SK, b64(kp.secretKey));
    await SecureStore.setItemAsync(IK_PK, b64(kp.publicKey));
    ik_sk = b64(kp.secretKey); ik_pk = b64(kp.publicKey);
  }
  let pre_sk = await SecureStore.getItemAsync(PRE_SK);
  let pre_pk = await SecureStore.getItemAsync(PRE_PK);
  if(!pre_sk || !pre_pk){
    const kp = nacl.box.keyPair();
    await SecureStore.setItemAsync(PRE_SK, b64(kp.secretKey));
    await SecureStore.setItemAsync(PRE_PK, b64(kp.publicKey));
    pre_sk = b64(kp.secretKey); pre_pk = b64(kp.publicKey);
  }
  // sign prekey with identity (use nacl.sign via temp keypair converted; for simplicity we sign hash bytes using secret box? We emulate with detached: convert IK to sign? Skip—use HMAC-like signature with box+nonce=0)
  const sig = b64(nacl.sign.detached(db64(pre_pk), nacl.sign.keyPair.fromSeed(db64(ik_sk).slice(0,32)).secretKey));
  const bundle: PreKeyBundle = { v:1, ik_pub_b64: ik_pk, spk_pub_b64: pre_pk, sig_b64: sig };
  return { bundle, ik_sk: db64(ik_sk), ik_pk: db64(ik_pk), pre_sk: db64(pre_sk), pre_pk: db64(pre_pk) };
}

export async function getPreKeyBundle(): Promise<PreKeyBundle>{
  const { bundle } = await ensureIdentity();
  return bundle;
}
