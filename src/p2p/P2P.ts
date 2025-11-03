import { logger } from '../utils/productionLogger';

export type P2PPeer = { id: string; name: string; connected?: boolean };
export type P2PEvents = {
  onPeers?: (peers: P2PPeer[]) => void;
  onMessage?: (from: P2PPeer, text: string, ts: number) => void;
  onError?: (err: string) => void;
  onConnection?: (peer: P2PPeer, state: 'connecting' | 'connected' | 'disconnected') => void;
};

export interface P2P {
  start(e: P2PEvents): Promise<void>;
  stop(): Promise<void>;
  peers(): Promise<P2PPeer[]>;
  connect(peerId: string): Promise<void>;
  disconnect(peerId: string): Promise<void>;
  sendText(peerId: string, text: string): Promise<void>;
}

export function getP2P(): P2P {
  throw new Error('P2P service not implemented');
}
