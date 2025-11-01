export type EEWEvent = {
  eventId: string;
  lat: number;
  lon: number;
  magnitude?: number;
  depthKm?: number;
  region?: string;
  source: string;
  issuedAt: number; // epoch ms
  etaSec?: number;  // 0..60
  certainty?: 'low' | 'medium' | 'high';
};

export interface EEWProvider {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  onEvent(cb: (evt: EEWEvent) => void): void;
  health(): Promise<{ ok: boolean; details?: any }> | { ok: boolean; details?: any };
}


