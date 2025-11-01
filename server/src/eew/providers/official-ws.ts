import { EEWEvent, EEWProvider } from '../EEWProvider';

export class OfficialWSProvider implements EEWProvider {
  private ws: any;
  private listeners: Array<(e: EEWEvent) => void> = [];
  constructor(private url: string, private token?: string) {}
  onEvent(cb: (e: EEWEvent) => void) { this.listeners.push(cb); }
  async start() {
    if (!this.url) { return; }
    // Lazy require to avoid adding deps when feature is off
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WS = require('ws');
    this.ws = new WS(this.url, { headers: this.token ? { Authorization: `Bearer ${this.token}` } : {} });
    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(String(data));
        const evt: EEWEvent = {
          eventId: msg.id || msg.eventId,
          lat: Number(msg.lat),
          lon: Number(msg.lon),
          magnitude: msg.mag != null ? Number(msg.mag) : undefined,
          depthKm: msg.depthKm != null ? Number(msg.depthKm) : undefined,
          region: msg.region,
          source: msg.source || 'official',
          issuedAt: Date.now(),
          etaSec: msg.etaSec != null ? Number(msg.etaSec) : undefined,
          certainty: (msg.certainty as any) || 'high',
        };
        if (!Number.isFinite(evt.lat) || !Number.isFinite(evt.lon)) { return; }
        this.listeners.forEach(l => l(evt));
      } catch { /* ignore */ }
    });
  }
  async stop() { try { this.ws?.close(); } catch { /* ignore */ } this.ws = null; }
  async health() { return { ok: !!this.ws && this.ws.readyState === 1 }; }
}


