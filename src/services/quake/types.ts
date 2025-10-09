export type QuakeItem = {
  id: string;
  time: number;
  mag: number;
  place: string;
  lat?: number;
  lon?: number;
  depth?: number;
  source?: string;
};

export interface QuakeProvider {
  name: string;
  fetchRecent(): Promise<QuakeItem[]>;
}

export type QuakeProviderType = 'USGS' | 'AFAD' | 'KANDILLI';