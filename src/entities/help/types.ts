export type HelpPayload = {
  type: 'help';
  note?: string;
  people?: number;
  priority?: 'low'|'med'|'high';
  lat?: number | null;
  lon?: number | null;
  hash?: string; // optional source hash for dedupe/trace
};

export type QueueItem = {
  id: string;
  payload: HelpPayload;
  attempts: number;
  lastError?: string | null;
  nextAt?: number | null; // epoch ms when eligible to retry
};

export type MeshEnvelope = {
  t: 'help';
  hash: string;
  createdAt: number;
  payload: HelpPayload;
};

export type MeshBatch = {
  v: 1;
  c: number;
  items: MeshEnvelope[];
};
