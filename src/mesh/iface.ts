import { bleManager } from '../ble/manager';
import { Buffer } from 'buffer';

export interface MeshDriver {
  supported: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(data: Uint8Array): Promise<void>;
  onMessage(cb: (data: Uint8Array) => void): void;
}

class BleMeshDriver implements MeshDriver {
  supported = true;

  async start(): Promise<void> {
    await bleManager.start();
  }

  async stop(): Promise<void> {
    bleManager.stop();
  }

  async broadcast(data: Uint8Array): Promise<void> {
    const message = Buffer.from(data).toString('base64');
    await bleManager.broadcast(message);
  }

  onMessage(cb: (data: Uint8Array) => void): void {
    bleManager.onMessage(message => {
      const data = Buffer.from(message, 'base64');
      cb(data);
    });
  }
}

export const meshDriver: MeshDriver = new BleMeshDriver();


