// @ts-ignore
import { Multipeer } from "react-native-multipeer";
import type { P2P, P2PEvents, P2PPeer } from "./P2P";

const svcType = "afetnet";

export default function createP2P(): P2P {
  let events: P2PEvents = {};
  const mp = new Multipeer({
    serviceType: svcType,
    peerName: `AfetNet-${Math.random().toString(36).slice(2,6)}`
  });

  mp.on("peerFound", (peer: any) => emitPeers());
  mp.on("peerLost", (peer: any) => emitPeers());
  mp.on("peerConnected", (peer: any) => {
    events.onConnection?.(mapPeer(peer), "connected");
    emitPeers();
  });
  mp.on("peerDisconnected", (peer: any) => {
    events.onConnection?.(mapPeer(peer), "disconnected");
    emitPeers();
  });
  mp.on("messageReceived", (peer: any, message: any) => {
    try {
      const obj = JSON.parse(String(message));
      if (obj?.type === "text") {
        events.onMessage?.(mapPeer(peer), obj.text, obj.ts ?? Date.now());
      }
    } catch {}
  });

  function mapPeer(p:any): P2PPeer {
    return { id: String(p.id ?? p.peerID ?? p.name), name: String(p.name ?? "AfetNet"), connected: Boolean(p.state === "connected") };
  }
  async function emitPeers(){
    const list = await mp.getPeers();
    const peers = list.map(mapPeer);
    events.onPeers?.(peers);
  }

  return {
    async start(e){ events = e; await mp.advertise(); await mp.browse(); await emitPeers(); },
    async stop(){ try { await mp.stopAdvertising(); await mp.stopBrowsing(); await mp.disconnectAll(); } catch {} },
    async peers(){ const list = await mp.getPeers(); return list.map(mapPeer); },
    async connect(peerId){ await mp.invite(peerId); },
    async disconnect(peerId){ await mp.disconnectPeer(peerId); },
    async sendText(peerId, text){
      const payload = JSON.stringify({ type:"text", text, ts: Date.now() });
      await mp.sendToPeer(peerId, payload);
    }
  };
}
