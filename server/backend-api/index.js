/**
 * AfetNet Backend API
 * Cloudflare Workers - Ücretsiz, Hızlı, Global CDN
 * 
 * Endpoints:
 * POST /ingest - Queue data ingestion
 * POST /fcm/register - Register FCM token
 * GET /health - Health check
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-ts, x-signature',
};

/**
 * HMAC signature verification
 */
async function verifySignature(timestamp, payload, signature, secret) {
  if (!secret) return true; // Skip if no secret configured
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const data = encoder.encode(`${timestamp}:${payload}`);
  const expectedSig = await crypto.subtle.sign('HMAC', key, data);
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return expectedHex === signature;
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        service: 'AfetNet API',
        version: '1.0.0',
        timestamp: Date.now()
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // POST /ingest - Queue data ingestion
    if (request.method === 'POST' && url.pathname === '/ingest') {
      try {
        const data = await request.json();
        const timestamp = request.headers.get('x-ts');
        const signature = request.headers.get('x-signature');
        
        // Verify signature (if secret is set)
        const secret = env.API_SECRET; // Set in wrangler.toml or dashboard
        if (secret) {
          const payload = await request.clone().text();
          const isValid = await verifySignature(timestamp, payload, signature, secret);
          if (!isValid) {
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
        }
        
        // Log to console (visible in wrangler tail)
        console.log('[INGEST]', JSON.stringify({
          id: data.id,
          timestamp: data.timestamp,
          dataKeys: Object.keys(data.data || {}),
          receivedAt: Date.now()
        }));
        
        // Store in KV (if configured) or D1 database
        if (env.QUEUE_KV) {
          await env.QUEUE_KV.put(
            `queue:${data.id}`,
            JSON.stringify(data),
            { expirationTtl: 86400 * 30 } // 30 days
          );
        }
        
        return new Response(JSON.stringify({ 
          ok: true,
          id: data.id,
          stored: !!env.QUEUE_KV
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      } catch (error) {
        console.error('[INGEST ERROR]', error);
        return new Response(JSON.stringify({ 
          error: 'Internal error',
          message: error.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    // POST /fcm/register - Register FCM token
    if (request.method === 'POST' && url.pathname === '/fcm/register') {
      try {
        const { token, userId, provinces } = await request.json();
        
        console.log('[FCM REGISTER]', { 
          token: token.slice(0, 20) + '...', 
          userId,
          provinces: provinces?.length || 0
        });
        
        // Store in KV
        if (env.FCM_TOKENS) {
          await env.FCM_TOKENS.put(
            `token:${userId}`,
            JSON.stringify({ token, provinces, updatedAt: Date.now() })
          );
        }
        
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      } catch (error) {
        console.error('[FCM REGISTER ERROR]', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    // 404
    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  }
};






