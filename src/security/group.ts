import CryptoJS from "crypto-js";
import nacl from "tweetnacl";

let _key: Uint8Array | null = null;

export async function setGroupPin(pin: string){
  const salt = "afn.group.salt";
  const key = CryptoJS.PBKDF2(pin || "0000", salt, { keySize: 256/32, iterations: 20000 });
  const bytes = Uint8Array.from(Buffer.from(key.toString(CryptoJS.enc.Hex), "hex"));
  _key = bytes;
}

export function encryptText(plain: Uint8Array){
  if(!_key) {return plain;}
  const nonce = nacl.randomBytes(24);
  const boxed = nacl.secretbox(plain, nonce, _key);
  return Buffer.concat([Buffer.from([1]), Buffer.from(nonce), Buffer.from(boxed)]); // v1 | nonce | body
}

export function decryptText(blob: Uint8Array){
  try{
    if (blob[0] !== 1) {return null;}
    const nonce = blob.subarray(1,25);
    const body = blob.subarray(25);
    if(!_key) {return null;}
    const plain = nacl.secretbox.open(body, nonce, _key);
    return plain ? Buffer.from(plain) : null;
  }catch{ return null; }
}



