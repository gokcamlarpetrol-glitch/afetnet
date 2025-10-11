import * as FileSystem from "expo-file-system";
import { logger } from '../utils/productionLogger';

export async function applyTileDiff(diffUrl:string){
  try{
    const r = await fetch(diffUrl);
    const j = await r.json();
    // Expect array of { z,x,y, base64 }
    for(const t of j){
      const dir = `/tmp/tiles/${t.z}/${t.x}/`;
      await FileSystem.makeDirectoryAsync(dir,{intermediates:true}).catch(()=>{});
      const path = `${dir}${t.y}.png`;
      await FileSystem.writeAsStringAsync(path, t.base64);
    }
  }catch(e){ logger.debug("TileDiff error",e); }
}
