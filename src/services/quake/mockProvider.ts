import { QuakeItem, QuakeProvider } from "./types";

const now = Date.now();
const sample: QuakeItem[] = [
  { id: "q1", time: now - 1000 * 60 * 42, mag: 3.8, place: "Akdeniz, açıkları" },
  { id: "q2", time: now - 1000 * 60 * 180, mag: 4.2, place: "İzmir, Seferihisar" },
];

export const mockQuakeProvider: QuakeProvider = {
  name: 'Mock Provider',
  async fetchRecent(): Promise<QuakeItem[]> {
    await new Promise(r => setTimeout(r, 250));
    return sample.sort((a,b)=>b.time-a.time);
  },
};
