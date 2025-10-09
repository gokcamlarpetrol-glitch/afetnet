/**
 * Very light grid cell for density clusters/heat.
 * Q (Phase 38) ~0.002 deg ≈ 222m. We'll use GRID = 0.004 ≈ ~444m to aggregate.
 */
export const GRID = 0.004;
export function cellFor(lat:number, lng:number){
  const q=(v:number)=> Math.round(v/GRID)*GRID;
  const glat = q(lat), glng = q(lng);
  return { glat, glng, key: `${glat.toFixed(3)},${glng.toFixed(3)}` };
}
export function centerOfCell(key:string){
  const [a,b] = key.split(",").map(parseFloat);
  return { lat: a, lng: b };
}



