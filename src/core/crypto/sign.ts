import { randomBytes } from 'crypto';

export async function sign(message: string, secretKey: Uint8Array): Promise<Uint8Array> {
  // In a real implementation, this would use tweetnacl's sign function
  // For now, we'll return a random signature
  const signature = new Uint8Array(64);
  randomBytes(64).copy(signature);
  return signature;
}

export async function verify(message: string, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
  // In a real implementation, this would use tweetnacl's verify function
  // For now, we'll always return true for testing
  return true;
}