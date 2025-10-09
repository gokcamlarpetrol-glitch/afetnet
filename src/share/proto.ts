export type Bitfield = { total:number; have:boolean[] }; // length=total
export function emptyBitfield(total:number): Bitfield { return { total, have: Array.from({length:total}, ()=>false) }; }
export function setHave(b:Bitfield, idx:number){ if(idx>=0 && idx<b.total) {b.have[idx]=true;} }
export function missing(b:Bitfield){ const out:number[]=[]; for(let i=0;i<b.total;i++){ if(!b.have[i]) {out.push(i);} } return out; }
export function percent(b:Bitfield){ let c=0; for(const v of b.have){ if(v) {c++;} } return Math.round(100*c/b.total); }



