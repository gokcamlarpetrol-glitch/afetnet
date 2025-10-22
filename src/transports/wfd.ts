import * as FileSystem from 'expo-file-system';
import { Link, LinkMetrics } from './types';

const ROOM_DIR = '/tmp/wfd_rooms/';

function delay(ms:number){ return new Promise(r=>(globalThis as any).setTimeout(r,ms)); }

export class WfdLink implements Link {
  id: string; kind:'wfd'='wfd';
  private room: string;
  private cb: ((b:Uint8Array,m:any)=>void)|null=null;
  private met: LinkMetrics = { up:false, tx:0, rx:0, errors:0 };

  constructor(roomId:string){ this.id = 'wfd_'+roomId; this.room = roomId; }

  async up(){
    await FileSystem.makeDirectoryAsync(ROOM_DIR+this.room, { intermediates:true }).catch(()=>{});
    this.met.up=true; this.met.lastUpTs=Date.now();
    this.poll();
  }
  async down(){ this.met.up=false; }

  onMessage(cb:(b:Uint8Array,m:any)=>void){ this.cb=cb; }

  private async poll(){
    while(this.met.up){
      try{
        const files = await FileSystem.readDirectoryAsync(ROOM_DIR+this.room);
        for(const f of files){
          if(!f.endsWith('.pkt')) {continue;}
          const path = ROOM_DIR+this.room+'/'+f;
          const b64 = await FileSystem.readAsStringAsync(path);
          await FileSystem.deleteAsync(path, { idempotent:true }).catch(()=>{});
          const u8 = Uint8Array.from((globalThis as any).Buffer.from(b64,'base64'));
          this.met.rx++; this.met.lastRxTs=Date.now();
          this.cb?.(u8, { room:this.room });
        }
      }catch{ this.met.errors++; }
      await delay(300);
    }
  }

  async send(bytes:Uint8Array){
    try{
      const name = Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.pkt';
      const path = ROOM_DIR+this.room+'/'+name;
      await FileSystem.writeAsStringAsync(path, (globalThis as any).Buffer.from(bytes).toString('base64'));
      this.met.tx++; return true;
    }catch{ this.met.errors++; return false; }
  }

  metrics(){ return this.met; }
}



