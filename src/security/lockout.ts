import * as SecureStore from "expo-secure-store";
const KEY = "afn:pin_fail_v1";
export type PinState = { fails: number; until?: number };

export async function getState(): Promise<PinState>{
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? JSON.parse(raw) : { fails: 0 };
}
export async function fail(){
  const s = await getState();
  s.fails += 1;
  if (s.fails >= 5) { s.until = Date.now() + 5*60*1000; } // 5 dk kilit
  await SecureStore.setItemAsync(KEY, JSON.stringify(s));
}
export async function success(){
  await SecureStore.setItemAsync(KEY, JSON.stringify({ fails: 0 }));
}
export async function canTry(): Promise<{ ok: boolean; wait?: number }>{
  const s = await getState();
  if (s.until && Date.now() < s.until) {return { ok: false, wait: Math.ceil((s.until - Date.now())/1000) };}
  return { ok: true };
}



