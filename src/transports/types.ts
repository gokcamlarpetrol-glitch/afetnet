export type LinkKind = 'ble'|'wfd'|'lora';

export type LinkMetrics = {
  up: boolean;
  tx: number;
  rx: number;
  errors: number;
  lastUpTs?: number;
  lastRxTs?: number;
};

export interface Link {
  id: string;
  kind: LinkKind;
  up(): Promise<void>;
  down(): Promise<void>;
  send(bytes: Uint8Array): Promise<boolean>;
  onMessage(cb:(bytes:Uint8Array, meta:any)=>void): void;
  metrics(): LinkMetrics;
}



