import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/productionLogger';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { bleRelay } from '../services/ble/bleRelay';
import { useQueue } from '../store/queue';
import { usePDRFuse } from './usePDRFuse';
import { useSettings } from '../store/settings';

export interface TapDetectionConfig {
  enabled: boolean;
  threshold: number; // Acceleration threshold
  windowMs: number; // Time window for tap sequence
  requiredTaps: number; // Number of taps to trigger SOS
}

export function useTapDetect() {
  const settings = useSettings();
  
  const config: TapDetectionConfig = {
    enabled: settings.tapDetectionEnabled,
    threshold: settings.tapThreshold,
    windowMs: settings.tapWindowMs,
    requiredTaps: settings.tapRequiredTaps
  };
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const tapTimes = useRef<number[]>([]);
  const { currentPos } = usePDRFuse();
  const queue = useQueue();

  useEffect(() => {
    if (!config.enabled) {
      setIsListening(false);
      return;
    }

    let subscription: any = null;

    const startListening = async () => {
      try {
        // Try microphone-based detection first if available
        if (await tryMicrophoneDetection()) {
          logger.debug('Using microphone for tap detection');
          setIsListening(true);
          return;
        }
        
        // Fallback to accelerometer
        logger.debug('Using accelerometer for tap detection');
        Accelerometer.setUpdateInterval(100); // 10Hz
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          
          if (magnitude > config.threshold) {
            const now = Date.now();
            
            // Check if this is a new tap (not too close to previous)
            if (now - lastTapTime > 200) {
              handleTap(now);
            }
          }
        });
        
        setIsListening(true);
      } catch (error) {
        logger.error('Failed to start tap detection:', error);
      }
    };

    startListening();

    return () => {
      if (subscription) {
        subscription.remove();
      }
      setIsListening(false);
    };
  }, [config.enabled, config.threshold, lastTapTime]);

  const handleTap = (timestamp: number) => {
    setLastTapTime(timestamp);
    
    // Add to tap history
    tapTimes.current.push(timestamp);
    
    // Remove taps outside the time window
    const cutoff = timestamp - config.windowMs;
    tapTimes.current = tapTimes.current.filter(t => t > cutoff);
    
    const currentTapCount = tapTimes.current.length;
    setTapCount(currentTapCount);
    
    // Check if we have enough taps
    if (currentTapCount >= config.requiredTaps) {
      triggerTapSOS();
      tapTimes.current = []; // Reset
      setTapCount(0);
    }
  };

  const triggerTapSOS = async () => {
    try {
      logger.debug('Tap SOS triggered!');
      
      const message = {
        type: 'sos' as const,
        payload: {
          message: 'TAP SOS',
          timestamp: Date.now(),
          source: 'tap_detection',
          position: currentPos ? {
            lat: currentPos.lat,
            lon: currentPos.lon,
            accuracy: currentPos.accuracy
          } : null
        }
      };
      
      queue.add(message);
      await queue.flush();
      
      logger.debug('Tap SOS sent via queue');
    } catch (error) {
      logger.error('Failed to send tap SOS:', error);
    }
  };

  const resetTapCount = () => {
    tapTimes.current = [];
    setTapCount(0);
  };

  return {
    tapCount,
    isListening,
    remainingTaps: Math.max(0, config.requiredTaps - tapCount),
    resetTapCount,
    config
  };
}

async function tryMicrophoneDetection(): Promise<boolean> {
  try {
    // Request microphone permission
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      logger.debug('Microphone permission denied');
      return false;
    }

    // Set up audio recording for tap detection
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    // Note: In a real implementation, you would:
    // 1. Create a recording instance
    // 2. Start recording with very low sample rate
    // 3. Process audio data in real-time to detect tap patterns
    // 4. This is complex and requires native audio processing
    
    logger.debug('Microphone tap detection would be implemented here');
    return false; // Disabled for now, use accelerometer instead
    
  } catch (error) {
    logger.warn('Microphone tap detection failed:', error);
    return false;
  }
}
