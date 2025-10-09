export type Lane = "life"|"urgent"|"normal";
export function laneDelay(l:Lane){ return l==="life"? 2_000 : l==="urgent"? 10_000 : 30_000; }



