import { encodeULB } from "../ulb/codec";
import { broadcastULB } from "../ulb/p2p";

export async function whisper(text:string){
  const enc = await encodeULB(text.toLowerCase());
  await broadcastULB(enc);
}

export function template(status:"ok"|"help"|"trapped"){
  if(status==="ok") {return "aile tamam iyiyim bulu$ nokta";} // $ -> sözlükte "buluş" yoksa "bulu$"
  if(status==="help") {return "yardim lazim su ilac";}
  return "enkaz altinda konum qlat qlng";
}



