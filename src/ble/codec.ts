/**
 * Compact beacon codec for SOS/Location and small text chunks.
 * Service UUID: 0xAF01 (hex). We pack service data bytes.
 *
 * Frame types:
 * 0x01 = SOS+LOC (lat/lon + batt + seq)
 * 0x02 = TEXT chunk (seq + chunkIndex + total + crc8 + up to 12 bytes)
 * 0x03 = TEXT v2 (TTL/hops + 16-bit msgId + up to 10 bytes)
 * 0x04 = Encrypted LOC v2 (team location)
 * 0x05 = SOS with statuses (lat/lon + batt + statuses)
 */
export const SERVICE_UUID = "AF01";

function toInt32(n: number){ return Math.max(Math.min(Math.round(n), 0x7fffffff), -0x80000000); }
function crc8(buf: Uint8Array){
  let c = 0xff;
  for (let i=0;i<buf.length;i++){
    const bufValue = buf[i];
    if (bufValue !== undefined) {
      c ^= bufValue;
    }
    for (let b=0;b<8;b++){ c = (c & 0x80) ? ((c<<1) ^ 0x07) & 0xff : (c<<1)&0xff; }
  }
  return c & 0xff;
}

/** encode SOS+Location: lat/lon scaled by 1e6 */
export function encodeLoc(lat: number, lon: number, battPct: number, _seq: number){
  const b = new Uint8Array(1+1+4+4+1+1); // ver, type, lat, lon, batt, crc
  b[0]=1; b[1]=0x01;
  const latI = toInt32(lat*1e6), lonI = toInt32(lon*1e6);
  new DataView(b.buffer).setInt32(2, latI, true);
  new DataView(b.buffer).setInt32(6, lonI, true);
  b[10] = Math.max(0, Math.min(100, Math.round(battPct)));
  b[11] = crc8(b.subarray(0,11));
  return b;
}

/** v1 0x02: legacy TEXT chunk (kept for backward compatibility) */
export function encodeTextChunk(seq: number, idx: number, total: number, payload: Uint8Array){
  const len = Math.min(payload.length, 12);
  const b = new Uint8Array(1+1+1+1+1+len);
  b[0]=1; b[1]=0x02; b[2]=seq&0xff; b[3]=idx&0xff; b[4]=total&0xff;
  b.set(payload.subarray(0,len), 5);
  return b;
}

/** v1 0x03: TEXT v2 (TTL/hops + 16-bit msgId) */
export function encodeTextV2(msgId16: number, ttl: number, hops: number, idx:number, total:number, payload: Uint8Array){
  const len = Math.min(payload.length, 10); // header bigger → 10B payload
  const b = new Uint8Array(1+1+1+1+2+1+1+len);
  b[0]=1; b[1]=0x03; b[2]=ttl&0xff; b[3]=hops&0xff;
  b[4]=(msgId16>>8)&0xff; b[5]=msgId16&0xff;
  b[6]=idx&0xff; b[7]=total&0xff;
  b.set(payload.subarray(0,len), 8);
  return b;
}

/** v1 0x05: SOS with statuses */
export function encodeSOSWithStatus(lat: number, lon: number, battPct: number, statuses: string[]){
  // Create status string and encode as bytes
  const statusString = statuses.join('|');
  const statusBytes = new TextEncoder().encode(statusString);
  
  // Calculate total length: ver(1) + type(1) + lat(4) + lon(4) + batt(1) + statusLen(1) + statusBytes + crc(1)
  const totalLen = 1 + 1 + 4 + 4 + 1 + 1 + statusBytes.length + 1;
  const b = new Uint8Array(totalLen);
  
  let offset = 0;
  b[offset++] = 1; // version
  b[offset++] = 0x05; // type SOS with status
  
  const latI = toInt32(lat*1e6), lonI = toInt32(lon*1e6);
  new DataView(b.buffer).setInt32(offset, latI, true); offset += 4;
  new DataView(b.buffer).setInt32(offset, lonI, true); offset += 4;
  b[offset++] = Math.max(0, Math.min(100, Math.round(battPct)));
  b[offset++] = statusBytes.length;
  b.set(statusBytes, offset); offset += statusBytes.length;
  
  // CRC over all data except the CRC byte itself
  b[offset] = crc8(b.subarray(0, offset));
  
  return b;
}

/** Decoder → returns normalized objects for 0x01/0x02/0x03 */
export function decode(data: Uint8Array){
  if (data.length<2) {return null;}
  const ver = data[0], type = data[1];
  if (ver!==1) {return null;}
  if (type===0x01 && data.length>=12){
    const dv = new DataView(data.buffer, data.byteOffset);
    const lat = dv.getInt32(2,true)/1e6; const lon = dv.getInt32(6,true)/1e6;
    const batt = data[10];
    const ok = data[11]===crc8(data.subarray(0,11));
    if(!ok) {return null;}
    return { t:"loc", lat, lon, batt };
  }
  if (type===0x02 && data.length>=5){
    const seq = data[2], idx = data[3], total = data[4];
    if (seq !== undefined && idx !== undefined && total !== undefined) {
      return { t:"txt", seq, idx, total, payload: data.subarray(5) };
    }
    return null;
  }
  if (type===0x03 && data.length>=8){
    const ttl=data[2], hops=data[3];
    if (ttl !== undefined && hops !== undefined && data[4] !== undefined && data[5] !== undefined) {
      const id16=(data[4]<<8)|data[5];
      const idx=data[6], total=data[7];
      if (idx !== undefined && total !== undefined) {
        return { t:"txt2", ttl, hops, id16, idx, total, payload: data.subarray(8) };
      }
    }
    return null;
  }
  if (type===0x04 && data.length>=4){
    // Encrypted LOC v2: payload = nonce|secretbox
    // Decoding will be handled at bridge layer since we need group key.
    return { t:"loc2", payload: data.subarray(2) };
  }
  if (type===0x05 && data.length>=13){
    // SOS with statuses: ver(1) + type(1) + lat(4) + lon(4) + batt(1) + statusLen(1) + statusBytes + crc(1)
    const dv = new DataView(data.buffer, data.byteOffset);
    const lat = dv.getInt32(2,true)/1e6;
    const lon = dv.getInt32(6,true)/1e6;
    const batt = data[10];
    const statusLen = data[11];
    if (statusLen === undefined) return null;
    
    if (data.length < 12 + statusLen + 1) return null; // Not enough data
    
    const statusBytes = data.subarray(12, 12 + statusLen);
    const statusString = new TextDecoder().decode(statusBytes);
    const statuses = statusString ? statusString.split('|') : [];
    
    // Verify CRC
    const expectedCrc = data[12 + statusLen];
    if (expectedCrc === undefined) return null;
    const actualCrc = crc8(data.subarray(0, 12 + statusLen));
    if (expectedCrc !== actualCrc) return null;
    
    return { t:"sos", lat, lon, batt, statuses };
  }
  return null;
}
