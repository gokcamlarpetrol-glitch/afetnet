import * as FileSystem from 'expo-file-system';

export const TILE_ROOT = '/tmp/tiles/';

export type BBox = { minLat:number; minLng:number; maxLat:number; maxLng:number };
export type TileJob = { zFrom:number; zTo:number; bbox:BBox; sourceTemplate:string /* e.g. https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png */ };

function long2tile(lon:number, zoom:number){ return Math.floor((lon+180)/360*Math.pow(2,zoom)); }
function lat2tile(lat:number, zoom:number){ return Math.floor((1 - Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2 * Math.pow(2,zoom)); }

export function estimateTiles(job:TileJob){
  let count=0;
  for(let z=job.zFrom; z<=job.zTo; z++){
    const xMin = long2tile(job.bbox.minLng, z), xMax = long2tile(job.bbox.maxLng, z);
    const yMin = lat2tile(job.bbox.maxLat, z), yMax = lat2tile(job.bbox.minLat, z);
    count += (xMax-xMin+1)*(yMax-yMin+1);
  }
  const avgTileKB = 20; // kabaca, OSM raster için
  const sizeMB = (count*avgTileKB)/1024;
  return { count, sizeMB };
}

async function ensureDir(path:string){ await FileSystem.makeDirectoryAsync(path, { intermediates:true }).catch(()=>{}); }

export async function downloadTiles(job:TileJob, onProgress?:(_done:number, _total:number)=>void){
  const { count } = estimateTiles(job);
  let done = 0;
  for(let z=job.zFrom; z<=job.zTo; z++){
    const xMin = long2tile(job.bbox.minLng, z), xMax = long2tile(job.bbox.maxLng, z);
    const yMin = lat2tile(job.bbox.maxLat, z), yMax = lat2tile(job.bbox.minLat, z);
    for(let x=xMin; x<=xMax; x++){
      for(let y=yMin; y<=yMax; y++){
        const dir = `${TILE_ROOT}${z}/${x}/`;
        await ensureDir(dir);
        const path = `${dir}${y}.png`;
        const ex = await FileSystem.getInfoAsync(path);
        if(!ex.exists){
          // round-robin subdomain
          const sub = ['a','b','c'][(x+y+z)%3];
          const url = job.sourceTemplate.replace('{s}', sub).replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
          try{
            const res = await FileSystem.downloadAsync(url, path);
            if(res.status!==200){ /* ignore; leave hole */ }
          }catch{ /* ignore */ }
        }
        done++; onProgress?.(done,count);
      }
    }
  }
}

export async function removeAllTiles(){
  const ex = await FileSystem.getInfoAsync(TILE_ROOT);
  if(ex.exists){ await FileSystem.deleteAsync(TILE_ROOT, { idempotent:true }); }
}

export async function tileStats(){
  const ex = await FileSystem.getInfoAsync(TILE_ROOT);
  if(!ex.exists) {return { files:0, mb:0 };}
  let files=0, mb=0;
  async function walk(dir:string){
    const list = await FileSystem.readDirectoryAsync(dir);
    for(const f of list){
      const p = dir+ (dir.endsWith('/')?'':'/') + f;
      const inf = await FileSystem.getInfoAsync(p);
      if(inf.isDirectory){ await walk(p+'/'); }
      else{ files++; mb += ((inf as any).size||0)/1_000_000; }
    }
  }
  await walk(TILE_ROOT);
  return { files, mb };
}
