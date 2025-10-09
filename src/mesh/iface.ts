export interface MeshDriver {
  supported: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(data: Uint8Array): Promise<void>;
  onMessage(cb: (data: Uint8Array) => void): void;
}



