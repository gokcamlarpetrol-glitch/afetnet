export type MsgKind = 'text' | 'sos' | 'status';
export type Msg = {
  v: 1;
  id: string;            // unique per message
  threadId: string;      // conversation thread (RV code acts as thread seed)
  from: string;          // sender short id (our didShort)
  to?: string;           // optional recipient short id; if absent = broadcast to thread
  ts: number;            // created at
  kind: MsgKind;
  body: string;          // short text (<=160 chars); may contain fec-encoded text if enabled earlier
  qlat?: number;         // coarse location (optional)
  qlng?: number;
  ttlSec: number;        // e.g., 24h
  hops: number;          // hop count so far
  maxHops: number;       // cap (e.g., 8)
  ack?: boolean;         // this record is an ACK for `ackFor`
  ackFor?: string;       // message id being acknowledged
};

export type InboxItem = Msg & { seen?: boolean };



