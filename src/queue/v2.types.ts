export type QueueKind = 'sos' | 'status' | 'note' | 'beacon';

export interface QueueRecordV2 {
  id: string;          // ulid-like or ts-rand id
  ts: number;          // milliseconds since epoch
  kind: QueueKind;     // message kind
  payload: any;        // JSON-safe payload
  ver: 2;              // schema version
  hash: string;        // sha256 of `${id}|${ts}|${kind}|${payloadJson}`
  sent?: boolean;      // local delivery marker
}

export interface QueueMeta {
  file: string;        // WAL path
  count: number;       // total records (including sent)
  pending: number;     // not sent
  lastTs?: number;     // last append timestamp
}



