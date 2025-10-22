export type BeaconKind = 'announcement' | 'sos' | 'status';

export type Beacon = {
  id: string;           // uuid
  kind: BeaconKind;     // sos|status|announcement
  msg: string;          // short text (<=120 chars)
  ts: number;           // created at (ms)
  ttlSec: number;       // live window (default 6h)
  repeatSec: number;    // rebroadcast cadence (default 90s in rubble mode)
  lastSent?: number;    // last local send ts
  qlat?: number;        // coarse location (optional)
  qlng?: number;
};

export const DEFAULTS = {
  ANNOUNCE_TTL: 6*3600, // 6 hours
  SOS_TTL: 24*3600,     // 24 hours
  STATUS_TTL: 6*3600,
  RUBBLE_REPEAT: 90,    // 90 seconds (battery safe)
  NORMAL_REPEAT: 180,   // 3 minutes
  MAX_MSG: 120,
};



