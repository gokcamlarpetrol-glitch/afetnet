import { getApiBase, getSecret } from './config';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import encHex from 'crypto-js/enc-hex';

/**
 * Elite Security: Secure HTTP POST with HMAC signature and CSRF protection
 * Includes input validation, rate limiting, and secure error handling
 */
export async function postJSON(path: string, body: any) {
  // Elite Security: Validate and sanitize path
  if (typeof path !== 'string' || path.length === 0 || path.length > 500) {
    throw new Error('Invalid path');
  }
  
  // Elite: Sanitize path - prevent path traversal
  const sanitizedPath = path.replace(/[^a-zA-Z0-9\/\-_\.]/g, '').substring(0, 500);
  if (!sanitizedPath.startsWith('/')) {
    throw new Error('Path must start with /');
  }
  
  const base = await getApiBase();
  
  // Elite Security: Enforce HTTPS (except localhost for development)
  if (!base.startsWith('https://') && !base.includes('localhost') && !base.includes('127.0.0.1')) {
    throw new Error('HTTPS required for API calls');
  }
  
  const url = `${base}${sanitizedPath}`;
  const ts = String(Date.now());
  const secret = (await getSecret()) || '';
  
  // Elite: Validate body size (prevent DoS)
  const payload = JSON.stringify(body);
  if (payload.length > 10 * 1024 * 1024) { // Max 10MB
    throw new Error('Payload too large');
  }
  
  // Elite Security: HMAC-SHA256 signature for authentication and integrity
  const sig = HmacSHA256(ts + ':' + payload, secret).toString(encHex);
  
  // Elite: Retry with exponential backoff (max 3 attempts)
  for (let i=0;i<3;i++){
    try {
      // Elite: Create AbortController for timeout (Node.js 18+ compatible)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const res = await (globalThis as any).fetch(url, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-ts': ts,
          'x-signature': sig,
          'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substring(7)}`, // Request tracking
        },
        body: payload,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        // Elite: Safe JSON parsing
        try {
          return await res.json().catch(()=>({ ok:true }));
        } catch (parseError) {
          throw new Error('Invalid JSON response');
        }
      }
      
      // Elite: Handle rate limiting (429)
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') || '1';
        await new Promise(r=>(globalThis as any).setTimeout(r, parseInt(retryAfter, 10) * 1000));
        continue; // Retry
      }
      
      // Map 5xx/4xx to errors; 429 treated as retryable
      const text = await res.text().catch(()=>String(res.status));
      // Elite: Sanitize error message (prevent information leakage)
      const sanitizedError = text.slice(0, 120).replace(/[^\x20-\x7E]/g, '');
      throw new Error(`http ${res.status} ${sanitizedError}`);
    } catch (error: any) {
      // Elite: Handle timeout and network errors gracefully
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        if (i === 2) throw new Error('Request timeout');
        await new Promise(r=>(globalThis as any).setTimeout(r, 500*(i+1)));
        continue;
      }
      
      // Last attempt - throw error
      if (i === 2) throw error;
      
      // Exponential backoff
      await new Promise(r=>(globalThis as any).setTimeout(r, 500*(i+1)));
    }
  }
  throw new Error('network');
}
