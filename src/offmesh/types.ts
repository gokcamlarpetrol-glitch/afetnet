// import { z } from 'zod';

export type MsgType = 'sos' | 'chat' | 'ping' | 'ack' | 'pos';

export interface Envelope {
  id: string;          // uuid v4
  type: MsgType;
  ttl: number;         // default 8
  hop: number;         // start 0
  ts: number;          // ms epoch
  payload: unknown;    // zod-validated struct per type
  sig?: string;        // base64 HMAC
  enc?: string;        // base64 AES-GCM ciphertext (optional)
}

export const DEFAULT_TTL = 8;
export const MAX_HOPS = 8;
export const MAX_PAYLOAD_SIZE = 1024; // bytes

// Zod schemas for payload validation - DISABLED FOR EXPO GO
// export const sosPayloadSchema = z.object({
//   lat: z.number(),
//   lon: z.number(),
//   people: z.number().min(1).max(50),
//   priority: z.enum(['low', 'med', 'high']),
//   note: z.string().max(280).optional(),
// });

// export const chatPayloadSchema = z.object({
//   text: z.string().max(500),
//   from: z.string().max(50),
// });

// export const pingPayloadSchema = z.object({
//   rtt: z.number().optional(),
// });

// export const ackPayloadSchema = z.object({
//   ackId: z.string(),
// });

// export const posPayloadSchema = z.object({
//   lat: z.number(),
//   lon: z.number(),
//   acc: z.number().optional(),
//   alt: z.number().optional(),
// });

// export type SOSPayload = z.infer<typeof sosPayloadSchema>;
// export type ChatPayload = z.infer<typeof chatPayloadSchema>;
// export type PingPayload = z.infer<typeof pingPayloadSchema>;
// export type AckPayload = z.infer<typeof ackPayloadSchema>;
// export type PosPayload = z.infer<typeof posPayloadSchema>;

// export const payloadSchemas = {
//   sos: sosPayloadSchema,
//   chat: chatPayloadSchema,
//   ping: pingPayloadSchema,
//   ack: ackPayloadSchema,
//   pos: posPayloadSchema,
// } as const;

// Temporary types for Expo Go compatibility
export type SOSPayload = any;
export type ChatPayload = any;
export type PingPayload = any;
export type AckPayload = any;
export type PosPayload = any;

export const payloadSchemas = {} as const;

export interface PeerInfo {
  id: string;
  name: string;
  transport: 'sim' | 'mciOS' | 'bleiOS' | 'wifiP2P' | 'bleAndroid';
  rtt?: number;
  lastSeen: number;
  connected: boolean;
}

export interface MeshStats {
  peers: number;
  queued: number;
  dedup: number;
  lastHop: string;
  uptime: number;
}

export interface JournalEvent {
  id: string;
  ts: number;
  type: 'send' | 'recv' | 'drop' | 'retry' | 'error';
  msgType: MsgType;
  size: number;
  hop: number;
  transport?: string;
  error?: string;
}

export interface TransportConfig {
  enabled: boolean;
  maxPeers?: number;
  heartbeatInterval?: number;
  reconnectDelay?: number;
}

export interface MeshConfig {
  topic: string;
  key?: string;
  transports: {
    sim: TransportConfig;
    mciOS: TransportConfig;
    bleiOS: TransportConfig;
    wifiP2P: TransportConfig;
    bleAndroid: TransportConfig;
  };
  qos: {
    rateLimits: {
      sos: number; // per minute
      chat: number;
      pos: number;
    };
    batteryThreshold: number; // percentage
    maxQueueSize: number;
    maxDedupSize: number;
  };
}



