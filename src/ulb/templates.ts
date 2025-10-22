import { EEWAlert } from '../eew/types';

function clamp(x:number,a:number,b:number){ return Math.max(a, Math.min(b,x)); }

export function templateForCity(alert:EEWAlert, city:{name:string;lat:number;lng:number}, etaSec:number, mmi:number){
  const lvl = mmi>=7.5? 'çok şiddetli' : mmi>=6.0? 'şiddetli' : mmi>=4.5? 'orta' : 'zayıf';
  // ULB sözlüğüne uygun kısa kelimeler: "uyarı", "sarsıntı", "mmi", "sn" vb. (sözlükte yoksa eklenebilir)
  return `uyarı ${city.name} sarsıntı ${lvl} mmi ${mmi.toFixed(1)} eta ${clamp(etaSec,0,999)} sn`;
}

export function broadcastTemplates(alert:EEWAlert, rows: { name:string; eta:number; mmi:number }[], n=5){
  const sel = rows.slice(0,n).map(r=> templateForCity(alert, { name:r.name, lat:0, lng:0 }, r.eta, r.mmi ));
  return sel;
}



