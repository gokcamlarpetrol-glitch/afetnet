import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface BoundingBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

interface OfflineMapState {
  bbox: BoundingBox | null;
  minZoom: number;
  maxZoom: number;
  progress: number;
  isDownloading: boolean;
  cacheSizeMB: number;
  availableStorage: number;
  
  setBbox: (bbox: BoundingBox) => void;
  setZoomRange: (minZoom: number, maxZoom: number) => void;
  setProgress: (progress: number) => void;
  setIsDownloading: (downloading: boolean) => void;
  setCacheSizeMB: (sizeMB: number) => void;
  setAvailableStorage: (storage: number) => void;
  reset: () => void;
}

export const useOfflineMapStore = create<OfflineMapState>()(
  persist(
    (set, get) => ({
      bbox: null,
      minZoom: 10,
      maxZoom: 16,
      progress: 0,
      isDownloading: false,
      cacheSizeMB: 0,
      availableStorage: 0,
      
      setBbox: (bbox) => set({ bbox }),
      setZoomRange: (minZoom, maxZoom) => set({ minZoom, maxZoom }),
      setProgress: (progress) => set({ progress }),
      setIsDownloading: (isDownloading) => set({ isDownloading }),
      setCacheSizeMB: (cacheSizeMB) => set({ cacheSizeMB }),
      setAvailableStorage: (availableStorage) => set({ availableStorage }),
      reset: () => set({
        bbox: null,
        minZoom: 10,
        maxZoom: 16,
        progress: 0,
        isDownloading: false,
        cacheSizeMB: 0,
        availableStorage: 0,
      }),
    }),
    {
      name: 'offline-map-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
