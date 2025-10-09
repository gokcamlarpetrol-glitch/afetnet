import * as nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-util';

export function genKeyPair() {
  return nacl.box.keyPair(); // publicKey/secretKey Uint8Array
}

export function boxEncrypt(message: string, theirPublicKeyBase64: string, mySecretKey: Uint8Array) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const msg = decodeUTF8(message);
  const theirPublic = decodeBase64(theirPublicKeyBase64);
  const cipher = nacl.box(msg, nonce, theirPublic, mySecretKey);
  return { cipher: encodeBase64(cipher), nonce: encodeBase64(nonce) };
}

export function boxDecrypt(cipherBase64: string, nonceBase64: string, theirPublicKeyBase64: string, mySecretKey: Uint8Array) {
  const cipher = decodeBase64(cipherBase64);
  const nonce = decodeBase64(nonceBase64);
  const theirPublic = decodeBase64(theirPublicKeyBase64);
  const decrypted = nacl.box.open(cipher, nonce, theirPublic, mySecretKey);
  if (!decrypted) return null;
  return decodeUTF8(decrypted);
}

// Generate shared secret for group encryption
export function generateSharedSecret(mySecretKey: Uint8Array, theirPublicKeyBase64: string): Uint8Array {
  const theirPublic = decodeBase64(theirPublicKeyBase64);
  return nacl.box.before(theirPublic, mySecretKey);
}

// Sign message with private key
export function signMessage(message: string, secretKey: Uint8Array): string {
  const msg = decodeUTF8(message);
  const signature = nacl.sign.detached(msg, secretKey);
  return encodeBase64(signature);
}

// Verify message signature
export function verifySignature(message: string, signatureBase64: string, publicKeyBase64: string): boolean {
  try {
    const msg = decodeUTF8(message);
    const signature = decodeBase64(signatureBase64);
    const publicKey = decodeBase64(publicKeyBase64);
    return nacl.sign.detached.verify(msg, signature, publicKey);
  } catch (error) {
    return false;
  }
}