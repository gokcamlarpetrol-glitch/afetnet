import { Link, LinkKind, LinkMetrics } from "./types";
import { incr } from "../mesh/health";

type Listener = (bytes:Uint8Array, meta:any)=>void;

export class LinkMux {
  private links: Link[] = [];
  private onMsg: Listener | null = null;
  add(link: Link){
    link.onMessage((b,m)=> this.onMsg?.(b, m));
    this.links.push(link);
  }
  async upAll(){ for(const l of this.links){ try{ await l.up(); }catch{} } }
  async downAll(){ for(const l of this.links){ try{ await l.down(); }catch{} } }
  onMessage(cb: Listener){ this.onMsg = cb; }

  // redundant send: small critical messages duplicated with suppressor external
  async send(bytes: Uint8Array, opts?:{critical?:boolean}){
    const order = ["lora","wfd","ble"] as LinkKind[];
    const sorted = this.links.slice().sort((a,b)=> order.indexOf(a.kind)-order.indexOf(b.kind));
    let ok=false;
    for(const l of sorted){
      try{
        const sent = await l.send(bytes);
        ok = ok || sent;
        await incr({ kind:"bundle_tx" }); // link-agnostic counter
      }catch{}
      if(!opts?.critical && ok) {break;}
    }
    return ok;
  }
  metrics(){ return this.links.map(l=>({ id:l.id, kind:l.kind, ...l.metrics() })); }
}



