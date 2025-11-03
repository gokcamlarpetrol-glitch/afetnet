// This module is a placeholder for a real P2P implementation.
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

class NotImplementedP2P implements P2P {
  async start(e: P2PEvents): Promise<void> {
    logger.warn('P2P.start is not implemented');
    e.onError?.('P2P is not implemented');
  }
  async stop(): Promise<void> {
    logger.warn('P2P.stop is not implemented');
  }
  async peers(): Promise<P2PPeer[]> {
    logger.warn('P2P.peers is not implemented');
    return [];
  }
  async connect(peerId: string): Promise<void> {
    logger.warn('P2P.connect is not implemented');
    throw new Error('Not Implemented');
  }
  async disconnect(peerId: string): Promise<void> {
    logger.warn('P2P.disconnect is not implemented');
  }
  async sendText(peerId: string, text: string): Promise<void> {
    logger.warn('P2P.sendText is not implemented');
    throw new Error('Not Implemented');
  }
}

export function getP2P(): P2P {
  return new NotImplementedP2P();
}
