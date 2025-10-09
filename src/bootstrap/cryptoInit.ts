import { ensureKeypair } from "../crypto/keys";
export async function ensureCryptoReady(){
  try{ await ensureKeypair(); }catch{}
}



