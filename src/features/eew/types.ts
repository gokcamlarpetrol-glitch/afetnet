export type QuakeProvider = "kandilli" | "afad" | "usgs" | "synthetic";

export interface EewRegion {
  nw: [number, number];
  se: [number, number];
}

export interface EewSettings {
  quakeProvider: QuakeProvider;
  magThreshold: number;
  liveMode: boolean;
  pollFastMs: number;
  pollSlowMs: number;
  region: EewRegion;
  experimentalPWave: boolean;
  selectedProvinces: string[];
}
