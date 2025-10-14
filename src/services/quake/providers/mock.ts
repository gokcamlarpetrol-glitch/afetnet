import type { QuakeItem, QuakeProvider } from "../types";

const now = Date.now();
const sample: QuakeItem[] = [
  { id: "m1", time: now - 25 * 60 * 1000, mag: 3.9, place: "Akdeniz, açıkları" },
  { id: "m2", time: now - 3 * 60 * 60 * 1000, mag: 4.5, place: "İzmir, Seferihisar" },
];

export const mockProvider: QuakeProvider = {
  name: 'Mock Provider',
  async fetchRecent() {
    await new Promise(r => setTimeout(r, 200));
    return sample;
  }
};



