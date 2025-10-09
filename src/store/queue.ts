import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { bleRelay, RelayMessage } from "../services/ble/bleRelay";

export type QueueItem = { id: string; type: "sos" | "msg"; payload: any; ts: number };

type State = {
  items: QueueItem[];
  add(i: Omit<QueueItem, "id" | "ts">): void;
  remove(id: string): void;
  clear(): void;
  flush(): Promise<{ sent: number }>;
};

async function postJSON(url: string, data: any) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) {
    throw new Error("net");
  }
}

export const useQueue = create<State>()(persist((set, get) => ({
  items: [],
  add: (i) => set(s => ({ items: [{ id: crypto.randomUUID(), ts: Date.now(), ...i }, ...s.items] })),
  remove: (id) => set(s => ({ items: s.items.filter(x => x.id !== id) })),
  clear: () => set({ items: [] }),
  flush: async () => {
    const items = get().items.slice().reverse(); // FIFO
    let sent = 0;
    
    for (const it of items) {
      try {
        // Try BLE relay first
        const relayMessage: RelayMessage = {
          id: it.id,
          from: '', // Will be set by relay
          ts: it.ts,
          type: it.type === 'sos' ? 'SOS' : 'PING',
          ttl: 5,
          payload: JSON.stringify(it.payload)
        };
        
        await bleRelay.sendDirect(relayMessage);
        sent++;
        get().remove(it.id);
      } catch (bleError) {
        // Fallback to network if available
        try {
          const net = await NetInfo.fetch();
          if (net.isConnected) {
            await postJSON("https://postman-echo.com/post", { type: it.type, payload: it.payload, ts: it.ts });
            sent++;
            get().remove(it.id);
          }
        } catch {
          /* offline veya hata – bırak kuyruğu */
        }
      }
    }
    return { sent };
  }
}), { name: "afn/queue/v1", storage: createJSONStorage(() => AsyncStorage) }));