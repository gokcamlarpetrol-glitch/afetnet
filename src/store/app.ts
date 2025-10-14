import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { HelpPayload, QueueItem, MeshEnvelope } from "../entities/help/types";
import { postJSON } from "../lib/http";
// import { encObj, decObj } from "../lib/crypto"; // Not available - would need implementation

const SEEN_KEY = "mesh_seen_hashes_v1";

type AppState = {
  queue: QueueItem[];
  enqueue: (p: HelpPayload) => number;
  size: () => number;
  flush: (opts?: { manual?: boolean }) => Promise<{ ok: number; fail: number }>;
  _tick: () => void; // background worker tick
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      queue: [],
      enqueue: (payload) => {
        const item: QueueItem = {
          id: String(Date.now()) + "-" + Math.random().toString(36).slice(2),
          payload,
          attempts: 0,
          lastError: null,
          nextAt: Date.now(), // eligible immediately
        };
        set((s) => ({ queue: [...s.queue, item] }));
        return get().queue.length;
      },
      size: () => get().queue.length,
      flush: async (opts) => {
        const now = Date.now();
        const q = get().queue;
        if (q.length === 0) {return { ok: 0, fail: 0 };}
        let ok = 0, fail = 0;
        const next: QueueItem[] = [];

        for (const it of q) {
          // Skip items not yet eligible
          if (it.nextAt && it.nextAt > now && !opts?.manual) { next.push(it); continue; }
          try {
            await postJSON("/ingest", it.payload);
            ok++;
            continue; // do NOT push to next (removed)
          } catch (e: any) {
            fail++;
            const attempts = (it.attempts ?? 0) + 1;
            // Exponential backoff: 1m, 2m, 5m, 10m, cap 30m
            const schedule = [60_000, 120_000, 300_000, 600_000, 1_800_000];
            const delay = schedule[Math.min(attempts - 1, schedule.length - 1)];
            next.push({
              ...it,
              attempts,
              lastError: String(e?.message || "network"),
              nextAt: now + delay,
            });
          }
        }
        set({ queue: next });
        return { ok, fail };
      },
      _tick: () => {
        // If there are eligible items, trigger a background flush (non-manual).
        const now = Date.now();
        const q = get().queue;
        if (q.some(it => (it.nextAt ?? 0) <= now)) {
          get().flush().catch(()=>{});
        }
      },
    }),
    {
      name: "afetnet:v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ queue: s.queue }),
    }
  )
);

/** Add minimal mesh helpers; do not break existing API */
export async function getQueueSnapshot(limit: number): Promise<MeshEnvelope[]> {
  // Get current queue from store
  const state = useApp.getState();
  const items = state.queue.slice(0, Math.max(0, limit));
  const out: MeshEnvelope[] = [];
  for (const it of items) {
    const p = it.payload;
    const hash = p.hash ?? String(it.id);
    out.push({ t: "help", hash, createdAt: Date.now(), payload: { ...p, hash } });
  }
  return out;
}

export async function importEnvelopes(envelopes: MeshEnvelope[], enqueue: (p: any)=>number) {
  const seenRaw = await AsyncStorage.getItem(SEEN_KEY);
  const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);
  let imported = 0;
  for (const env of envelopes) {
    const h = env?.hash || env?.payload?.hash;
    if (!h || seen.has(h)) {continue;}
    enqueue({ ...env.payload, hash: h });
    seen.add(h);
    imported++;
  }
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-5000)));
  return imported;
}
