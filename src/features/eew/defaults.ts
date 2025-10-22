import { EewSettings } from './types';

export const DEFAULT_EEW_SETTINGS: EewSettings = {
  quakeProvider: 'kandilli',
  magThreshold: 3.5,
  liveMode: true,
  pollFastMs: 15000,
  pollSlowMs: 60000,
  region: { nw: [42.2, 26.0], se: [35.8, 45.0] },
  experimentalPWave: false,
  selectedProvinces: [],
};
