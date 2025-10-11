import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { notifyPWaveAlert } from '../alerts/notify';
import { logger } from '../utils/productionLogger';

// Import Motion with fallback
let Motion: any = null;
try {
  Motion = require('expo-sensors').Motion;
} catch {
  // Motion not available
}

interface PWaveConfig {
  enabled: boolean;
  sampleRate: number; // Hz
  energyThreshold: number;
  zeroCrossingThreshold: number;
  stationaryThreshold: number; // m/s²
  detectionWindowMs: number;
  cooldownMs: number;
}

interface PWaveState {
  isListening: boolean;
  isStationary: boolean;
  lastDetection: number | null;
  detectionCount: number;
  error: string | null;
}

const defaultConfig: PWaveConfig = {
  enabled: false,
  sampleRate: 100, // 100 Hz
  energyThreshold: 0.5, // Conservative threshold
  zeroCrossingThreshold: 0.3, // Conservative threshold
  stationaryThreshold: 0.1, // Very conservative - device must be very still
  detectionWindowMs: 2000, // 2 seconds window
  cooldownMs: 30000, // 30 seconds cooldown between detections
};

export function usePWave(config: Partial<PWaveConfig> = {}) {
  const [state, setState] = useState<PWaveState>({
    isListening: false,
    isStationary: true,
    lastDetection: null,
    detectionCount: 0,
    error: null
  });

  const mergedConfig = { ...defaultConfig, ...config };
  const subscriptionRef = useRef<any>(null);
  const motionSubscriptionRef = useRef<any>(null);
  const dataBufferRef = useRef<{ x: number; y: number; z: number; timestamp: number }[]>([]);
  const lastDetectionRef = useRef<number>(0);

  // Check if device is stationary
  useEffect(() => {
    if (!mergedConfig.enabled) return;

    const checkMotion = async () => {
      try {
        if (!Motion) return;
        const motion = await Motion.getMotionDataAsync();
        const acceleration = Math.sqrt(
          motion.acceleration.x ** 2 + 
          motion.acceleration.y ** 2 + 
          motion.acceleration.z ** 2
        );
        
        const isStationary = acceleration < mergedConfig.stationaryThreshold;
        
        setState(prev => ({ ...prev, isStationary }));
        
        // If device is moving, disable P-wave detection
        if (!isStationary && state.isListening) {
          logger.debug('P-wave: Device in motion, disabling detection');
          stopListening();
        }
      } catch (error) {
        logger.warn('P-wave: Failed to check motion:', error);
      }
    };

    const motionInterval = setInterval(checkMotion, 1000);
    checkMotion(); // Initial check

    return () => clearInterval(motionInterval);
  }, [mergedConfig.enabled, mergedConfig.stationaryThreshold, state.isListening]);

  const calculateEnergy = (buffer: { x: number; y: number; z: number }[]): number => {
    if (buffer.length === 0) return 0;
    
    let totalEnergy = 0;
    for (const sample of buffer) {
      const magnitude = Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);
      totalEnergy += magnitude ** 2;
    }
    
    return totalEnergy / buffer.length;
  };

  const calculateZeroCrossingRate = (buffer: { x: number; y: number; z: number }[]): number => {
    if (buffer.length < 2) return 0;
    
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      const prev = buffer[i - 1];
      const curr = buffer[i];
      
      // Check for zero crossings in each axis
      if ((prev.x >= 0 && curr.x < 0) || (prev.x < 0 && curr.x >= 0)) crossings++;
      if ((prev.y >= 0 && curr.y < 0) || (prev.y < 0 && curr.y >= 0)) crossings++;
      if ((prev.z >= 0 && curr.z < 0) || (prev.z < 0 && curr.z >= 0)) crossings++;
    }
    
    return crossings / (buffer.length - 1);
  };

  const analyzeData = (): boolean => {
    const buffer = dataBufferRef.current;
    if (buffer.length < mergedConfig.sampleRate * 0.5) { // Need at least 0.5 seconds of data
      return false;
    }

    // Calculate features
    const energy = calculateEnergy(buffer);
    const zeroCrossingRate = calculateZeroCrossingRate(buffer);

    // Very conservative detection criteria
    const energyExceeded = energy > mergedConfig.energyThreshold;
    const zeroCrossingExceeded = zeroCrossingRate > mergedConfig.zeroCrossingThreshold;
    
    // Both conditions must be met for detection
    const detected = energyExceeded && zeroCrossingExceeded;

    if (detected) {
      logger.debug(`P-wave: Detection - Energy: ${energy.toFixed(3)}, Zero-crossing: ${zeroCrossingRate.toFixed(3)}`);
    }

    return detected;
  };

  const startListening = async () => {
    if (state.isListening || !mergedConfig.enabled) return;

    try {
      // Check if device is stationary
      if (!state.isStationary) {
        setState(prev => ({ 
          ...prev, 
          error: 'Cihaz hareket halinde - P-dalgası algısı devre dışı' 
        }));
        return;
      }

      // Set up accelerometer
      await Accelerometer.setUpdateInterval(1000 / mergedConfig.sampleRate);
      
      subscriptionRef.current = Accelerometer.addListener((data) => {
        const timestamp = Date.now();
        
        // Add to buffer
        dataBufferRef.current.push({
          x: data.x,
          y: data.y,
          z: data.z,
          timestamp
        });

        // Keep only recent data (detection window)
        const cutoffTime = timestamp - mergedConfig.detectionWindowMs;
        dataBufferRef.current = dataBufferRef.current.filter(
          sample => sample.timestamp > cutoffTime
        );

        // Analyze for P-wave
        if (analyzeData()) {
          const now = Date.now();
          const timeSinceLastDetection = now - lastDetectionRef.current;
          
          // Check cooldown
          if (timeSinceLastDetection > mergedConfig.cooldownMs) {
            lastDetectionRef.current = now;
            
            setState(prev => ({
              ...prev,
              lastDetection: now,
              detectionCount: prev.detectionCount + 1
            }));

            // Send local notification
            notifyPWaveAlert().catch(error => {
              logger.error('P-wave: Failed to send alert:', error);
            });

            logger.debug('P-wave: Experimental alert triggered');
          } else {
            logger.debug('P-wave: Detection suppressed (cooldown)');
          }
        }
      });

      setState(prev => ({ 
        ...prev, 
        isListening: true, 
        error: null 
      }));

      logger.debug('P-wave: Started listening');

    } catch (error) {
      logger.error('P-wave: Failed to start:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'P-dalgası algısı başlatılamadı' 
      }));
    }
  };

  const stopListening = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    dataBufferRef.current = [];
    
    setState(prev => ({ 
      ...prev, 
      isListening: false 
    }));

    logger.debug('P-wave: Stopped listening');
  };

  // Auto-start/stop based on enabled state and motion
  useEffect(() => {
    if (mergedConfig.enabled && state.isStationary) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [mergedConfig.enabled, state.isStationary]);

  return {
    ...state,
    startListening,
    stopListening,
    config: mergedConfig
  };
}
