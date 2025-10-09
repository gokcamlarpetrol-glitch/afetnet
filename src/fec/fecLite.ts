// Lightweight FEC for short texts. Not cryptographic.
// encode: utf8 -> crc32 append -> base32 -> duplicate+interleave
// decode: deinterleave -> majority vote -> base32->crc32 verify

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function toBase32(bytes: Uint8Array){
  let out="", v=0, bits=0;
  for(const b of bytes){ v=(v<<8)|b; bits+=8; while(bits>=5){ out+=B32[(v>>>(bits-5))&31]; bits-=5; } }
  if(bits>0){ out+=B32[(v<<(5-bits))&31]; }
  return out;
}
function fromBase32(s:string){
  let v=0, bits=0; const out:number[]=[];
  for(const ch of s.replace(/=+$/,'')){ const idx=B32.indexOf(ch.toUpperCase()); if(idx<0) {continue;} v=(v<<5)|idx; bits+=5; if(bits>=8){ out.push((v>>>(bits-8))&255); bits-=8; } }
  return new Uint8Array(out);
}
// CRC32 (IEEE)
export function crc32(u8: Uint8Array){
  let c=~0>>>0;
  for(let i=0;i<u8.length;i++){
    c ^= u8[i];
    for(let k=0;k<8;k++) {c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);}
  }
  return (~c)>>>0;
}
function utf8Encode(s:string){ return new TextEncoder().encode(s); }
function utf8Decode(u8:Uint8Array){ try{ return new TextDecoder().decode(u8); }catch{ return ""; } }

export function fecEncode(text: string){
  const src = utf8Encode(text);
  const crc = crc32(src);
  const bundle = new Uint8Array(src.length+4);
  bundle.set(src,0);
  bundle[src.length+0]=(crc>>>24)&255;
  bundle[src.length+1]=(crc>>>16)&255;
  bundle[src.length+2]=(crc>>>8)&255;
  bundle[src.length+3]=(crc>>>0)&255;
  const b32 = toBase32(bundle);
  // duplicate+interleave
  const a=b32, b=b32;
  let inter="";
  for(let i=0;i<a.length;i++){ inter+=a[i]; inter+=b[i]; }
  return inter;
}

export function fecDecode(interleaved: string){
  if(!interleaved) {return { ok:false, text:"" };}
  // deinterleave
  let a="", b="";
  for(let i=0;i<interleaved.length;i+=2){ a+=interleaved[i]||""; b+=interleaved[i+1]||""; }
  // majority vote per position (here just prefer the longer/valid arc)
  const cand=[a,b].sort((x,y)=>y.length-x.length);
  for(const s of cand){
    const raw = fromBase32(s);
    if(raw.length<4) {continue;}
    const body=raw.subarray(0, raw.length-4);
    const got=(raw[raw.length-4]<<24)|(raw[raw.length-3]<<16)|(raw[raw.length-2]<<8)|(raw[raw.length-1]);
    if(crc32(body)>>>0 === (got>>>0)){
      return { ok:true, text:utf8Decode(body) };
    }
  }
  return { ok:false, text:"(bozuk)" };
}



