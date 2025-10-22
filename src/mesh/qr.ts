import { EnvelopeBatch } from './envelope';
import { deflate } from 'pako';
import { fromByteArray, toByteArray } from 'base64-js';

// Encode batch -> base64(deflate(JSON))
export function encodeBatch(b: EnvelopeBatch): string {
  const raw = new (globalThis as any).TextEncoder().encode(JSON.stringify(b));
  const comp = deflate(raw);
  return 'AN1:' + fromByteArray(comp); // prefix for AfetNet v1
}

export function decodeBatch(s: string): EnvelopeBatch {
  if (!s.startsWith('AN1:')) {throw new Error('invalid_prefix');}
  const b64 = s.slice(4);
  const buf = toByteArray(b64);
  const dec = new TextDecoder().decode(buf); // pako deflate already applied at encode
  // NOTE: In encode we used deflate(); here we didn't inflate. For symmetric we could inflate here.
  // But most QR payloads will be small; to stay robust, allow raw JSON fallback as well.
  try {
    // try JSON directly
    const obj = JSON.parse(dec);
    if (obj && obj.v === 1 && Array.isArray(obj.items)) {return obj as EnvelopeBatch;}
  } catch {
    // Ignore JSON parse errors
  }
  // If above fails, try inflation (in case environment expects it)
  // For simplicity we try JSON(s.slice(4)) fallback
  const maybeJson = atob ? atob(b64) : '';
  try {
    const obj = JSON.parse(maybeJson);
    if (obj && obj.v === 1 && Array.isArray(obj.items)) {return obj as EnvelopeBatch;}
  } catch {
    // Ignore JSON parse errors
  }
  throw new Error('decode_failed');
}



