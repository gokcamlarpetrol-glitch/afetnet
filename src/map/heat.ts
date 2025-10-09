export type Hit = { lat: number; lon: number; ts: number; weight?: number };
export type Grid = { w: number; h: number; cell: number; data: Float32Array };

export function makeGrid(cell=50, w=360, h=640): Grid {
  return { w, h, cell, data: new Float32Array(Math.ceil(w/cell)*Math.ceil(h/cell)) };
}

export function addHit(grid: Grid, x: number, y: number, v=1){
  const ci = Math.floor(x/grid.cell), cj = Math.floor(y/grid.cell);
  const cols = Math.ceil(grid.w/grid.cell);
  const idx = cj*cols + ci;
  if (idx>=0 && idx<grid.data.length) {grid.data[idx] += v;}
}

export function decay(grid: Grid, halfLifeMs=60_000, dtMs=5_000){
  // approximate exponential decay: v *= 0.5^(dt/halfLife)
  const f = Math.pow(0.5, dtMs/halfLifeMs);
  for (let i=0;i<grid.data.length;i++) {grid.data[i]*=f;}
}

export function normalize(grid: Grid){
  let mx=0; for (let i=0;i<grid.data.length;i++) {if (grid.data[i]>mx) {mx=grid.data[i];}}
  const out = new Float32Array(grid.data.length);
  if (mx<=0) {return out;}
  for (let i=0;i<grid.data.length;i++) {out[i] = Math.min(1, grid.data[i]/mx);}
  return out;
}



