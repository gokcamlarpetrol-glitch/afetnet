import { tx } from '../db/core';
export type PinKind = 'task'|'cap';
export type Pin = { id:string; kind:PinKind; title:string; lat:number; lon:number; status?:string; ref?:string; ts:number };

export async function upsertPin(p: Pin){
  await tx(async d=>{
    await d.executeSql(
      'INSERT OR REPLACE INTO pins(id,kind,title,lat,lon,status,ref,ts) VALUES(?,?,?,?,?,?,?,?)',
      [p.id,p.kind,p.title,p.lat,p.lon,p.status||null,p.ref||null,p.ts],
    );
  });
}
export async function removePin(id:string){ await tx(async d=>{ await d.executeSql('DELETE FROM pins WHERE id=?',[id]); }); }
export async function listPins(kind?:PinKind){
  return tx(async d=>{
    let q='SELECT id,kind,title,lat,lon,status,ref,ts FROM pins'; const args:any[]=[];
    if (kind){ q+=' WHERE kind=?'; args.push(kind); }
    q+=' ORDER BY ts DESC';
    const r = await d.executeSql(q,args);
    const out:Pin[]=[]; for (let i=0;i<r[0].rows.length;i++){ out.push(r[0].rows.item(i)); }
    return out;
  });
}



