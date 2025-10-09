import { Envelope } from '../types';

const listeners = new Set<(m: Envelope) => void>();
let started = false;
let room = 'afetnet-dev-room';

export async function start(roomName = 'afetnet-dev-room'): Promise<void> {
  if (started) {return;}
  room = roomName;
  console.log('[SimTransport] started in room', room);
  started = true;
}

export async function stop(): Promise<void> {
  started = false;
  listeners.clear();
  console.log('[SimTransport] stopped');
}

export function subscribe(cb: (m: Envelope) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function broadcast(env: Envelope): Promise<void> {
  if (!started) {return;}
  
  const latency = 300 + Math.random() * 1200; // 300-1500ms random latency
  console.log(`[SimTransport] broadcasting ${env.type} with ${latency}ms latency`);
  
  setTimeout(() => {
    const copy = { ...env, hop: env.hop + 1 };
    for (const cb of listeners) {
      try {
        cb(copy);
      } catch (error) {
        console.warn('[SimTransport] listener error:', error);
      }
    }
  }, latency);
}

export function isRunning(): boolean {
  return started;
}

export function getRoom(): string {
  return room;
}
