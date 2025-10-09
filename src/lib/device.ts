import * as SecureStore from "expo-secure-store";

const KEY="afn:deviceId";
export async function getDeviceId(){
  const v = await SecureStore.getItemAsync(KEY);
  if (v) {return v;}
  const id = "afn-" + Math.random().toString(36).slice(2,10);
  await SecureStore.setItemAsync(KEY, id);
  return id;
}
export function short16(id: string){
  // simple stable 16-bit hash
  let h=0; for (let i=0;i<id.length;i++){ h = (h*31 + id.charCodeAt(i)) & 0xffff; }
  return h;
}



