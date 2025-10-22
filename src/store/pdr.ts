import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface PDRPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface PDRState {
  isRunning: boolean;
  pdrRunning: boolean;
  currentPosition: PDRPoint | null;
  trail: PDRPoint[];
  stepCount: number;
  heading: number;
  accuracyEstimate: number;
  
  // Sensor data
  lastAcceleration: { x: number; y: number; z: number } | null;
  lastMagnetometer: { x: number; y: number; z: number } | null;
  
  // GPS fusion data
  lastGPSPosition: PDRPoint | null;
  lastGPSTimestamp: number;
  gpsAccuracy: number;
  
  // PDR parameters
  stepLength: number; // meters
  threshold: number; // acceleration threshold for step detection
  fusionAlpha: number; // GPS/PDR fusion weight (0-1, higher = more PDR)
  
  startPDR: (initialLat: number, initialLon: number) => Promise<void>;
  stopPDR: () => void;
  addPoint: (lat: number, lon: number, accuracy?: number) => void;
  clearTrail: () => void;
  updateStepLength: (length: number) => void;
  updateThreshold: (threshold: number) => void;
  updateFusionAlpha: (alpha: number) => void;
}

let accelerometerSubscription: any = null;
let magnetometerSubscription: any = null;
let stepDetectionTimer: any = null;

export const usePDRStore = create<PDRState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      pdrRunning: false,
      currentPosition: null,
      trail: [],
      stepCount: 0,
      heading: 0,
      accuracyEstimate: 0,
      lastAcceleration: null,
      lastMagnetometer: null,
      lastGPSPosition: null,
      lastGPSTimestamp: 0,
      gpsAccuracy: 0,
      stepLength: 0.7, // Default 70cm step length
      threshold: 0.3, // Default acceleration threshold
      fusionAlpha: 0.7, // Default: 70% PDR, 30% GPS
      
      startPDR: async (initialLat: number, initialLon: number) => {
        const state = get();
        if (state.isRunning) return;
        
        // Set initial position
        const initialPoint: PDRPoint = {
          latitude: initialLat,
          longitude: initialLon,
          timestamp: Date.now(),
        };
        
        set({
          isRunning: true,
          pdrRunning: true,
          currentPosition: initialPoint,
          trail: [initialPoint],
          stepCount: 0,
          heading: 0,
        });
        
        // Start accelerometer
        Accelerometer.setUpdateInterval(100); // 10Hz
        accelerometerSubscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          set({ lastAcceleration: { x, y, z } });
          
          // Simple step detection based on acceleration magnitude
          if (magnitude > get().threshold) {
            // Potential step detected
            set((state) => ({ stepCount: state.stepCount + 1 }));
            
            // Update position based on step
            const currentPos = state.currentPosition;
            if (currentPos) {
              const stepLength = state.stepLength;
              const headingRad = (state.heading * Math.PI) / 180;
              
              const newLat = currentPos.latitude + (stepLength / 111320) * Math.cos(headingRad);
              const newLon = currentPos.longitude + (stepLength / (111320 * Math.cos(currentPos.latitude * Math.PI / 180))) * Math.sin(headingRad);
              
              const newPoint: PDRPoint = {
                latitude: newLat,
                longitude: newLon,
                timestamp: Date.now(),
              };
              
              set({
                currentPosition: newPoint,
                trail: [...state.trail, newPoint],
              });
            }
          }
        });
        
        // Start magnetometer for heading with improved calculation
        Magnetometer.setUpdateInterval(100);
        magnetometerSubscription = Magnetometer.addListener(({ x, y, z }) => {
          set({ lastMagnetometer: { x, y, z } });
          
          // Improved heading calculation with device orientation compensation
          // Convert to compass heading (0 = North, 90 = East, etc.)
          let heading = Math.atan2(y, x) * (180 / Math.PI);
          heading = 90 - heading; // Rotate to compass convention
          if (heading < 0) heading += 360;
          if (heading >= 360) heading -= 360;
          
          set({ heading });
        });
      },
      
      stopPDR: () => {
        if (accelerometerSubscription) {
          accelerometerSubscription.remove();
          accelerometerSubscription = null;
        }
        
        if (magnetometerSubscription) {
          magnetometerSubscription.remove();
          magnetometerSubscription = null;
        }
        
        if (stepDetectionTimer) {
          (globalThis as any).clearInterval(stepDetectionTimer);
          stepDetectionTimer = null;
        }
        
        set({ isRunning: false, pdrRunning: false });
      },
      
      addPoint: (lat: number, lon: number, accuracy?: number) => {
        const timestamp = Date.now();
        const newPoint: PDRPoint = {
          latitude: lat,
          longitude: lon,
          timestamp,
        };
        
        set((state) => {
          // GPS fusion: combine GPS with PDR position
          let fusedPosition = newPoint;
          
          if (state.currentPosition && accuracy !== undefined) {
            const state = get();
            const pdrPos = state.currentPosition;
            const gpsPos = newPoint;
            const alpha = state.fusionAlpha;
            
            // Simple complementary filter: alpha * PDR + (1-alpha) * GPS
            // Higher alpha when GPS is less accurate or stale
            const adjustedAlpha = accuracy > 10 ? Math.min(alpha + 0.2, 0.9) : alpha;
            
            fusedPosition = {
              latitude: adjustedAlpha * (pdrPos?.latitude || 0) + (1 - adjustedAlpha) * gpsPos.latitude,
              longitude: adjustedAlpha * (pdrPos?.longitude || 0) + (1 - adjustedAlpha) * gpsPos.longitude,
              timestamp,
            };
            
            // TODO: Implement Kalman filter for production
            // Current implementation uses simple complementary filter
            // Kalman would provide better noise reduction and uncertainty estimation
          }
          
          return {
            currentPosition: fusedPosition,
            trail: [...state.trail, fusedPosition],
            lastGPSPosition: newPoint,
            lastGPSTimestamp: timestamp,
            gpsAccuracy: accuracy || 0,
          };
        });
      },
      
      clearTrail: () => {
        set({
          trail: [],
          stepCount: 0,
          currentPosition: null,
        });
      },
      
      updateStepLength: (length: number) => {
        set({ stepLength: length });
      },
      
      updateThreshold: (threshold: number) => {
        set({ threshold });
      },
      
      updateFusionAlpha: (alpha: number) => {
        // Clamp alpha between 0 and 1
        const clampedAlpha = Math.max(0, Math.min(1, alpha));
        set({ fusionAlpha: clampedAlpha });
      },
    }),
    {
      name: 'pdr-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        stepLength: state.stepLength,
        threshold: state.threshold,
        fusionAlpha: state.fusionAlpha,
      }),
    },
  ),
);
