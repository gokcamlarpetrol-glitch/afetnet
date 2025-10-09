/** Utilities to compress a small JPEG and split into chunks reusing TextV2 framing.
 *  Wire up to UI later if needed. */
export function chunkify(buf: Uint8Array, max=10){
  const total = Math.ceil(buf.length/max);
  const parts: Uint8Array[] = [];
  for (let i=0;i<total;i++) {parts.push(buf.subarray(i*max, Math.min(buf.length,(i+1)*max)));}
  return { total, parts };
}



