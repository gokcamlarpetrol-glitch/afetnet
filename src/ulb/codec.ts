import * as FileSystem from 'expo-file-system';
const ROOT = '/tmp/afn_data/i18n/';

const cache: Record<string, Record<string, number>> = {};
const rcache: Record<string, string[]> = {};

async function loadDict(lang='tr'){
  if(cache[lang]) {return;}
  try{
    const txt = await FileSystem.readAsStringAsync(ROOT + `${lang}/ulb.dict.json`);
    const words: string[] = JSON.parse(txt);
    const map: Record<string, number> = {}; words.slice(0,256).forEach((w,i)=> map[w]=i);
    cache[lang]=map; rcache[lang]=words.slice(0,256);
  }catch{ cache[lang]={}; rcache[lang]=[]; }
}
export async function encodeULB(text:string, lang='tr'): Promise<Uint8Array>{
  await loadDict(lang);
  const map = cache[lang];
  const out: number[] = [];
  for(const raw of text.split(/\s+/)){
    const w = raw.toLowerCase();
    if(map[w]!==undefined){ out.push(map[w]); }
    else{
      out.push(255); // marker
      const b = new TextEncoder().encode(raw);
      out.push(b.length); for(const x of b) {out.push(x);}
    }
    out.push(254); // space delimiter
  }
  return new Uint8Array(out);
}
export async function decodeULB(bytes:Uint8Array, lang='tr'): Promise<string>{
  await loadDict(lang);
  const words = rcache[lang];
  const out: string[] = [];
  for(let i=0;i<bytes.length;){
    const t = bytes[i++]; if(t===254){ out.push(' '); continue; }
    if(t===255){
      const len = bytes[i++]; const slice = bytes.slice(i, i+len); i+=len;
      out.push(new TextDecoder().decode(slice));
    }else{
      out.push(words[t] || '?');
    }
  }
  return out.join('').trim();
}



