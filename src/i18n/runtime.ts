import * as FileSystem from "expo-file-system";

const ROOT = "/tmp/afn_data/i18n/";
let current = "tr";
let cache: Record<string, any> = {};

export async function setLang(lang:string){
  current = lang;
  cache = {};
}
export function getLang(){ return current; }

async function loadLang(lang:string){
  const path = ROOT + lang + "/strings.json";
  try{
    const ex = await FileSystem.getInfoAsync(path);
    if(!ex.exists) {return {};}
    const txt = await FileSystem.readAsStringAsync(path);
    return JSON.parse(txt);
  }catch{ return {}; }
}
export async function t(key:string, vars?:Record<string,string|number>): Promise<string>{
  if(!cache[current]) {cache[current] = await loadLang(current);}
  if(!cache["tr"]) {cache["tr"] = await loadLang("tr");}
  const raw = (cache[current]?.[key] ?? cache["tr"]?.[key] ?? key) as string;
  if(!vars) {return raw;}
  return raw.replace(/\{\{(\w+)\}\}/g, (_,k)=>String(vars[k]??""));
}
