// Feature flag configuration for hiding unfinished/beta/demo modules in production
// - Default values are production-safe (everything off unless known stable)
// - In development, you can create a FEATURES.json at the repo root to override
//   any of these flags dynamically without rebuilding release configs.

export interface FeatureFlags {
  readonly diagnostics: boolean;
  readonly bleMesh: boolean;
  readonly audioBeacon: boolean;
  readonly rubbleMode: boolean;
  readonly pdrFusion: boolean;
  readonly advancedMapOffline: boolean;
  readonly tilePrefetch: boolean;
  readonly blackBox: boolean;
  readonly bearing: boolean;
  readonly goToTarget: boolean;
  readonly voicePing: boolean;
  readonly beacon: boolean;
  readonly nearby: boolean;
  readonly relay: boolean;
  readonly board: boolean;
  readonly comprehensiveFeatures: boolean;
}

// Hard defaults for production
const defaultFlags: FeatureFlags = {
  diagnostics: false,
  bleMesh: false,
  audioBeacon: false,
  rubbleMode: false,
  pdrFusion: false,
  advancedMapOffline: false,
  tilePrefetch: false,
  blackBox: false,
  bearing: false,
  goToTarget: false,
  voicePing: false,
  beacon: false,
  nearby: false,
  relay: false,
  board: false,
  comprehensiveFeatures: false,
};

// Attempt to load overrides from repo root FEATURES.json (dev-only)
function loadOverrides(): Partial<FeatureFlags> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const overrides = require('../../FEATURES.json');
    if (overrides && typeof overrides === 'object') {
      return overrides as Partial<FeatureFlags>;
    }
  } catch (_err) {
    // Silently ignore when file does not exist
  }
  return null;
}

const overrides = loadOverrides();

export const FEATURES: FeatureFlags = {
  ...defaultFlags,
  ...(overrides ?? {}),
};

export type FeatureKey = keyof FeatureFlags;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return !!FEATURES[key];
}


