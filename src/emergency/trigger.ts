import { Platform } from "react-native";
import { p2pLocalSend } from "../p2p/send";
import { useSafety } from "../state/safetyStore";
import { sayKey } from "../voice/voice";
import { quantizeLatLng } from "../geo/coarse";
import * as Location from "expo-location";

// NOTE: Expo Managed projede HW tuşlarını global dinlemek sınırlı. Burada fallback: hızlı iki "ses azalt" tuşu algısı için ekran açıkken listener ekleyin.
// Eğer Bare veya dev-client ise native Module (VolumeKeyEmitter) ile bağlayın. Aksi halde SOS ekranına giden UI butonları sağlayın.

let lastVolDown = 0;
export function onVolumeDownPress(){
  const now = Date.now();
  if(now - lastVolDown <= 1500){
    // double press
    // burada SOS compose ekranına yönlendiren bir navigation event tetikleyin (mevcut Chat/SOS ekranınızda bir deep link varsa onu çağırın)
    // fallback: anında draft SOS oluştur
    quickDraftSOS();
  }
  lastVolDown = now;
}

async function quickDraftSOS(){
  const safety = useSafety.getState();
  const loc = await Location.getLastKnownPositionAsync({}).catch(()=>null);
  const q = loc ? quantizeLatLng(loc.coords.latitude, loc.coords.longitude) : null;
  const msg:any = { kind:"sos", body:"Hızlı SOS (kısayol)", hops:0, maxHops:6, ttlSec:3600, ts:Date.now() };
  if(q){ (msg).qlat=q.lat; (msg).qlng=q.lng; }
  if(safety.unconsciousMode){ await p2pLocalSend(msg); } else { msg.draft=true; await p2pLocalSend(msg); }
  await sayKey("sos_sent");
}

// Torch SOS (Morse ...---...)
export async function torchSOS(){
  try{
    // Optional: react-native-torch (Bare/dev-client). Dynamic import; fallback to screen flash UI.
    const Torch = require("react-native-torch").default;
    const unit = 200;
    const pattern = [1,1,1,3,3,3,1,1,1]; // S O S
    for(const p of pattern){
      Torch.switchState(true); await new Promise(r=>setTimeout(r, unit*p));
      Torch.switchState(false); await new Promise(r=>setTimeout(r, unit));
    }
  }catch{
    // fallback: no-op (veya bir ekran strobosu bileşeni ile)
  }
}
