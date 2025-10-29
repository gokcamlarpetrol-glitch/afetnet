import { EEWEvent, EEWProvider } from '../EEWProvider';

export class AfadKandilliPoller implements EEWProvider {
  private timer?: NodeJS.Timeout;
  private listeners: Array<(e: EEWEvent) => void> = [];
  private lastId?: string;
  constructor(private url: string, private intervalMs = 5000) {}
  onEvent(cb: (e: EEWEvent) => void) { this.listeners.push(cb); }
  async start() {
    if (!this.url) { return; }
    const tick = async () => {
      try {
        const res = await fetch(this.url);
        const json: any = await res.json().catch(()=>null);
        const item = Array.isArray(json?.result) ? json.result[0] : (json?.result || json?.[0] || json);
        if (!item) { return; }
        const id = item.id || item.eventId || `${item.date}-${item.latitude}-${item.longitude}`;
        if (id && id !== this.lastId) {
          this.lastId = id;
          const evt: EEWEvent = {
            eventId: String(id),
            lat: Number(item.latitude ?? item.lat),
            lon: Number(item.longitude ?? item.lon),
            magnitude: item.mag != null ? Number(item.mag) : (item.magnitude != null ? Number(item.magnitude) : undefined),
            depthKm: item.depth != null ? Number(item.depth) : (item.depth_km != null ? Number(item.depth_km) : undefined),
            region: item.region || item.place,
            source: 'afad/kandilli',
            issuedAt: Date.now(),
            etaSec: 0,
            certainty: 'medium',
          };
          if (!Number.isFinite(evt.lat) || !Number.isFinite(evt.lon)) { return; }
          this.listeners.forEach(l => l(evt));
        }
      } catch { /* ignore */ }
    };
    this.timer = setInterval(tick, this.intervalMs);
  }
  async stop() { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }
  async health() { return { ok: true }; }
}


