export interface MeshDriver {
  supported: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(_data: Uint8Array): Promise<void>;
  onMessage(_cb: (_data: Uint8Array) => void): void;
}



