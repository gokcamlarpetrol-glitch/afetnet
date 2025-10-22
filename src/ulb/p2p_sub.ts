import { decodeULB } from './codec';

type Subscriber = (text: string) => void;
let subscribers: Subscriber[] = [];

export function subscribeULB(callback: Subscriber): () => void {
  subscribers.push(callback);
  return () => {
    subscribers = subscribers.filter(s => s !== callback);
  };
}

export async function deliverULB(raw: Uint8Array) {
  try {
    const decoded = await decodeULB(raw);
    subscribers.forEach(cb => cb(decoded));
  } catch {
    // ignore decode errors
  }
}
