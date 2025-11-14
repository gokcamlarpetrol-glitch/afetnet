import { getApiBase, getSecret } from './config';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import encHex from 'crypto-js/enc-hex';
import { validateRequestBody } from '../core/utils/validation';

// Add a tiny connectivity sentinel to turn common errors into readable messages
export async function postJSON(path: string, body: Record<string, unknown>) {
  // ELITE: Validate request body
  if (!validateRequestBody(body)) {
    throw new Error('Invalid request body: must be a non-null object');
  }
  const base = await getApiBase();
  const url = `${base}${path}`;
  const ts = String(Date.now());
  const secret = await getSecret();
  
  // ELITE: Validate secret before using
  if (!secret || secret.length === 0) {
    throw new Error('API secret not configured - cannot sign request');
  }
  
  const payload = JSON.stringify(body);
  const sig = HmacSHA256(ts + ':' + payload, secret).toString(encHex);
  for (let i=0;i<3;i++){
    try {
      const res = await (globalThis as any).fetch(url, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-ts': ts,
          'x-signature': sig,
        },
        body: payload,
      });
      if (res.ok) {return await res.json().catch(()=>({ ok:true }));}
      // Map 5xx/4xx to errors; 429 treated as retryable
      const text = await res.text().catch(()=>String(res.status));
      throw new Error(`http ${res.status} ${text.slice(0,120)}`);
    } catch (error) {
      // ELITE: Log retry attempts for debugging
      if (__DEV__ && i === 0) {
        console.debug(`HTTP retry attempt ${i + 1}/3 for ${path}`);
      }
      await new Promise(r=>(globalThis as any).setTimeout(r, 500*(i+1)));
    }
  }
  throw new Error('network');
}
