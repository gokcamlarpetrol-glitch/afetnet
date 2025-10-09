// AfetNet FCM Worker - Background earthquake push notifications
import { PROVINCES, getProvinceCodeFromPlace } from './provinces-tr';

interface QuakeEvent {
  id: string;
  time: number;
  mag: number;
  place: string;
  lat?: number;
  lon?: number;
  source: string;
}

interface RegisterRequest {
  token: string;
  provinces: string[];
}

interface TokenData {
  tokens: string[];
  updatedAt: number;
}

interface ProvinceData {
  provinces: string[];
  updatedAt: number;
}

interface Environment {
  KV: KVNamespace;
  FCM_SERVER_KEY: string;
  ORG_SECRET: string;
  PROVIDER?: string;
  POLL_MS?: string;
  MAG_MIN?: string;
}

// Debounce tracking
const debounceMap = new Map<string, number>();
const DEBOUNCE_MS = 120000; // 2 minutes

export default {
  async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-org-secret',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/health':
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case '/register':
          return await handleRegister(request, env, corsHeaders);

        case '/unregister':
          return await handleUnregister(request, env, corsHeaders);

        case '/tick':
          return await handleTick(env, corsHeaders);

        default:
          return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
  },

  // Cron trigger for automatic polling
  async scheduled(event: ScheduledEvent, env: Environment, ctx: ExecutionContext): Promise<void> {
    try {
      await pollAndNotify(env);
    } catch (error) {
      console.error('Scheduled task error:', error);
    }
  }
};

async function handleRegister(request: Request, env: Environment, corsHeaders: Record<string, string>): Promise<Response> {
  // Check authentication
  const orgSecret = request.headers.get('x-org-secret');
  if (orgSecret !== env.ORG_SECRET) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const body: RegisterRequest = await request.json();
  const { token, provinces } = body;

  if (!token || !Array.isArray(provinces)) {
    return new Response('Invalid request', { status: 400, headers: corsHeaders });
  }

  try {
    // Store token -> provinces mapping
    const tokenKey = `token:${token}`;
    const tokenData: ProvinceData = {
      provinces,
      updatedAt: Date.now()
    };
    await env.KV.put(tokenKey, JSON.stringify(tokenData));

    // Store province -> tokens mapping
    for (const provinceCode of provinces) {
      const provinceKey = `province:${provinceCode}`;
      const existing = await env.KV.get(provinceKey);
      
      let tokenData: TokenData;
      if (existing) {
        tokenData = JSON.parse(existing);
        if (!tokenData.tokens.includes(token)) {
          tokenData.tokens.push(token);
        }
      } else {
        tokenData = {
          tokens: [token],
          updatedAt: Date.now()
        };
      }
      
      await env.KV.put(provinceKey, JSON.stringify(tokenData));
    }

    console.log(`Registered token ${token.substring(0, 6)}... for ${provinces.length} provinces`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return new Response('Registration failed', { status: 500, headers: corsHeaders });
  }
}

async function handleUnregister(request: Request, env: Environment, corsHeaders: Record<string, string>): Promise<Response> {
  // Check authentication
  const orgSecret = request.headers.get('x-org-secret');
  if (orgSecret !== env.ORG_SECRET) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const body = await request.json();
  const { token } = body;

  if (!token) {
    return new Response('Invalid request', { status: 400, headers: corsHeaders });
  }

  try {
    // Get token's provinces
    const tokenKey = `token:${token}`;
    const tokenData = await env.KV.get(tokenKey);
    
    if (tokenData) {
      const data: ProvinceData = JSON.parse(tokenData);
      
      // Remove token from each province
      for (const provinceCode of data.provinces) {
        const provinceKey = `province:${provinceCode}`;
        const provinceData = await env.KV.get(provinceKey);
        
        if (provinceData) {
          const tokens: TokenData = JSON.parse(provinceData);
          tokens.tokens = tokens.tokens.filter(t => t !== token);
          
          if (tokens.tokens.length === 0) {
            await env.KV.delete(provinceKey);
          } else {
            await env.KV.put(provinceKey, JSON.stringify(tokens));
          }
        }
      }
      
      // Remove token mapping
      await env.KV.delete(tokenKey);
    }

    console.log(`Unregistered token ${token.substring(0, 6)}...`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unregistration error:', error);
    return new Response('Unregistration failed', { status: 500, headers: corsHeaders });
  }
}

async function handleTick(env: Environment, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const result = await pollAndNotify(env);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Tick error:', error);
    return new Response('Tick failed', { status: 500, headers: corsHeaders });
  }
}

async function pollAndNotify(env: Environment): Promise<{ processed: number; notified: number }> {
  const provider = env.PROVIDER || 'AFAD';
  const magMin = parseFloat(env.MAG_MIN || '3.5');
  
  let processed = 0;
  let notified = 0;

  try {
    // Fetch quakes from provider
    const quakes = provider === 'AFAD' ? await fetchAfad() : await fetchKandilli();
    processed = quakes.length;

    // Get last sent quake
    const lastSent = await env.KV.get('last:quake');
    const lastSentData = lastSent ? JSON.parse(lastSent) : { id: '', time: 0 };

    // Filter new significant quakes
    const newQuakes = quakes.filter(quake => {
      if (quake.mag < magMin) return false;
      if (quake.id === lastSentData.id) return false;
      if (quake.time <= lastSentData.time) return false;
      
      // Check debounce
      const debounceKey = `${quake.id}:${Math.floor(quake.time / DEBOUNCE_MS)}`;
      if (debounceMap.has(debounceKey)) return false;
      
      debounceMap.set(debounceKey, Date.now());
      return true;
    });

    // Send notifications for new quakes
    for (const quake of newQuakes) {
      const provinceCodes = getProvinceCodeFromPlace(quake.place);
      
      for (const provinceCode of provinceCodes) {
        const tokens = await getTokensForProvince(env, provinceCode);
        if (tokens.length > 0) {
          await sendFCMNotification(env, tokens, quake);
          notified += tokens.length;
        }
      }
    }

    // Update last sent quake
    if (newQuakes.length > 0) {
      const latest = newQuakes[0];
      await env.KV.put('last:quake', JSON.stringify({
        id: latest.id,
        time: latest.time,
        processed: Date.now()
      }));
    }

    // Clean old debounce entries
    const now = Date.now();
    for (const [key, time] of debounceMap.entries()) {
      if (now - time > DEBOUNCE_MS * 2) {
        debounceMap.delete(key);
      }
    }

    console.log(`Processed ${processed} quakes, notified ${notified} tokens`);
    return { processed, notified };

  } catch (error) {
    console.error('Poll and notify error:', error);
    throw error;
  }
}

async function fetchAfad(): Promise<QuakeEvent[]> {
  try {
    const response = await fetch('https://deprem.afad.gov.tr/EventService/GetEventsByFilter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        EventSearchFilterList: [
          {
            FilterType: 9,
            FilterValue: 1 // Last 1 day
          }
        ],
        Skip: 0,
        Take: 50,
        SortDescriptor: {
          field: 'EventDate',
          dir: 'desc'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`AFAD API error: ${response.status}`);
    }

    const data = await response.json();
    const quakes: QuakeEvent[] = [];

    if (data.eventList) {
      for (const event of data.eventList) {
        try {
          const quake: QuakeEvent = {
            id: event.eventId || `${event.eventDate}_${event.latitude}_${event.longitude}`,
            time: new Date(event.eventDate).getTime(),
            mag: parseFloat(event.magnitude || event.ml || '0'),
            place: `${event.location || ''}, ${event.district || ''}, ${event.city || ''}`.trim(),
            lat: parseFloat(event.latitude || '0'),
            lon: parseFloat(event.longitude || '0'),
            source: 'AFAD'
          };

          if (quake.mag > 0) {
            quakes.push(quake);
          }
        } catch (parseError) {
          console.warn('Failed to parse AFAD event:', parseError);
        }
      }
    }

    return quakes.sort((a, b) => b.time - a.time);

  } catch (error) {
    console.error('AFAD fetch error:', error);
    return [];
  }
}

async function fetchKandilli(): Promise<QuakeEvent[]> {
  try {
    const response = await fetch('https://www.koeri.boun.edu.tr/scripts/lst0.asp', {
      headers: {
        'Accept': 'text/plain, application/json, */*',
        'User-Agent': 'AfetNet-Worker/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Kandilli API error: ${response.status}`);
    }

    const text = await response.text();
    return parseQuakes(text, 'Kandilli');

  } catch (error) {
    console.error('Kandilli fetch error:', error);
    return [];
  }
}

function parseQuakes(text: string, source: string): QuakeEvent[] {
  const quakes: QuakeEvent[] = [];
  const lines = text.split('\n').filter(line => line.trim());

  for (const line of lines.slice(0, 20)) {
    try {
      const parts = line.split(/\s+/).filter(part => part.trim());
      
      if (parts.length >= 6) {
        const mag = parseFloat(parts[5]);
        if (mag > 0) {
          const quake: QuakeEvent = {
            id: `${parts[0]}_${parts[1]}_${parts[2]}_${parts[3]}`,
            time: new Date(`${parts[0]} ${parts[1]}`).getTime(),
            mag,
            place: parts.slice(6).join(' ') || 'Türkiye',
            lat: parseFloat(parts[2]),
            lon: parseFloat(parts[3]),
            source
          };

          quakes.push(quake);
        }
      }
    } catch (parseError) {
      console.warn('Failed to parse quake line:', parseError);
    }
  }

  return quakes.sort((a, b) => b.time - a.time);
}

async function getTokensForProvince(env: Environment, provinceCode: string): Promise<string[]> {
  try {
    const provinceKey = `province:${provinceCode}`;
    const data = await env.KV.get(provinceKey);
    
    if (data) {
      const tokenData: TokenData = JSON.parse(data);
      return tokenData.tokens;
    }
    
    return [];
  } catch (error) {
    console.error(`Failed to get tokens for province ${provinceCode}:`, error);
    return [];
  }
}

async function sendFCMNotification(env: Environment, tokens: string[], quake: QuakeEvent): Promise<void> {
  try {
    // FCM has a limit of 1000 tokens per request
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) {
      chunks.push(tokens.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const payload = {
        registration_ids: chunk,
        notification: {
          title: `Deprem Uyarısı • M${quake.mag.toFixed(1)}`,
          body: `${quake.place} • ${new Date(quake.time).toLocaleTimeString()}`
        },
        data: {
          id: quake.id,
          mag: quake.mag.toString(),
          place: quake.place,
          time: quake.time.toString()
        }
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${env.FCM_SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FCM error ${response.status}: ${errorText}`);
      }

      console.log(`Sent FCM to ${chunk.length} tokens for quake ${quake.id}`);
    }

  } catch (error) {
    console.error('FCM send error:', error);
    throw error;
  }
}