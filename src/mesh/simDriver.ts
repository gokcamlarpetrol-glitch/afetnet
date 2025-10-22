import type { MeshDriver } from './iface';

const listeners: ((_d: Uint8Array) => void)[] = [];

export const simDriver: MeshDriver = {
  supported: true,
  async start() {},
  async stop() {},
  async broadcast(data) {
    (globalThis as any).setTimeout(() => listeners.forEach(l => l(data)), 200);
  },
  onMessage(cb) {
    listeners.push(cb);
  },
};
