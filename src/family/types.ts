export type FamilyContact = {
  id: string;
  name: string;
  relation?: 'anne'|'baba'|'eş'|'kardeş'|'çocuk'|'arkadaş'|'diğer';
  secret: string;              // 6 haneli veya QR ile üretilen
  publicKey?: string;          // opsiyonel (libsodium varsa)
  lastSeen?: number;
  qlat?: number; qlng?: number; // quantized last grid
};
export type ULBMsg = {
  id: string;
  from: string;    // sender id
  to?: string;     // contact id (family), boş ise genel
  type: 'text'|'sos'|'hb'|'rv'; // rv=rendezvous
  body?: string;
  qlat?: number; qlng?: number; // optional quantized for hb/rv
  ts: number;
};
export type ULBAck = { id: string; seenBy: string; ts: number };