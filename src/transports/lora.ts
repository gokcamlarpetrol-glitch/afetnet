import * as FileSystem from "expo-file-system";
import { Link, LinkMetrics } from "./types";

const CH = "/tmp/lora_ch/";
function delay(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

export class LoRaLink implements Link {
  id: string; kind:"lora"="lora";
  private cb: ((b:Uint8Array,m:any)=>void)|null=null;
  private met: LinkMetrics = { up:false, tx:0, rx:0, errors:0 };

  constructor(id="lora"){ this.id = id; }

  async up(){ await FileSystem.makeDirectoryAsync(CH, { intermediates:true }).catch(()=>{}); this.met.up=true; this.met.lastUpTs=Date.now(); this.loop(); }
  async down(){ this.met.up=false; }
  onMessage(cb:(b:Uint8Array,m:any)=>void){ this.cb=cb; }

  private async loop(){
    while(this.met.up){
      try{
        const files = await FileSystem.readDirectoryAsync(CH);
        for(const f of files){
          if(!f.endsWith(".sx")) {continue;}
          const path = CH+f; const b64 = await FileSystem.readAsStringAsync(path);
          await FileSystem.deleteAsync(path, { idempotent:true }).catch(()=>{});
          const u8 = Uint8Array.from(Buffer.from(b64,"base64"));
          this.met.rx++; this.met.lastRxTs=Date.now();
          this.cb?.(u8, { ch:"lora" });
        }
      }catch{ this.met.errors++; }
      await delay(400);
    }
  }

  async send(bytes:Uint8Array){
    try{
      const name = Date.now()+"_"+Math.random().toString(36).slice(2,5)+".sx";
      const path = CH+name;
      // LoRa kısa paket — sınırla
      const slice = bytes.slice(0, 200);
      await FileSystem.writeAsStringAsync(path, Buffer.from(slice).toString("base64"));
      this.met.tx++; return true;
    }catch{ this.met.errors++; return false; }
  }

  metrics(){ return this.met; }
}



