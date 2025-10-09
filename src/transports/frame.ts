export type Frame = { v:1; kind:string; ts:number; srcId:string; payloadB64:string };

export function wrap(kind:string, srcId:string, payload:any): Uint8Array{
  const f: Frame = { v:1, kind, ts: Date.now(), srcId, payloadB64: Buffer.from(JSON.stringify(payload)).toString("base64") };
  return Uint8Array.from(Buffer.from(JSON.stringify(f)));
}
export function unwrap(bytes:Uint8Array): Frame|null{
  try{ return JSON.parse(Buffer.from(bytes).toString()) as Frame; }catch{ return null; }
}



