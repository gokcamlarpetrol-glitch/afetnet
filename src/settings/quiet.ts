import * as FileSystem from "expo-file-system";
type Quiet = { drill:boolean; start?:number; end?:number };
const FILE = "/tmp/quiet.json";
let mem:Quiet={ drill:false };
export async function loadQuiet(){ try{ mem=JSON.parse(await FileSystem.readAsStringAsync(FILE)); }catch{} return mem; }
export async function setQuiet(q:Partial<Quiet>){ mem={ ...mem, ...q }; await FileSystem.writeAsStringAsync(FILE, JSON.stringify(mem)); return mem; }
export function isQuiet(){ return !!mem.start && !!mem.end && Date.now()%86400000>= (mem.start||0) && Date.now()%86400000 <= (mem.end||0); }
export function isDrill(){ return !!mem.drill; }



