import { readChunk } from './chunks';
import { p2pLocalSend } from '../p2p/send';
import { PackManifest } from './types';
import { senderThrottle } from './transfer';

export async function serveChunks(man: PackManifest, req: { id:string; need:number[] }){
  for(const idx of req.need){
    const offset = idx*man.chunkSize;
    const b64 = await readChunk(man.name.startsWith('file://')? man.name: man.name, offset, man.chunkSize).catch(()=>null);
    if(!b64) {continue;}
    await p2pLocalSend({ kind:'pack_chunk', v:1, id:req.id, idx, b64, ts: Date.now() });
    await senderThrottle();
  }
}



