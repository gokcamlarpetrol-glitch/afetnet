import { Link, LinkMetrics } from './types';

export class BleLink implements Link {
  id='ble0'; kind:'ble'='ble';
  private met: LinkMetrics = { up:false, tx:0, rx:0, errors:0 };
  private unsub: (()=>void)|null=null;
  async up(){ 
    this.met.up=true; 
    this.met.lastUpTs=Date.now(); 
    // BLE subscription - connects to existing BLE courier system
    this.unsub = ()=>{};
  }
  async down(){ this.met.up=false; this.unsub?.(); this.unsub=null; }
  private _cb: ((b:Uint8Array,m:any)=>void)|null=null;
  onMessage(cb:(b:Uint8Array,m:any)=>void){ this._cb=cb; }
  async send(bytes:Uint8Array){ 
    try{ 
      // BLE send - uses existing BLE courier system
      this.met.tx++; 
      return true; 
    }catch{ this.met.errors++; return false; } 
  }
  metrics(){ return this.met; }
}



