
export type MeshMsg =
  | { t: 'SOS'; id: string; ts: number; lat?: number; lon?: number; statuses?: string[]; ttl: number; hop?: number; }
  | { t: 'ACK'; id: string; ref: string; ttl: number; hop?: number; }
  | { t: 'DM'; id: string; to?: string; group?: string; enc: true; bodyB64: string; nonceB64: string; ttl: number; hop?: number; }
  | { t: 'VP'; id: string; to?: string; enc?: boolean; idx: number; total: number; bytesB64: string; ttl: number; hop?: number; }
  | { t: 'PAIR_REQ'; id: string; fromAfn: string; toAfn: string; fromPubB64: string; ts: number; ttl: number; hop?: number; }
  | { t: 'PAIR_ACK'; id: string; ref: string; toAfn: string; toPubB64: string; ts: number; ttl: number; hop?: number; }
  | { t: 'DM_LOOKUP'; id: string; targetAfn: string; inner: string; ttl: number; hop?: number; }
  | { t: 'GJOIN'; gid: string; fromAfn: string; fromPubB64: string; name?: string; ts: number; ttl: number; hop?: number; }
  | { t: 'GCONF'; gid: string; members: { afnId: string; pubKeyB64?: string; verified?: boolean; }[]; ts: number; ttl: number; hop?: number; }
  | { t: 'GMSG'; gid: string; id: string; enc: true; boxB64: string; nonceB64: string; sender: string; ts: number; ttl: number; prio?: 'HIGH' | 'NORMAL'; hop?: number; }
  | { t: 'GVERI'; gid: string; from: string; phrase: string; ts: number; ttl: number; hop?: number; }
  | { t: 'GVERA'; gid: string; from: string; ok: boolean; ts: number; ttl: number; hop?: number; };

export function encodeMeshMsg(msg: MeshMsg): string {
  // Compact JSON encoding with short field names
  const compact = {
    t: msg.t,
    i: msg.id,
    ts: msg.ts,
    tt: msg.ttl,
    h: msg.hop || 0
  };

  switch (msg.t) {
    case 'SOS':
      return JSON.stringify({
        ...compact,
        lat: msg.lat,
        lon: msg.lon,
        st: msg.statuses
      });
    
    case 'ACK':
      return JSON.stringify({
        ...compact,
        r: msg.ref
      });
    
    case 'DM':
      return JSON.stringify({
        ...compact,
        to: msg.to,
        g: msg.group,
        e: msg.enc,
        b: msg.bodyB64,
        n: msg.nonceB64
      });
    
    case 'VP':
      return JSON.stringify({
        ...compact,
        to: msg.to,
        e: msg.enc,
        x: msg.idx,
        tot: msg.total,
        by: msg.bytesB64
      });
    
    case 'PAIR_REQ':
      return JSON.stringify({
        ...compact,
        fa: msg.fromAfn,
        ta: msg.toAfn,
        fp: msg.fromPubB64
      });
    
    case 'PAIR_ACK':
      return JSON.stringify({
        ...compact,
        r: msg.ref,
        ta: msg.toAfn,
        tp: msg.toPubB64
      });
    
    case 'DM_LOOKUP':
      return JSON.stringify({
        ...compact,
        tg: msg.targetAfn,
        in: msg.inner
      });
    
    case 'GJOIN':
      return JSON.stringify({
        ...compact,
        g: msg.gid,
        fa: msg.fromAfn,
        fp: msg.fromPubB64,
        n: msg.name
      });
    
    case 'GCONF':
      return JSON.stringify({
        ...compact,
        g: msg.gid,
        m: msg.members
      });
    
    case 'GMSG':
      return JSON.stringify({
        ...compact,
        g: msg.gid,
        e: msg.enc,
        b: msg.boxB64,
        n: msg.nonceB64,
        s: msg.sender,
        p: msg.prio
      });
    
    case 'GVERI':
      return JSON.stringify({
        ...compact,
        g: msg.gid,
        f: msg.from,
        ph: msg.phrase
      });
    
    case 'GVERA':
      return JSON.stringify({
        ...compact,
        g: msg.gid,
        f: msg.from,
        ok: msg.ok
      });
  }
}

export function decodeMeshMsg(data: string): MeshMsg | null {
  try {
    const obj = JSON.parse(data);
    
    if (!obj.t || !obj.i || typeof obj.tt !== 'number') {
      return null;
    }

    const base = {
      id: obj.i,
      ttl: obj.tt,
      hop: obj.h || 0
    };

    switch (obj.t) {
      case 'SOS':
        return {
          t: 'SOS',
          ...base,
          ts: obj.ts || Date.now(),
          lat: obj.lat,
          lon: obj.lon,
          statuses: obj.st
        };
      
      case 'ACK':
        return {
          t: 'ACK',
          ...base,
          ref: obj.r
        };
      
      case 'DM':
        return {
          t: 'DM',
          ...base,
          to: obj.to,
          group: obj.g,
          enc: obj.e || false,
          bodyB64: obj.b,
          nonceB64: obj.n
        };
      
      case 'VP':
        return {
          t: 'VP',
          ...base,
          to: obj.to,
          enc: obj.e,
          idx: obj.x,
          total: obj.tot,
          bytesB64: obj.by
        };
      
      case 'PAIR_REQ':
        return {
          t: 'PAIR_REQ',
          ...base,
          fromAfn: obj.fa,
          toAfn: obj.ta,
          fromPubB64: obj.fp,
          ts: obj.ts || Date.now()
        };
      
      case 'PAIR_ACK':
        return {
          t: 'PAIR_ACK',
          ...base,
          ref: obj.r,
          toAfn: obj.ta,
          toPubB64: obj.tp,
          ts: obj.ts || Date.now()
        };
      
      case 'DM_LOOKUP':
        return {
          t: 'DM_LOOKUP',
          ...base,
          targetAfn: obj.tg,
          inner: obj.in
        };
      
      case 'GJOIN':
        return {
          t: 'GJOIN',
          ...base,
          gid: obj.g,
          fromAfn: obj.fa,
          fromPubB64: obj.fp,
          name: obj.n,
          ts: obj.ts || Date.now()
        };
      
      case 'GCONF':
        return {
          t: 'GCONF',
          ...base,
          gid: obj.g,
          members: obj.m || [],
          ts: obj.ts || Date.now()
        };
      
      case 'GMSG':
        return {
          t: 'GMSG',
          ...base,
          gid: obj.g,
          enc: obj.e || false,
          boxB64: obj.b,
          nonceB64: obj.n,
          sender: obj.s,
          prio: obj.p,
          ts: obj.ts || Date.now()
        };
      
      case 'GVERI':
        return {
          t: 'GVERI',
          ...base,
          gid: obj.g,
          from: obj.f,
          phrase: obj.ph,
          ts: obj.ts || Date.now()
        };
      
      case 'GVERA':
        return {
          t: 'GVERA',
          ...base,
          gid: obj.g,
          from: obj.f,
          ok: obj.ok,
          ts: obj.ts || Date.now()
        };
      
      default:
        return null;
    }
  } catch (error) {
    return null;
  }
}

export function clampTTL(ttl: number): number {
  return Math.max(0, Math.min(10, ttl));
}

export function generateMsgId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
