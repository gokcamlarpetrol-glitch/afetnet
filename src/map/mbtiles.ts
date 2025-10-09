import { SafeSQLite } from "../db/SafeSQLite";

export type TileReq = { z:number; x:number; y:number };

export class MBTiles {
  private db: any;
  constructor(path:string){ this.db = SafeSQLite.openDatabase({ name: path, location: 'default' }); }

  async getTile(req:TileReq): Promise<Uint8Array|null>{
    return new Promise((resolve)=>{
      this.db.readTransaction((tx:any)=>{
        tx.executeSql("SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?", 
          [req.z, req.x, (1<<req.z)-1-req.y], // TMS vs XYZ flip
          (_:any,rs:any)=>{ if(rs.rows.length){ const b=rs.rows.item(0).tile_data as string; resolve(decode(b)); } else {resolve(null);} }
        );
      });
    });
  }
}

function decode(base64:string){
  const bin=globalThis.atob(base64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) {arr[i]=bin.charCodeAt(i);}
  return arr;
}
