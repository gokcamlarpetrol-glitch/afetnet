import type { MeshDriver } from "./iface";

const listeners: ((d: Uint8Array) => void)[] = [];

export const simDriver: MeshDriver = {
  supported: true,
  async start() {},
  async stop() {},
  broadcast(data) {
    setTimeout(() => listeners.forEach(l => l(data)), 200);
  },
  onMessage(cb) {
    listeners.push(cb);
  }
};
