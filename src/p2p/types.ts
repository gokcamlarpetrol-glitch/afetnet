export const P2P_SERVICE = '0000AFET-0000-1000-8000-00805F9B34FB'; // custom 128-bit
export const P2P_CHAR_INBOX = '0000AFI1-0000-1000-8000-00805F9B34FB'; // we write to peer
export const P2P_CHAR_OUTBOX = '0000AFO1-0000-1000-8000-00805F9B34FB'; // peer reads from us

export type P2PHello = {
  v: 1;
  did: string;       // deviceId hash (short)
  p: number;         // pending count
};

export type CourierPacket = {
  v: 1;
  id: string;        // queue record id
  ts: number;
  kind: 'sos' | 'status';
  payload: any;      // compact JSON-safe
  hash: string;      // record hash for integrity
};

export type CourierBundle = {
  v: 1;
  from: string;      // did
  items: CourierPacket[];
};



