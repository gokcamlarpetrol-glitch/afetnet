import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY="afn:heat:grid:v1";
export type Cell = { k: string; v: number; ts: number };
let grid: Record<string, Cell> = {};

function keyFrom(lat:number, lon:number){
  // 250m yaklaşık grid (enlem-yakın)
  const dy = 0.00225; // ~250m
  const dx = 0.00225; // ~250m (yaklaşık, orta enlemler)
  const gy = Math.floor(lat/dy), gx = Math.floor(lon/dx);
  return `${gy}:${gx}`;
}

export async function load(){ const raw = await AsyncStorage.getItem(KEY); grid = raw? JSON.parse(raw) : {}; }
export async function save(){ await AsyncStorage.setItem(KEY, JSON.stringify(grid)); }

export async function noteSOS(lat:number, lon:number, weight=1){
  const k = keyFrom(lat,lon);
  const c = grid[k] || { k, v: 0, ts: Date.now() };
  c.v += weight;
  c.ts = Date.now();
  grid[k] = c;
  await save();
}

export function snapshot(decayHalfMs=30*60*1000){
  const now = Date.now(); const out:{k:string;v:number}[]=[];
  const lam = Math.log(2)/decayHalfMs;
  for (const k of Object.keys(grid)){
    const c = grid[k];
    const age = now - c.ts;
    const val = c.v * Math.exp(-lam*age);
    if (val > 0.05) {out.push({ k, v: val });}
  }
  return out;
}

export function cellCenter(k:string){
  const [gy,gx] = k.split(":").map(Number);
  const dy = 0.00225, dx = 0.00225;
  const lat = (gy+0.5)*dy, lon = (gx+0.5)*dx;
  return { lat, lon };
}



