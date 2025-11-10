/**
 * Tiny text similarity: normalized token overlap (Jaccard-lite).
 */
export function similar(a:string, b:string){
  const tok = (s:string)=> new Set(s.toLowerCase().replace(/[^a-z0-9ğüşöçı\s]/gi,' ').split(/\s+/).filter(w=>w.length>=3));
  const A=tok(a), B=tok(b);
  if(!A.size || !B.size) {return 0;}
  let inter=0; for(const t of A){ if(B.has(t)) {inter++;} }
  return inter / Math.max(A.size, B.size);
}



