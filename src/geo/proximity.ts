export function haversineLatLng(a:{lat:number;lng:number}, b:{lat:number;lng:number}){
  const R=6371000, toR=(d:number)=>d*Math.PI/180;
  const dLat=toR(b.lat-a.lat), dLng=toR(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
export function gridKey(qlat?:number, qlng?:number){
  if(typeof qlat!=="number" || typeof qlng!=="number") {return undefined;}
  return `${qlat.toFixed(3)},${qlng.toFixed(3)}`;
}



