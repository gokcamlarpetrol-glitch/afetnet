// @ts-ignore
import { PermissionsAndroid } from "react-native";
import WifiP2p from "react-native-wifi-p2p-reborn";
import type { P2P, P2PEvents, P2PPeer } from "./P2P";

/**
 * NOTE: Wi-Fi Direct kütüphanesi peer discovery + group connection sağlar.
 * Mesaj için basit bir TCP soketi açıyoruz (owner cihaz server). Demo amaçlı kısa metin mesajı.
 */
// @ts-ignore
import { SafeTCP } from "./SafeTCP";

const PORT = 43879;

export default function createP2P(): P2P {
  let events: P2PEvents = {};
  let server: any = null;
  const sockets = new Map<string, any>(); // deviceAddress -> socket

  async function ensurePerms(){
    const perms = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES
    ];
    for (const p of perms) {await PermissionsAndroid.request(p);}
  }

  function mapPeers(list:any[]): P2PPeer[] {
    return list.map((p:any)=>({ id: p.deviceAddress, name: p.deviceName || "AfetNet", connected: false }));
  }

  async function startServer(ownerIp: string){
    if (server) {return;}
    server = SafeTCP.createServer((socket:any)=>{
      socket.on("data",(buf:Buffer)=>{
        try {
          const obj = JSON.parse(buf.toString("utf8"));
          if (obj?.type === "text") {
            // find pseudo peer
            const peer: P2PPeer = { id: socket.remoteAddress || "peer", name: "AfetNet", connected: true };
            events.onMessage?.(peer, obj.text, obj.ts ?? Date.now());
          }
        } catch {}
      });
      socket.on("error",()=>{});
    }).listen({ port: PORT, host: ownerIp });
  }

  return {
    async start(e){
      events = e;
      await ensurePerms();
      await WifiP2p.initialize();
      // @ts-ignore
      await WifiP2p.setDeviceName(`AfetNet-${Math.random().toString(36).slice(2,6)}`);
      // @ts-ignore
      WifiP2p.onPeersUpdated(async ({ devices }: any) => {
        events.onPeers?.(mapPeers(devices || []));
      });
      // @ts-ignore
      WifiP2p.onConnectionInfoAvailable(async (info:any)=>{
        if (info.groupFormed) {
          const ownerIp = info.groupOwnerAddress;
          if (info.isGroupOwner) {
            await startServer("0.0.0.0");
          } else {
            // client connects to owner
            const socket = SafeTCP.createConnection({ port: PORT, host: ownerIp }, ()=>{});
            sockets.set(ownerIp, socket);
          }
          events.onConnection?.({ id: ownerIp, name: "Group", connected: true },"connected");
        }
      });
      // @ts-ignore
      await WifiP2p.startDiscoveringPeers();
    },
    async stop(){
      // @ts-ignore
      try { await WifiP2p.stopDiscoveringPeers(); } catch {}
      // @ts-ignore
      try { await WifiP2p.cancelConnect(); } catch {}
      sockets.forEach(s=>{ try{s.destroy();}catch{} });
      sockets.clear();
      if (server){ try{ server.close(); }catch{} server=null; }
    },
    async peers(){
      // @ts-ignore
      const { devices } = await WifiP2p.getAvailablePeers();
      return mapPeers(devices || []);
    },
    async connect(peerId){
      // @ts-ignore
      await WifiP2p.connect(peerId);
    },
    async disconnect(peerId){
      // @ts-ignore
      try { await WifiP2p.removeGroup(); } catch {}
    },
    async sendText(peerId, text){
      // If we are owner, send to all; else send to owner
      // @ts-ignore
      const info = await WifiP2p.getConnectionInfo();
      const payload = JSON.stringify({ type:"text", text, ts: Date.now() });
      if (info.isGroupOwner) {
        sockets.forEach(s=>{ try { s.write(payload); } catch {} });
      } else {
        const host = info.groupOwnerAddress;
        let s = sockets.get(host);
        if (!s) {
          s = SafeTCP.createConnection({ port: PORT, host }, ()=>{});
          sockets.set(host, s);
          await new Promise(r=>setTimeout(r, 200));
        }
        s.write(payload);
      }
    }
  };
}
