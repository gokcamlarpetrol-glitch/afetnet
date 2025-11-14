/**
 * SEISMOGRAPH VISUALIZATION - Real-time Waveform Display
 * 
 * ELITE: Professional seismograph visualization similar to ShakeAlert and JMA EEW
 * Features:
 * - Real-time waveform display
 * - P and S wave markers
 * - Amplitude visualization
 * - Time axis
 * - Professional styling
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../../theme';

const CHART_WIDTH = Dimensions.get('window').width - 32;
const CHART_HEIGHT = 200;
const SAMPLES = 200; // Number of data points
const SAMPLE_RATE = 20; // Hz (samples per second)

// ELITE: World-class features inspired by ShakeAlert, JMA EEW, and MyShake
const SMOOTHING_WINDOW = 3; // Moving average window for waveform smoothing
const PEAK_DETECTION_THRESHOLD = 0.3; // Threshold for peak detection
const ALERT_THRESHOLD = 0.5; // Alert threshold for amplitude

interface SeismographVisualizationProps {
  pWaveArrivalTime: number; // seconds
  sWaveArrivalTime: number; // seconds
  elapsed: number; // seconds since earthquake origin
  magnitude: number;
  isAnimating: boolean;
  isMonitoringActive?: boolean; // CRITICAL: Always show if monitoring is active
  realTimeData?: number[]; // CRITICAL: Real-time accelerometer data
}

export default function SeismographVisualization({
  pWaveArrivalTime,
  sWaveArrivalTime,
  elapsed,
  magnitude,
  isAnimating,
  isMonitoringActive = true, // CRITICAL: Default to active
  realTimeData,
}: SeismographVisualizationProps) {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const animationRef = useRef<Animated.Value>(new Animated.Value(0));
  
  // CRITICAL: Use refs to prevent unnecessary re-renders and interval restarts
  // ELITE: Stable references for interval management
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRealTimeDataRef = useRef<number[]>([]);
  const isUsingRealDataRef = useRef<boolean>(false);
  const realTimeDataRef = useRef<number[] | undefined>(realTimeData); // CRITICAL: Always have latest realTimeData
  const elapsedRef = useRef<number>(elapsed); // CRITICAL: Always have latest elapsed time
  const pWaveArrivalTimeRef = useRef<number>(pWaveArrivalTime); // CRITICAL: Always have latest P-wave time
  const sWaveArrivalTimeRef = useRef<number>(sWaveArrivalTime); // CRITICAL: Always have latest S-wave time
  const magnitudeRef = useRef<number>(magnitude); // CRITICAL: Always have latest magnitude
  
  // CRITICAL: Keep refs updated with latest values
  useEffect(() => {
    realTimeDataRef.current = realTimeData;
    elapsedRef.current = elapsed;
    pWaveArrivalTimeRef.current = pWaveArrivalTime;
    sWaveArrivalTimeRef.current = sWaveArrivalTime;
    magnitudeRef.current = magnitude;
  }, [realTimeData, elapsed, pWaveArrivalTime, sWaveArrivalTime, magnitude]);

  // CRITICAL: Unified waveform generation - prevents continuous restarts
  // ELITE: Single effect handles both real and simulated data intelligently
  useEffect(() => {
    // CRITICAL: Always show if monitoring is active (7/24 continuous monitoring)
    if (!isMonitoringActive && !isAnimating) {
      // Cleanup if monitoring is inactive
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // CRITICAL: Check if we have substantial real-time data (use ref for latest value)
    const currentRealTimeData = realTimeDataRef.current;
    const hasRealData = currentRealTimeData && currentRealTimeData.length > 10;
    
    // ELITE: Normalize and use real-time data with world-class processing
    // Inspired by ShakeAlert and JMA EEW data processing
    const processRealTimeData = () => {
      const latestRealData = realTimeDataRef.current; // CRITICAL: Always get latest value
      if (!latestRealData || latestRealData.length <= 10) return null;
      
      let normalizedData = latestRealData.slice(-SAMPLES).map((value) => {
        // Scale real accelerometer data (m/s²) to visualization range
        // Real data is typically in range 0-10 m/s², scale to -1 to 1 for display
        return Math.max(-1, Math.min(1, value / 5.0)); // Scale factor for visibility
      });
      
      // ELITE: Apply moving average smoothing (ShakeAlert technique)
      // Reduces noise and provides smoother visualization
      const smoothedData: number[] = [];
      for (let i = 0; i < normalizedData.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - Math.floor(SMOOTHING_WINDOW / 2)); 
             j <= Math.min(normalizedData.length - 1, i + Math.floor(SMOOTHING_WINDOW / 2)); 
             j++) {
          sum += normalizedData[j];
          count++;
        }
        smoothedData.push(sum / count);
      }
      normalizedData = smoothedData;
      
      // Ensure we have enough data points (pad with zeros if needed)
      while (normalizedData.length < SAMPLES) {
        normalizedData.unshift(0);
      }
      
      return normalizedData.slice(-SAMPLES);
    };

    // ELITE: Generate simulated waveform with realistic earthquake patterns
    const generateSimulatedWaveform = () => {
      const data: number[] = [];
      const timeWindow = 60; // seconds
      const samples = Math.floor(timeWindow * SAMPLE_RATE);
      
      // CRITICAL: Use refs to get latest values
      const currentElapsed = elapsedRef.current;
      const currentPWaveTime = pWaveArrivalTimeRef.current;
      const currentSWaveTime = sWaveArrivalTimeRef.current;
      const currentMagnitude = magnitudeRef.current;
      
      for (let i = 0; i < samples; i++) {
        const t = i / SAMPLE_RATE;
        let amplitude = 0;
        
        // ELITE: Realistic background noise (seismic background)
        amplitude += (Math.random() * 0.1 - 0.05) * 0.5;
        
        // P-wave arrival (if earthquake is happening)
        if (currentElapsed >= currentPWaveTime && currentElapsed < currentSWaveTime) {
          const pWaveTime = currentElapsed - currentPWaveTime;
          // P-wave: High frequency, low amplitude
          amplitude += Math.sin(pWaveTime * 20) * Math.exp(-pWaveTime * 0.5) * currentMagnitude * 0.3;
        }
        
        // S-wave arrival (if earthquake is happening)
        if (currentElapsed >= currentSWaveTime) {
          const sWaveTime = currentElapsed - currentSWaveTime;
          // S-wave: Lower frequency, higher amplitude
          amplitude += Math.sin(sWaveTime * 5) * Math.exp(-sWaveTime * 0.2) * currentMagnitude * 0.8;
        }
        
        data.push(amplitude);
      }
      
      return data;
    };

    // CRITICAL: Initial waveform generation
    const updateWaveform = () => {
      const realData = processRealTimeData();
      if (realData) {
        isUsingRealDataRef.current = true;
        lastRealTimeDataRef.current = realTimeDataRef.current || [];
        setWaveformData(realData);
      } else {
        isUsingRealDataRef.current = false;
        const simulatedData = generateSimulatedWaveform();
        setWaveformData(simulatedData);
      }
    };

    // CRITICAL: Initial update
    updateWaveform();

    // CRITICAL: ALWAYS set up interval for continuous waveform updates
    // LIFE-SAVING: Sismograf must NEVER stop - continuous monitoring is critical
    // ELITE: Continuous updates whether using real or simulated data
    // Cleanup previous interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // CRITICAL: Set up continuous interval for ALWAYS-ON waveform updates (50ms = 20 Hz)
    // ELITE: High-frequency updates ensure smooth, uninterrupted real-time visualization
    // CRITICAL: This interval runs CONTINUOUSLY - never stops
    intervalRef.current = setInterval(() => {
      // CRITICAL: Always update waveform - check for real data first, fallback to simulated
      // ELITE: Use ref to always get latest realTimeData value
      const currentRealData = processRealTimeData();
      if (currentRealData) {
        isUsingRealDataRef.current = true;
        lastRealTimeDataRef.current = realTimeDataRef.current || [];
        setWaveformData(currentRealData);
      } else {
        isUsingRealDataRef.current = false;
        const simulatedData = generateSimulatedWaveform();
        setWaveformData(simulatedData);
      }
    }, 50); // 50ms = 20 Hz - CRITICAL: Continuous, never-stopping updates

    // CRITICAL: Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isMonitoringActive, isAnimating, pWaveArrivalTime, sWaveArrivalTime, magnitude, elapsed]); // CRITICAL: Removed realTimeData from dependencies to prevent restarts

  // CRITICAL: Real-time data is handled by the main interval above
  // ELITE: No separate effect needed - main interval handles both real and simulated data continuously
  // This ensures sismograf NEVER stops updating

  // ELITE: Memoized calculations with world-class features
  // Inspired by ShakeAlert, JMA EEW, and MyShake visualization techniques
  const { pWaveX, sWaveX, currentX, waveformPoints, peaks, maxAmplitude } = useMemo(() => {
    const pX = (pWaveArrivalTime / 60) * CHART_WIDTH;
    const sX = (sWaveArrivalTime / 60) * CHART_WIDTH;
    const currX = (elapsed / 60) * CHART_WIDTH;
    
    // ELITE: Peak detection (MyShake technique)
    // Identify significant peaks in the waveform
    const detectedPeaks: Array<{ x: number; y: number; amplitude: number }> = [];
    let maxAmp = 0;
    
    // ELITE: Pre-calculate waveform points with advanced features
    const points = waveformData.map((amplitude, index) => {
      const x = (index / waveformData.length) * CHART_WIDTH;
      const absAmplitude = Math.abs(amplitude);
      maxAmp = Math.max(maxAmp, absAmplitude);
      
      // ELITE: Dynamic amplitude scaling for better visibility
      // Scale based on maximum amplitude in the window
      const scaleFactor = maxAmp > 0 ? Math.min(1, 0.5 / maxAmp) : 1;
      const scaledAmplitude = amplitude * scaleFactor;
      const y = CHART_HEIGHT / 2 + scaledAmplitude * (CHART_HEIGHT / 3);
      const isActive = isMonitoringActive || (isAnimating && x <= currX);
      
      // ELITE: Peak detection - identify significant peaks
      if (absAmplitude > PEAK_DETECTION_THRESHOLD && index > 0 && index < waveformData.length - 1) {
        const prevAmp = Math.abs(waveformData[index - 1]);
        const nextAmp = Math.abs(waveformData[index + 1]);
        if (absAmplitude > prevAmp && absAmplitude > nextAmp) {
          detectedPeaks.push({ x, y, amplitude: absAmplitude });
        }
      }
      
      // ELITE: Advanced color coding based on wave type, amplitude, and monitoring status
      // Inspired by ShakeAlert and JMA EEW color schemes
      let pointColor = '#64748b'; // Default: background noise
      if (isActive) {
        if (elapsed >= sWaveArrivalTime && x >= sX) {
          // S-wave: Red gradient based on amplitude
          if (absAmplitude > ALERT_THRESHOLD) {
            pointColor = '#dc2626'; // High amplitude S-wave (critical)
          } else {
            pointColor = '#ef4444'; // S-wave: Red (dangerous)
          }
        } else if (elapsed >= pWaveArrivalTime && x >= pX) {
          // P-wave: Blue gradient based on amplitude
          if (absAmplitude > ALERT_THRESHOLD * 0.7) {
            pointColor = '#2563eb'; // High amplitude P-wave (warning)
          } else {
            pointColor = '#3b82f6'; // P-wave: Blue (warning)
          }
        } else if (isMonitoringActive) {
          // Active monitoring: Green gradient
          if (absAmplitude > ALERT_THRESHOLD * 0.5) {
            pointColor = '#059669'; // High amplitude background (attention)
          } else {
            pointColor = '#10b981'; // Active monitoring: Green (live data)
          }
        }
      }
      
      return {
        x,
        y,
        color: pointColor,
        isActive,
        index,
        amplitude: absAmplitude,
      };
    });
    
    return {
      pWaveX: pX,
      sWaveX: sX,
      currentX: currX,
      waveformPoints: points,
      peaks: detectedPeaks,
      maxAmplitude: maxAmp,
    };
  }, [waveformData, pWaveArrivalTime, sWaveArrivalTime, elapsed, isMonitoringActive, isAnimating]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sismograf</Text>
        <Text style={styles.subtitle}>Gerçek Zamanlı Dalga Formu</Text>
      </View>
      
      <View style={styles.chartContainer}>
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={styles.chartBackground}
        >
          {/* Grid lines */}
          <View style={styles.gridContainer}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <View
                key={`grid-${ratio}`}
                style={[
                  styles.gridLine,
                  { top: `${ratio * 100}%` },
                ]}
              />
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <View
                key={`grid-v-${ratio}`}
                style={[
                  styles.gridLineVertical,
                  { left: `${ratio * 100}%` },
                ]}
              />
            ))}
          </View>

          {/* ELITE: Real-time Waveform - Continuous monitoring */}
          {/* CRITICAL: Always show waveform if monitoring is active */}
          {waveformPoints.length > 0 && (
            <View style={styles.waveformContainer}>
              {/* ELITE: Optimized rendering with memoized points for better performance */}
              {waveformPoints.map((point) => (
                <View
                  key={`waveform-${point.index}`}
                  style={[
                    styles.waveformPoint,
                    {
                      left: point.x,
                      top: point.y,
                      opacity: point.isActive ? 1 : 0.2,
                      backgroundColor: point.color,
                      // ELITE: Dynamic point size based on amplitude
                      width: point.isActive 
                        ? Math.max(2, Math.min(4, 2 + point.amplitude * 2)) 
                        : 1.5,
                      height: point.isActive 
                        ? Math.max(2, Math.min(4, 2 + point.amplitude * 2)) 
                        : 1.5,
                      borderRadius: point.isActive 
                        ? Math.max(1, Math.min(2, 1 + point.amplitude)) 
                        : 0.75,
                      // ELITE: Glow effect for high amplitude points
                      shadowColor: point.amplitude > ALERT_THRESHOLD ? point.color : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: point.amplitude > ALERT_THRESHOLD ? 0.8 : 0,
                      shadowRadius: point.amplitude > ALERT_THRESHOLD ? 4 : 0,
                      elevation: point.amplitude > ALERT_THRESHOLD ? 4 : 0,
                    },
                  ]}
                />
              ))}
              
              {/* ELITE: Peak markers (MyShake feature) */}
              {peaks.map((peak, index) => (
                <View
                  key={`peak-${index}`}
                  style={[
                    styles.peakMarker,
                    {
                      left: peak.x - 3,
                      top: peak.y - 3,
                    },
                  ]}
                />
              ))}
            </View>
          )}
          
          {/* ELITE: Amplitude scale indicator (ShakeAlert feature) */}
          {maxAmplitude > 0 && (
            <View style={styles.amplitudeScale}>
              <Text style={styles.amplitudeScaleText}>
                Max: {(maxAmplitude * 5.0).toFixed(2)} m/s²
              </Text>
            </View>
          )}
          
          {/* ELITE: Show "Canlı Veri" indicator when real-time data is active */}
          {realTimeData && realTimeData.length > 0 && isMonitoringActive && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Canlı Veri</Text>
            </View>
          )}

          {/* P-wave marker */}
          {elapsed >= pWaveArrivalTime && (
            <View style={[styles.marker, styles.pWaveMarker, { left: pWaveX }]}>
              <View style={styles.markerLine} />
              <View style={styles.markerLabel}>
                <Text style={styles.markerText}>P</Text>
              </View>
            </View>
          )}

          {/* S-wave marker */}
          {elapsed >= sWaveArrivalTime && (
            <View style={[styles.marker, styles.sWaveMarker, { left: sWaveX }]}>
              <View style={styles.markerLine} />
              <View style={styles.markerLabel}>
                <Text style={styles.markerText}>S</Text>
              </View>
            </View>
          )}

          {/* Current time indicator */}
          <View style={[styles.currentIndicator, { left: currentX }]}>
            <View style={styles.currentLine} />
          </View>

          {/* Time labels */}
          <View style={styles.timeLabels}>
            {[0, 15, 30, 45, 60].map((seconds) => (
              <Text key={seconds} style={styles.timeLabel}>
                {seconds}s
              </Text>
            ))}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  chartContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  chartBackground: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  gridContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gridLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  waveformContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  waveformPoint: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  marker: {
    position: 'absolute',
    width: 2,
    height: '100%',
    top: 0,
  },
  pWaveMarker: {
    backgroundColor: '#3b82f6',
  },
  sWaveMarker: {
    backgroundColor: '#ef4444',
  },
  markerLine: {
    width: '100%',
    height: '100%',
    backgroundColor: 'currentColor',
  },
  markerLabel: {
    position: 'absolute',
    top: 8,
    left: -8,
    backgroundColor: 'currentColor',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  markerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  currentIndicator: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#10b981',
    top: 0,
  },
  currentLine: {
    width: '100%',
    height: '100%',
    backgroundColor: '#10b981',
  },
  timeLabels: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  timeLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
  },
  // ELITE: Live data indicator
  liveIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  liveText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ELITE: Peak marker (MyShake feature)
  peakMarker: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fff',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 3,
  },
  // ELITE: Amplitude scale indicator (ShakeAlert feature)
  amplitudeScale: {
    position: 'absolute',
    bottom: 24,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  amplitudeScaleText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 9,
    fontWeight: '600',
  },
});




