export type P2PPeer = { id: string; name: string; connected?: boolean };
export type P2PEvents = {
  onPeers?: (peers: P2PPeer[]) => void;
  onMessage?: (from: P2PPeer, text: string, ts: number) => void;
  onError?: (err: string) => void;
  onConnection?: (peer: P2PPeer, state: "connecting" | "connected" | "disconnected") => void;
};

export interface P2P {
  start(e: P2PEvents): Promise<void>;
  stop(): Promise<void>;
  peers(): Promise<P2PPeer[]>;
  connect(peerId: string): Promise<void>;
  disconnect(peerId: string): Promise<void>;
  sendText(peerId: string, text: string): Promise<void>;
}

export function notSupported(): P2P {
  return {
    async start(){ throw new Error("P2P bu platformda desteklenmiyor."); },
    async stop(){},
    async peers(){ return []; },
    async connect(){ throw new Error("Desteklenmiyor"); },
    async disconnect(){},
    async sendText(){ throw new Error("Desteklenmiyor"); }
  };
}



