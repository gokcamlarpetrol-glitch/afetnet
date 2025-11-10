export type Viewport = {
  center: { lat: number; lon: number };
  zoom: number;   // WebMercator zoom
  size: { w: number; h: number };
};

export function lon2x(lon:number){ return (lon + 180) / 360; }
export function lat2y(lat:number){
  const rad = lat * Math.PI/180;
  const y = (1 - Math.log(Math.tan(rad) + 1/Math.cos(rad)) / Math.PI) / 2;
  return Math.max(0, Math.min(1, y));
}

export function project(lat:number, lon:number, vp:Viewport){
  const scale = Math.pow(2, vp.zoom);
  const worldX = lon2x(lon) * 256 * scale;
  const worldY = lat2y(lat) * 256 * scale;

  const centerX = lon2x(vp.center.lon) * 256 * scale;
  const centerY = lat2y(vp.center.lat) * 256 * scale;

  const dx = worldX - centerX;
  const dy = worldY - centerY;

  // pixels on screen: assume map is centered and size is vp.size
  const x = vp.size.w/2 + dx;
  const y = vp.size.h/2 + dy;
  return { x, y };
}



