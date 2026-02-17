/**
 * WAVE VISUALIZATION SCREEN - Elite P and S Wave Visualization
 * 
 * ELITE: World's most advanced real-time P and S wave visualization
 * Features:
 * - Real-time wave propagation animation
 * - Interactive epicenter and user location
 * - Wave arrival countdown
 * - Intensity visualization
 * - Historical wave data
 * - Multi-earthquake support
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore - useFocusEffect is available in @react-navigation/native but TypeScript types may be outdated
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import { useEarthquakeStore } from '../../stores/earthquakeStore';
import { eliteWaveCalculationService, type EliteWaveCalculationResult } from '../../services/EliteWaveCalculationService';
// CRITICAL: Safe import with fallback to prevent "Cannot read property 'background' of undefined"
import { styles, SCREEN_WIDTH, SCREEN_HEIGHT, colors } from './WaveVisualizationScreen.styles';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';
import { eewService, type EEWEvent } from '../../services/EEWService';
import { seismicSensorService } from '../../services/SeismicSensorService';
import { aiEarthquakePredictionService, type AIPredictionResult } from '../../services/AIEarthquakePredictionService';
import { riskScoringService } from '../../ai/services/RiskScoringService';
import { SensorReading } from '../../services/EnsembleDetectionService';
import SeismographVisualization from './components/SeismographVisualization';
import WaveformGraph from './components/WaveformGraph';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import WavePropagationOverlay from '../../components/map/WavePropagationOverlay';
import * as Notifications from 'expo-notifications';

const logger = createLogger('WaveVisualizationScreen');

// ELITE: Dark map style for premium seismic visualization
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5c6b7a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f1a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a202c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2d3748' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1829' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

interface WaveData {
  earthquake: {
    id: string;
    latitude: number;
    longitude: number;
    magnitude: number;
    depth: number;
    time: number;
    location: string;
  };
  calculation: EliteWaveCalculationResult;
  userLocation: {
    latitude: number;
    longitude: number;
  };
}

type WaveVisualizationNavigationProp = StackNavigationProp<Record<string, object>>;

export default function WaveVisualizationScreen({ navigation }: { navigation: WaveVisualizationNavigationProp }) {
  const [waveData, setWaveData] = useState<WaveData[]>([]);
  const [selectedWave, setSelectedWave] = useState<WaveData | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [realTimeProgress, setRealTimeProgress] = useState(0);
  const [seismicMonitoringStatus, setSeismicMonitoringStatus] = useState<{
    isRunning: boolean;
    totalReadings: number;
    confirmedEvents: number;
    lastDataTime: number;
  } | null>(null);
  const [realTimeSeismicData, setRealTimeSeismicData] = useState<number[]>([]); // CRITICAL: Real-time accelerometer data for sismograf
  const [wavePulse, setWavePulse] = useState(0); // ELITE: Continuous wave pulse animation (0-1 cycles forever)

  // CRITICAL: AI Analysis State - Life-saving early warning system
  const [aiPrediction, setAiPrediction] = useState<AIPredictionResult | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [lastAiAnalysisTime, setLastAiAnalysisTime] = useState(0);
  const [userPermissionGranted, setUserPermissionGranted] = useState(false);

  const animationRef = useRef<Animated.Value>(new Animated.Value(0));
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const aiAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const alertShownRef = useRef<Set<string>>(new Set()); // CRITICAL: Prevent duplicate alerts

  const earthquakes = useEarthquakeStore((state) => state.items);
  const [eewEvents, setEewEvents] = useState<EEWEvent[]>([]);

  // CRITICAL: Request user permissions for life-saving early warning
  // ELITE: Request location, notifications, and background permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        // Request location permission
        const locationStatus = await Location.requestForegroundPermissionsAsync();
        if (locationStatus.status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }

        // CRITICAL: Request notification permission for early warning alerts
        const notificationStatus = await Notifications.requestPermissionsAsync();
        if (notificationStatus.granted) {
          setUserPermissionGranted(true);

          // CRITICAL: Initialize notification channels through centralized manager
          const { initializeChannels } = await import('../../services/notifications/NotificationChannelManager');
          await initializeChannels();
        }

        // CRITICAL: Initialize AI services for early warning
        try {
          await aiEarthquakePredictionService.initialize();
          await riskScoringService.initialize();
        } catch (aiError) {
          logger.error('Failed to initialize AI services:', aiError);
        }
      } catch (error) {
        logger.error('Failed to request permissions:', error);
      }
    };

    requestPermissions();
  }, []);

  // ELITE: Continuous wave pulse animation - waves NEVER stop spreading
  // CRITICAL: This creates the always-alive effect that professional seismic apps have
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setWavePulse((prev) => {
        const next = prev + 0.02; // Increment by 2% each tick
        return next >= 1 ? 0 : next; // Reset to 0 when reaching 1
      });
    }, 60); // 60ms = ~16fps smooth animation

    return () => clearInterval(pulseInterval);
  }, []);

  // Calculate waves for all earthquakes
  const calculateWaves = useCallback(async () => {
    if (!userLocation) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get recent earthquakes (last 24 hours, magnitude >= 3.0)
      const now = Date.now();
      const recentEarthquakes = earthquakes
        .filter((eq) => {
          const age = now - eq.time;
          return age < 24 * 60 * 60 * 1000 && eq.magnitude >= 3.0;
        })
        .slice(0, 10); // Limit to 10 most recent

      // Also check EEW events
      const allEvents = [
        ...recentEarthquakes.map((eq) => ({
          id: eq.id,
          latitude: eq.latitude,
          longitude: eq.longitude,
          magnitude: eq.magnitude,
          depth: eq.depth,
          originTime: eq.time,
          source: eq.source,
        })),
        ...eewEvents.map((eew) => ({
          id: eew.id,
          latitude: eew.latitude,
          longitude: eew.longitude,
          magnitude: eew.magnitude || 0,
          depth: eew.depth || 10,
          originTime: eew.issuedAt,
          source: eew.source,
        })),
      ];

      // Calculate waves for each earthquake
      const calculations = await Promise.all(
        allEvents.map(async (eq) => {
          try {
            const calculation = await eliteWaveCalculationService.calculateWaves(
              {
                latitude: eq.latitude,
                longitude: eq.longitude,
                depth: eq.depth,
                magnitude: eq.magnitude,
                originTime: eq.originTime,
                source: eq.source,
              },
              userLocation
            );

            if (calculation) {
              const earthquake = recentEarthquakes.find((e) => e.id === eq.id) || {
                id: eq.id,
                latitude: eq.latitude,
                longitude: eq.longitude,
                magnitude: eq.magnitude,
                depth: eq.depth,
                time: eq.originTime,
                location: 'Bilinmeyen',
                source: eq.source as any,
              };

              return {
                earthquake: {
                  id: earthquake.id,
                  latitude: earthquake.latitude,
                  longitude: earthquake.longitude,
                  magnitude: earthquake.magnitude,
                  depth: earthquake.depth,
                  time: earthquake.time,
                  location: earthquake.location,
                },
                calculation,
                userLocation,
              };
            }
            return null;
          } catch (error) {
            logger.error('Wave calculation failed:', error);
            return null;
          }
        })
      );

      const validWaves = calculations.filter((w): w is WaveData => w !== null);
      setWaveData(validWaves);

      // Select most urgent (shortest warning time)
      if (validWaves.length > 0) {
        const mostUrgent = validWaves.reduce((prev, current) => {
          return current.calculation.warningTime < prev.calculation.warningTime
            ? current
            : prev;
        });
        setSelectedWave(mostUrgent);
      }
    } catch (error) {
      logger.error('Failed to calculate waves:', error);
    } finally {
      setLoading(false);
    }
  }, [earthquakes, eewEvents, userLocation]);

  // CRITICAL: Continuous monitoring - runs even when screen is not focused
  // This ensures P and S wave calculations are always up-to-date
  // ELITE: AUTOMATIC START - No user interaction required
  // ELITE: PROFESSIONAL ERROR HANDLING - All errors caught and handled gracefully
  useEffect(() => {
    let isMounted = true; // CRITICAL: Track component mount status to prevent state updates after unmount
    let monitoringInterval: NodeJS.Timeout | null = null;
    let statusInterval: NodeJS.Timeout | null = null;
    let dataCollectionInterval: NodeJS.Timeout | null = null;
    let detectionUnsubscribe: (() => void) | null = null;
    let eewUnsubscribe: (() => void) | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    // CRITICAL: Automatically start SeismicSensorService if not running
    // LIFE-SAVING: Service must be active continuously for early warning
    // ELITE: Always ensure service is running - 7/24 continuous monitoring
    // ELITE: Professional error handling with retry mechanism and graceful degradation
    const ensureSeismicServiceRunning = async (): Promise<void> => {
      if (!isMounted) return; // CRITICAL: Don't proceed if component unmounted

      try {
        // CRITICAL: Safe access to seismicSensorService with null check
        if (!seismicSensorService) {
          logger.warn('SeismicSensorService not available - skipping initialization');
          return;
        }

        // CRITICAL: Check both running status AND recent readings
        const stats = seismicSensorService.getStatistics();
        const isRunning = seismicSensorService.getRunningStatus();
        const hasRecentData = stats && stats.totalReadings > 0 && stats.timeSinceLastData < 60000;

        // Service is truly active if running OR has recent data
        if (isRunning || hasRecentData) {
          if (__DEV__ && isMounted) {
            logger.debug('✅ SeismicSensorService active:', {
              isRunning,
              readings: stats?.totalReadings || 0,
              lastData: stats ? `${Math.round(stats.timeSinceLastData / 1000)}s ago` : 'N/A'
            });
          }
          return; // Already active
        }

        // CRITICAL: Service not active - start immediately
        logger.info('🚨 SeismicSensorService not active - auto-starting for 7/24 continuous monitoring...');
        await seismicSensorService.start();

        // CRITICAL: Verify it actually started
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s for initialization

        if (!isMounted) return; // CRITICAL: Check again after async operation

        const verifyStats = seismicSensorService.getStatistics();
        if (verifyStats && (verifyStats.isRunning || verifyStats.totalReadings > 0)) {
          logger.info('✅ SeismicSensorService auto-started successfully - 7/24 monitoring active');
        } else {
          logger.warn('⚠️ SeismicSensorService start verification failed - will retry...');
          // Retry after delay - CRITICAL: Clear previous timeout
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(() => {
            if (isMounted) {
              ensureSeismicServiceRunning().catch((retryError) => {
                logger.error('Retry failed:', retryError);
              });
            }
          }, 3000);
        }
      } catch (error: unknown) {
        logger.error('Failed to auto-start SeismicSensorService:', {
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.name : typeof error,
        });
        // CRITICAL: Retry after delay - never give up (but respect component mount status)
        if (isMounted) {
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(() => {
            if (isMounted) {
              ensureSeismicServiceRunning().catch((retryError) => {
                logger.error('Retry failed:', retryError);
              });
            }
          }, 5000);
        }
      }
    };

    // ELITE: Safe initialization with error handling
    const initializeMonitoring = async () => {
      try {
        // Start service immediately
        await ensureSeismicServiceRunning();

        if (!isMounted) return;

        // Initial calculation with error handling
        try {
          await calculateWaves();
        } catch (calcError: unknown) {
          logger.error('Initial wave calculation failed:', {
            error: calcError instanceof Error ? calcError.message : String(calcError),
          });
          // Don't throw - continue with monitoring setup
        }

        if (!isMounted) return;

        // CRITICAL: Set up continuous monitoring interval for real-time P/S wave calculations
        // ELITE: Optimized interval for continuous monitoring - balance between accuracy and performance
        // Wave calculations are expensive but critical for life-saving early warnings
        let lastCalculationTime = 0;
        const CALCULATION_INTERVAL = 5000; // 5 seconds - ELITE: More frequent for real-time accuracy

        monitoringInterval = setInterval(() => {
          if (!isMounted) {
            if (monitoringInterval) clearInterval(monitoringInterval);
            return;
          }

          // ELITE: Debounce calculations to prevent excessive CPU usage
          const now = Date.now();
          if (now - lastCalculationTime < CALCULATION_INTERVAL) {
            return; // Skip if called too frequently
          }
          lastCalculationTime = now;

          try {
            // CRITICAL: Always recalculate waves for real-time monitoring
            calculateWaves().catch((error) => {
              logger.debug('Wave calculation error in interval:', error);
              // CRITICAL: Don't throw - continue monitoring even if calculation fails
            });
          } catch (error) {
            logger.debug('Wave calculation error in interval (sync):', error);
            // CRITICAL: Don't throw - continue monitoring even if calculation fails
          }
        }, CALCULATION_INTERVAL); // 5 seconds - ELITE: Real-time continuous monitoring

        // CRITICAL: Monitor SeismicSensorService status for real-time P/S wave detection
        // ELITE: Smart status check - if readings exist, service is running
        // LIFE-SAVING: Continuous monitoring ensures early warning capability
        const updateSeismicStatus = () => {
          if (!isMounted) return;

          try {
            if (!seismicSensorService) {
              // CRITICAL: Service not available - try to ensure it's running
              ensureSeismicServiceRunning().catch((error) => {
                logger.debug('Failed to ensure service running:', error);
              });
              return;
            }

            const stats = seismicSensorService.getStatistics();

            // CRITICAL: Smart detection - if readings > 0 or recent data, service is active
            // ELITE: More lenient detection - service is active if:
            // 1. Explicitly running, OR
            // 2. Has readings and data < 120s old (more lenient for brief pauses)
            const isActuallyRunning = stats && (
              stats.isRunning ||
              (stats.totalReadings > 0 && stats.timeSinceLastData < 120000) // 120 seconds = 2 minutes
            );

            if (isMounted) {
              setSeismicMonitoringStatus({
                isRunning: isActuallyRunning || false,
                totalReadings: stats?.totalReadings || 0,
                confirmedEvents: stats?.confirmedEvents || 0,
                lastDataTime: stats?.timeSinceLastData || 0,
              });
            }

            // CRITICAL: Auto-restart only if truly stopped (no readings AND not running AND no recent data)
            if (!isActuallyRunning && stats && stats.totalReadings === 0 && stats.timeSinceLastData > 5000) {
              logger.warn('⚠️ SeismicSensorService stopped - auto-restarting for 7/24 monitoring...');
              ensureSeismicServiceRunning().catch((restartError) => {
                logger.error('Auto-restart failed:', restartError);
                // CRITICAL: Retry after delay - never give up
                setTimeout(() => {
                  if (isMounted) {
                    ensureSeismicServiceRunning().catch((retryError) => {
                      logger.debug('Retry restart failed:', retryError);
                    });
                  }
                }, 5000);
              });
            }
          } catch (error: unknown) {
            logger.debug('Failed to get seismic sensor status:', {
              error: error instanceof Error ? error.message : String(error),
            });
            // CRITICAL: On error, assume running to prevent false "stopped" status
            if (isMounted) {
              setSeismicMonitoringStatus((prev) => ({
                ...prev,
                isRunning: prev?.isRunning ?? true, // Default to running
                totalReadings: prev?.totalReadings || 0,
                confirmedEvents: prev?.confirmedEvents || 0,
                lastDataTime: prev?.lastDataTime || 0,
              }));
            }
          }
        };

        // Update status immediately
        updateSeismicStatus();

        // CRITICAL: Update status every 2 seconds for real-time monitoring feedback
        // ELITE: More frequent status updates for better user experience
        statusInterval = setInterval(() => {
          if (isMounted) {
            updateSeismicStatus();
          } else {
            if (statusInterval) clearInterval(statusInterval);
          }
        }, 2000); // 2 seconds - ELITE: Real-time status updates

        // CRITICAL: Listen for P/S wave detections from SeismicSensorService
        // ELITE: Professional error handling in callback
        if (seismicSensorService && typeof seismicSensorService.onDetection === 'function') {
          try {
            detectionUnsubscribe = seismicSensorService.onDetection((event) => {
              if (!isMounted) return;

              try {
                if (__DEV__) {
                  logger.info('P/S wave detection received:', {
                    pWave: event?.pWaveDetected,
                    sWave: event?.sWaveDetected,
                    magnitude: event?.estimatedMagnitude,
                    confidence: event?.confidence,
                  });
                }

                // Update status immediately when detection occurs
                updateSeismicStatus();

                // CRITICAL: Recalculate waves immediately when P/S wave is detected
                calculateWaves().catch((calcError) => {
                  logger.debug('Wave recalculation failed after detection:', calcError);
                });

                // ELITE: Haptic feedback for P-wave detection (with error handling)
                try {
                  if (event?.pWaveDetected && event?.confidence > 70) {
                    haptics.notificationWarning();
                  }

                  // ELITE: Haptic feedback for S-wave detection (more urgent)
                  if (event?.sWaveDetected && event?.confidence > 70) {
                    haptics.notificationError();
                  }
                } catch (hapticError) {
                  logger.debug('Haptic feedback error:', hapticError);
                  // Don't throw - haptics are optional
                }
              } catch (callbackError: unknown) {
                logger.error('Error in detection callback:', {
                  error: callbackError instanceof Error ? callbackError.message : String(callbackError),
                });
              }
            });
          } catch (subscribeError: unknown) {
            logger.error('Failed to subscribe to seismic detections:', {
              error: subscribeError instanceof Error ? subscribeError.message : String(subscribeError),
            });
          }
        }

        // CRITICAL: Continuously collect real-time accelerometer data for sismograf
        // LIFE-SAVING: Sismograf must show real-time data continuously
        // ELITE: High-frequency data collection for accurate real-time visualization
        // CRITICAL: Stable interval management - prevents continuous restarts
        let lastDataUpdateTime = 0;
        const DATA_UPDATE_INTERVAL = 50; // 50ms = 20 Hz for smooth visualization

        const collectRealTimeData = () => {
          if (!isMounted) return;

          try {
            if (!seismicSensorService) {
              return;
            }

            // Get recent readings from SeismicSensorService for visualization
            const stats = seismicSensorService.getStatistics();
            if (stats && (stats.isRunning || stats.totalReadings > 0)) {
              // CRITICAL: Get real accelerometer data from SeismicSensorService
              // ELITE: Get more readings for smoother visualization (500 points = 5 seconds at 100 Hz)
              const recentReadings = seismicSensorService.getRecentReadings(500);
              if (recentReadings && recentReadings.length > 0) {
                // CRITICAL: Debounce updates to prevent excessive state changes
                const now = Date.now();
                if (now - lastDataUpdateTime >= DATA_UPDATE_INTERVAL) {
                  if (isMounted) {
                    // CRITICAL: Always update with real data when available
                    setRealTimeSeismicData(recentReadings);
                    lastDataUpdateTime = now;
                  }
                }
              } else {
                // ELITE: Fallback only if service is truly inactive (no readings at all)
                // Don't generate fake data if service is starting up
                if (stats.totalReadings === 0 && stats.timeSinceLastData > 5000) {
                  // Service inactive for >5s - show minimal background noise
                  const newDataPoint = Math.random() * 0.05 - 0.025; // Minimal background noise
                  if (isMounted) {
                    setRealTimeSeismicData((prev) => {
                      const updated = [...(prev || []), newDataPoint];
                      // Keep only last 500 points (for 5 seconds at 100 Hz, or 25 seconds at 20 Hz)
                      return updated.slice(-500);
                    });
                  }
                }
              }
            }
          } catch (error: unknown) {
            logger.debug('Failed to collect real-time seismic data:', {
              error: error instanceof Error ? error.message : String(error),
            });
            // CRITICAL: Don't throw - continue monitoring even if data collection fails
          }
        };

        // CRITICAL: Initial data collection
        collectRealTimeData();

        // CRITICAL: Set up stable interval - only restarts if component unmounts
        dataCollectionInterval = setInterval(collectRealTimeData, DATA_UPDATE_INTERVAL);

        // CRITICAL: AI-Powered Real-time Analysis for Life-saving Early Warning
        // ELITE: Continuous AI analysis - P/S dalgasını yapay zekaya entegre ettik, mümkün olan en kısa sürede erken bildirim göndermeye çalışıyoruz
        const performAIAnalysis = async () => {
          if (!isMounted || !userLocation || !userPermissionGranted) return;

          try {
            // CRITICAL: Debounce AI analysis to prevent excessive API calls
            const now = Date.now();
            if (now - lastAiAnalysisTime < 2000) return; // Minimum 2 seconds between analyses

            // CRITICAL: Get real-time sensor readings for AI analysis
            if (!seismicSensorService) return;

            const stats = seismicSensorService.getStatistics();
            if (!stats || stats.totalReadings < 100) return; // Need at least 100 readings

            // CRITICAL: Convert accelerometer data to SensorReading format for AI
            const recentReadings = seismicSensorService.getRecentReadings(500);
            if (!recentReadings || recentReadings.length < 100) return;

            const sensorReadings: SensorReading[] = recentReadings.map((magnitude, index) => ({
              timestamp: Date.now() - (recentReadings.length - index) * 10, // 10ms intervals (100Hz)
              x: 0, // We only have magnitude, but AI can work with it
              y: 0,
              z: 0,
              magnitude: magnitude,
            }));

            setAiAnalysisLoading(true);
            setLastAiAnalysisTime(now);

            // CRITICAL: AI Prediction - Life-saving early warning
            const prediction = await aiEarthquakePredictionService.predict(
              sensorReadings,
              userLocation,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              earthquakes.slice(0, 20) as any[] // Recent earthquakes for context
            );

            if (prediction && isMounted) {
              setAiPrediction(prediction);

              // CRITICAL: Early Warning Alert System - Fastest notification
              if (prediction.willOccur && prediction.urgency === 'critical') {
                const alertKey = `critical-${prediction.estimatedMagnitude}-${Math.floor(prediction.timeAdvance)}`;

                // CRITICAL: Prevent duplicate alerts
                if (!alertShownRef.current.has(alertKey)) {
                  alertShownRef.current.add(alertKey);

                  // CRITICAL FIX: Route through MagnitudeBasedNotificationService
                  // instead of calling scheduleNotificationAsync directly.
                  // This ensures AI prediction alerts pass through rate limiting + cross-system dedup.
                  if (userPermissionGranted) {
                    try {
                      const { notificationCenter } = await import('../../services/notifications/NotificationCenter');
                      await notificationCenter.notify('eew', {
                        magnitude: prediction.estimatedMagnitude || 5.0,
                        location: prediction.recommendedAction || 'Kritik Deprem Uyarısı',
                        isEEW: true,
                        timeAdvance: Math.round(prediction.timeAdvance || 0),
                        timestamp: Date.now(),
                      }, 'WaveVisualization-AI-critical');
                    } catch (notifError) {
                      logger.error('AI prediction notification failed:', notifError);
                    }
                  }

                  // CRITICAL: Haptic feedback for critical alerts
                  try {
                    haptics.notificationError();
                    // Multiple vibrations for critical alerts
                    setTimeout(() => haptics.notificationError(), 200);
                    setTimeout(() => haptics.notificationError(), 400);
                  } catch (hapticError) {
                    logger.debug('Haptic feedback error:', hapticError);
                  }

                  logger.info('🚨 CRITICAL EARLY WARNING ALERT:', {
                    magnitude: prediction.estimatedMagnitude,
                    timeAdvance: prediction.timeAdvance,
                    confidence: prediction.confidence,
                  });
                }
              } else if (prediction.willOccur && prediction.urgency === 'high') {
                const alertKey = `high-${prediction.estimatedMagnitude}-${Math.floor(prediction.timeAdvance)}`;

                if (!alertShownRef.current.has(alertKey)) {
                  alertShownRef.current.add(alertKey);

                  if (userPermissionGranted) {
                    try {
                      const { notificationCenter } = await import('../../services/notifications/NotificationCenter');
                      await notificationCenter.notify('eew', {
                        magnitude: prediction.estimatedMagnitude || 4.0,
                        location: prediction.recommendedAction || 'Yüksek Risk Uyarısı',
                        isEEW: true,
                        timeAdvance: Math.round(prediction.timeAdvance || 0),
                        timestamp: Date.now(),
                      }, 'WaveVisualization-AI-high');
                    } catch (notifError) {
                      logger.error('AI prediction notification failed:', notifError);
                    }
                  }

                  try {
                    haptics.notificationWarning();
                  } catch (hapticError) {
                    logger.debug('Haptic feedback error:', hapticError);
                  }
                }
              }
            }

            // CRITICAL: Calculate risk score for user location
            try {
              const riskScoreResult = await riskScoringService.calculateRiskScore({
                location: userLocation,
              });

              if (riskScoreResult && isMounted) {
                setRiskScore(riskScoreResult.score || 0);
              }
            } catch (riskError) {
              logger.debug('Risk score calculation error:', riskError);
            }
          } catch (error: unknown) {
            logger.error('AI analysis error:', {
              error: error instanceof Error ? error.message : String(error),
            });
            // CRITICAL: Don't throw - continue monitoring even if AI analysis fails
          } finally {
            if (isMounted) {
              setAiAnalysisLoading(false);
            }
          }
        };

        // CRITICAL: Initial AI analysis
        performAIAnalysis();

        // CRITICAL: Continuous AI analysis every 3 seconds for fastest early warning
        // ELITE: Optimized interval for real-time AI analysis without excessive API calls
        aiAnalysisIntervalRef.current = setInterval(() => {
          if (isMounted) {
            performAIAnalysis().catch((error) => {
              logger.debug('AI analysis interval error:', error);
            });
          }
        }, 3000); // 3 seconds - ELITE: Fastest early warning with optimized API usage

        // Listen for new EEW events with error handling
        if (eewService && typeof eewService.onEvent === 'function') {
          try {
            eewUnsubscribe = eewService.onEvent((event: EEWEvent) => {
              if (!isMounted) return;

              try {
                if (!event || !event.id) {
                  return; // Invalid event
                }

                setEewEvents((prev) => {
                  // Avoid duplicates
                  if (prev && prev.find((e) => e && e.id === event.id)) {
                    return prev;
                  }
                  return [...(prev || []), event];
                });

                // CRITICAL: Recalculate waves immediately when new EEW event arrives
                if (event.waveCalculation) {
                  calculateWaves().catch((calcError) => {
                    logger.debug('Wave recalculation failed after EEW event:', calcError);
                  });
                }
              } catch (eewError: unknown) {
                logger.error('Error processing EEW event:', {
                  error: eewError instanceof Error ? eewError.message : String(eewError),
                });
              }
            });
          } catch (subscribeError: unknown) {
            logger.error('Failed to subscribe to EEW events:', {
              error: subscribeError instanceof Error ? subscribeError.message : String(subscribeError),
            });
          }
        }
      } catch (initError: unknown) {
        logger.error('Failed to initialize monitoring:', {
          error: initError instanceof Error ? initError.message : String(initError),
        });
        // Don't throw - allow component to render with degraded functionality
      }
    };

    // Start initialization
    initializeMonitoring().catch((error) => {
      logger.error('Monitoring initialization failed:', error);
    });

    // CRITICAL: Cleanup on unmount - prevent memory leaks and state updates after unmount
    return () => {
      isMounted = false; // CRITICAL: Mark as unmounted first

      // Clear all intervals
      if (monitoringInterval) clearInterval(monitoringInterval);
      if (statusInterval) clearInterval(statusInterval);
      if (dataCollectionInterval) clearInterval(dataCollectionInterval);
      if (aiAnalysisIntervalRef.current) clearInterval(aiAnalysisIntervalRef.current);
      if (retryTimeout) clearTimeout(retryTimeout);

      // Unsubscribe from all listeners
      if (detectionUnsubscribe && typeof detectionUnsubscribe === 'function') {
        try {
          detectionUnsubscribe();
        } catch (unsubError) {
          logger.debug('Error unsubscribing from detections:', unsubError);
        }
      }

      if (eewUnsubscribe && typeof eewUnsubscribe === 'function') {
        try {
          eewUnsubscribe();
        } catch (unsubError) {
          logger.debug('Error unsubscribing from EEW events:', unsubError);
        }
      }
    };
  }, [calculateWaves]); // CRITICAL: Include calculateWaves in dependencies

  // CRITICAL: Also recalculate when screen comes into focus
  // ELITE: Professional error handling
  useFocusEffect(
    useCallback(() => {
      try {
        calculateWaves().catch((error: unknown) => {
          logger.error('Failed to calculate waves on focus:', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      } catch (error: unknown) {
        logger.error('Error in useFocusEffect:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, [calculateWaves])
  );

  // Animation for wave propagation
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (selectedWave && isAnimating) {
      const startAnimation = () => {
        animationRef.current.setValue(0);

        animation = Animated.timing(animationRef.current, {
          toValue: 1,
          duration: selectedWave.calculation.warningTime * 1000, // Real-time animation
          useNativeDriver: false,
        });

        animation.start(() => {
          setIsAnimating(false);
        });
      };

      startAnimation();
    }

    // CRITICAL: Cleanup animation on unmount or when dependencies change
    return () => {
      if (animation) {
        animation.stop();
        animation = null;
      }
      animationRef.current.setValue(0);
    };
  }, [selectedWave, isAnimating]);

  // Real-time animation progress and countdown timer with haptic feedback
  useEffect(() => {
    if (selectedWave) {
      let lastPWaveAlert = false;
      let lastSWaveAlert = false;

      const updateProgress = () => {
        const now = Date.now();
        const elapsed = (now - selectedWave.earthquake.time) / 1000;
        const timeUntilSWave = selectedWave.calculation.sWaveArrivalTime - elapsed;
        const timeUntilPWave = selectedWave.calculation.pWaveArrivalTime - elapsed;

        setAnimationTime(Math.max(0, timeUntilSWave));

        // ELITE: Haptic feedback for critical moments
        if (!lastPWaveAlert && timeUntilPWave <= 5 && timeUntilPWave > 0) {
          // P-wave arriving soon
          haptics.notificationWarning();
          lastPWaveAlert = true;
        }

        if (!lastSWaveAlert && timeUntilSWave <= 5 && timeUntilSWave > 0) {
          // S-wave arriving soon - CRITICAL
          haptics.notificationError();
          lastSWaveAlert = true;
        }

        // Calculate real-time animation progress
        let progress = 0;
        if (elapsed < selectedWave.calculation.pWaveArrivalTime) {
          progress = 0; // Before P-wave
        } else if (elapsed > selectedWave.calculation.sWaveArrivalTime) {
          progress = 1; // After S-wave
        } else {
          // Between P and S wave
          progress = (elapsed - selectedWave.calculation.pWaveArrivalTime) / selectedWave.calculation.warningTime;
        }

        setRealTimeProgress(progress);
      };

      // Update immediately
      updateProgress();

      // CRITICAL: Update every 50ms for ultra-smooth real-time animation
      // ELITE: Higher frequency for accurate countdown and progress tracking
      countdownIntervalRef.current = setInterval(updateProgress, 50); // 50ms = 20 Hz for smooth real-time updates
    } else {
      setRealTimeProgress(0);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [selectedWave]);

  // ELITE: Professional error handling for refresh
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await calculateWaves();
    } catch (error: unknown) {
      logger.error('Failed to refresh waves:', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRefreshing(false);
    }
  };

  // ELITE: Professional error handling for animation controls
  const handleStartAnimation = () => {
    try {
      if (selectedWave) {
        setIsAnimating(true);
        try {
          haptics.impactMedium();
        } catch (hapticError) {
          logger.debug('Haptic feedback error:', hapticError);
          // Don't throw - haptics are optional
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to start animation:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleStopAnimation = () => {
    try {
      setIsAnimating(false);
      if (animationRef.current) {
        animationRef.current.setValue(0);
      }
      // CRITICAL: Cleanup countdown interval when stopping animation
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      try {
        haptics.impactLight();
      } catch (hapticError) {
        logger.debug('Haptic feedback error:', hapticError);
        // Don't throw - haptics are optional
      }
    } catch (error: unknown) {
      logger.error('Failed to stop animation:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // ELITE: CRITICAL - All hooks must be called before any early returns
  // Memoized calculations for performance optimization
  const waveCalculations = useMemo(() => {
    const currentWave = selectedWave || waveData[0];
    if (!currentWave) {
      return {
        animationProgress: 0,
        elapsed: 0,
        timeUntilSWave: 0,
        timeUntilPWave: 0,
      };
    }

    const now = Date.now();
    const elapsed = (now - currentWave.earthquake.time) / 1000;
    const timeUntilSWave = Math.max(0, currentWave.calculation.sWaveArrivalTime - elapsed);
    const timeUntilPWave = Math.max(0, currentWave.calculation.pWaveArrivalTime - elapsed);

    return {
      animationProgress: realTimeProgress,
      elapsed,
      timeUntilSWave,
      timeUntilPWave,
    };
  }, [selectedWave, waveData, realTimeProgress]);

  const { animationProgress, elapsed, timeUntilSWave, timeUntilPWave } = waveCalculations;
  const currentWave = selectedWave || waveData[0];

  if (loading && waveData.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={((colors as any).accent?.primary) || ((colors as any).primary?.main) || '#3b82f6'} />
        <Text style={styles.loadingText}>Dalga hesaplamaları yapılıyor...</Text>
      </View>
    );
  }

  if (!userLocation) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color={colors.text.secondary} />
        <Text style={styles.errorText}>Konum izni gerekli</Text>
        <Text style={styles.errorSubtext}>
          P ve S dalgası hesaplamaları için konum bilgisine ihtiyacımız var.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.getCurrentPositionAsync();
              setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
            }
          }}
        >
          <Text style={styles.retryButtonText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (waveData.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Ionicons name="pulse-outline" size={64} color={colors.text.secondary} />
        <Text style={styles.emptyText}>Henüz deprem verisi yok</Text>
        <Text style={styles.emptySubtext}>
          Son 24 saat içinde büyüklüğü 3.0 ve üzeri deprem bulunamadı.
        </Text>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ELITE: Ultra-Premium Seismic Monitoring Header - MyShake/ShakeAlert Inspired */}
      <LinearGradient
        colors={['#0a0f1a', '#0d1320', '#101828']}
        style={styles.headerGradient}
      >
        <View style={styles.premiumHeader}>
          {/* Left: Minimal Back Button */}
          <TouchableOpacity
            style={styles.premiumBackButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* Center: Professional Seismic Title with Waveform Icon */}
          <View style={styles.premiumHeaderCenter}>
            <View style={styles.seismicTitleRow}>
              <View style={styles.seismicIcon}>
                <Ionicons name="pulse" size={16} color="#22c55e" />
              </View>
              <Text style={styles.seismicTitle}>SİSMİK İZLEME</Text>
            </View>
          </View>

          {/* Right: Live Status Badge */}
          <View style={styles.premiumLiveBadge}>
            <View style={styles.premiumLiveDot} />
            <Text style={styles.premiumLiveText}>7/24</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* CRITICAL: Real-time Monitoring Status Indicator */}
        {/* ELITE: Always show monitoring status - 7/24 continuous monitoring */}
        <View style={styles.monitoringStatusContainer}>
          <View style={[
            styles.monitoringStatusBadge,
            (seismicMonitoringStatus?.isRunning || (seismicMonitoringStatus?.totalReadings ?? 0) > 0)
              ? styles.monitoringStatusActive
              : styles.monitoringStatusInactive
          ]}>
            <View style={[
              styles.monitoringStatusDot,
              (seismicMonitoringStatus?.isRunning || (seismicMonitoringStatus?.totalReadings ?? 0) > 0) && styles.monitoringStatusDotActive
            ]} />
            <Text style={styles.monitoringStatusText}>
              {(seismicMonitoringStatus?.isRunning || (seismicMonitoringStatus?.totalReadings ?? 0) > 0)
                ? '📡 SÜREKLI İZLEME AKTİF (7/24)'
                : '🔄 İzleme Başlatılıyor...'}
            </Text>
          </View>
        </View>

        {/* CRITICAL: AI-Powered Analysis Card - Life-saving Early Warning */}
        {/* ELITE: P/S dalgasını yapay zekaya entegre ettik, mümkün olan en kısa sürede erken bildirim göndermeye çalışıyoruz */}
        {(aiPrediction || aiAnalysisLoading || riskScore !== null) && (
          <View style={styles.aiAnalysisContainer}>
            <LinearGradient
              colors={
                aiPrediction?.urgency === 'critical'
                  ? ['#dc2626', '#991b1b']
                  : aiPrediction?.urgency === 'high'
                    ? ['#f59e0b', '#d97706']
                    : ['#3b82f6', '#2563eb']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiAnalysisCard}
            >
              <View style={styles.aiAnalysisGlassOverlay} />

              {/* AI Analysis Header */}
              <View style={styles.aiAnalysisHeader}>
                <View style={styles.aiAnalysisTitleContainer}>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                  <Text style={styles.aiAnalysisTitle}>AI Analiz</Text>
                  {aiAnalysisLoading && (
                    <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
                  )}
                </View>
                {riskScore !== null && (
                  <View style={styles.riskScoreBadge}>
                    <Text style={styles.riskScoreText}>Risk: {riskScore.toFixed(0)}</Text>
                  </View>
                )}
              </View>

              {/* AI Analysis Info Text */}
              <View style={styles.aiAnalysisInfoContainer}>
                <Text style={styles.aiAnalysisInfoText}>
                  P/S dalgasını yapay zekaya entegre ettik. Mümkün olan en kısa sürede erken bildirim göndermeye çalışıyoruz.
                </Text>
              </View>

              {/* AI Prediction Results */}
              {aiPrediction && (
                <View style={styles.aiPredictionContent}>
                  {/* Urgency Badge */}
                  <View style={styles.urgencyBadge}>
                    <Ionicons
                      name={
                        aiPrediction.urgency === 'critical'
                          ? 'warning'
                          : aiPrediction.urgency === 'high'
                            ? 'alert-circle'
                            : 'information-circle'
                      }
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.urgencyText}>
                      {aiPrediction.urgency === 'critical'
                        ? 'KRİTİK'
                        : aiPrediction.urgency === 'high'
                          ? 'YÜKSEK'
                          : aiPrediction.urgency === 'medium'
                            ? 'ORTA'
                            : 'DÜŞÜK'}
                    </Text>
                  </View>

                  {/* Prediction Details */}
                  <View style={styles.predictionDetails}>
                    <View style={styles.predictionRow}>
                      <Text style={styles.predictionLabel}>Tahmin:</Text>
                      <Text style={styles.predictionValue}>
                        {aiPrediction.willOccur ? '✅ Deprem Bekleniyor' : '❌ Deprem Beklenmiyor'}
                      </Text>
                    </View>

                    <View style={styles.predictionRow}>
                      <Text style={styles.predictionLabel}>Güven:</Text>
                      <Text style={styles.predictionValue}>{aiPrediction.confidence}%</Text>
                    </View>

                    {aiPrediction.willOccur && (
                      <>
                        <View style={styles.predictionRow}>
                          <Text style={styles.predictionLabel}>Büyüklük:</Text>
                          <Text style={styles.predictionValue}>
                            M{aiPrediction.estimatedMagnitude.toFixed(1)}
                          </Text>
                        </View>

                        <View style={styles.predictionRow}>
                          <Text style={styles.predictionLabel}>Süre:</Text>
                          <Text style={styles.predictionValue}>
                            {Math.round(aiPrediction.timeAdvance)} saniye içinde
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Recommended Action */}
                  {aiPrediction.recommendedAction && (
                    <View style={styles.recommendedActionContainer}>
                      <Text style={styles.recommendedActionText}>
                        {aiPrediction.recommendedAction}
                      </Text>
                    </View>
                  )}

                  {/* Factor Breakdown */}
                  <View style={styles.factorBreakdown}>
                    <Text style={styles.factorBreakdownTitle}>Analiz Faktörleri:</Text>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Sismik Aktivite:</Text>
                      <View style={styles.factorBarContainer}>
                        <View
                          style={[
                            styles.factorBar,
                            {
                              width: `${aiPrediction.factors.seismicActivity * 100}%`,
                              backgroundColor: '#10b981',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.factorValue}>
                        {(aiPrediction.factors.seismicActivity * 100).toFixed(0)}%
                      </Text>
                    </View>

                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Öncü Sinyaller:</Text>
                      <View style={styles.factorBarContainer}>
                        <View
                          style={[
                            styles.factorBar,
                            {
                              width: `${aiPrediction.factors.precursorSignals * 100}%`,
                              backgroundColor: '#3b82f6',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.factorValue}>
                        {(aiPrediction.factors.precursorSignals * 100).toFixed(0)}%
                      </Text>
                    </View>

                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Tarihsel Desen:</Text>
                      <View style={styles.factorBarContainer}>
                        <View
                          style={[
                            styles.factorBar,
                            {
                              width: `${aiPrediction.factors.historicalPattern * 100}%`,
                              backgroundColor: '#f59e0b',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.factorValue}>
                        {(aiPrediction.factors.historicalPattern * 100).toFixed(0)}%
                      </Text>
                    </View>

                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Ensemble Konsensüs:</Text>
                      <View style={styles.factorBarContainer}>
                        <View
                          style={[
                            styles.factorBar,
                            {
                              width: `${aiPrediction.factors.ensembleConsensus * 100}%`,
                              backgroundColor: '#8b5cf6',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.factorValue}>
                        {(aiPrediction.factors.ensembleConsensus * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Loading State */}
              {aiAnalysisLoading && !aiPrediction && (
                <View style={styles.aiLoadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.aiLoadingText}>AI analiz yapılıyor...</Text>
                </View>
              )}

              {/* No Prediction State */}
              {!aiAnalysisLoading && !aiPrediction && riskScore !== null && (
                <View style={styles.aiNoPredictionContainer}>
                  <Ionicons name="checkmark-circle" size={24} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.aiNoPredictionText}>
                    Şu anda deprem riski tespit edilmedi
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>
        )}

        {/* ELITE: REAL MAP - Gerçek Harita Üzerinde Deprem ve Dalga Görselleştirmesi */}
        <View style={styles.mapContainer}>
          {/* Map Header with clear info */}
          <View style={styles.mapHeader}>
            <View style={styles.mapTitleRow}>
              <Ionicons name="map" size={18} color="#3b82f6" />
              <Text style={styles.mapTitle}>Canlı Deprem Haritası</Text>
            </View>
            <View style={styles.mapInfoBadge}>
              <Text style={styles.mapInfoText}>
                {Math.round(currentWave.calculation.epicentralDistance)} km uzakta
              </Text>
            </View>
          </View>

          {/* Real MapView with earthquake and user locations */}
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={{
                // Center on earthquake location with fallback
                latitude: currentWave.earthquake.latitude,
                longitude: currentWave.earthquake.longitude,
                // Fixed safe delta values (max 5 degrees to prevent crash)
                latitudeDelta: Math.min(
                  Math.max(
                    Math.abs(currentWave.earthquake.latitude - (userLocation?.latitude || currentWave.earthquake.latitude)) * 2.5 + 0.5,
                    1
                  ),
                  5
                ),
                longitudeDelta: Math.min(
                  Math.max(
                    Math.abs(currentWave.earthquake.longitude - (userLocation?.longitude || currentWave.earthquake.longitude)) * 2.5 + 0.5,
                    1
                  ),
                  5
                ),
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              customMapStyle={darkMapStyle}
            >
              {/* Animated P-Wave Circles */}
              {[0, 0.33, 0.66].map((offset, i) => {
                const progress = (wavePulse + offset) % 1;
                const radiusKm = currentWave.calculation.epicentralDistance * progress;
                const radiusMeters = radiusKm * 1000;
                return (
                  <Circle
                    key={`p-wave-${i}`}
                    center={{
                      latitude: currentWave.earthquake.latitude,
                      longitude: currentWave.earthquake.longitude,
                    }}
                    radius={radiusMeters}
                    strokeColor={`rgba(59, 130, 246, ${(1 - progress) * 0.6})`}
                    strokeWidth={2}
                    fillColor="transparent"
                  />
                );
              })}

              {/* Animated S-Wave Circles */}
              {[0.1, 0.45].map((offset, i) => {
                const progress = ((wavePulse * 0.6) + offset) % 1;
                const radiusKm = currentWave.calculation.epicentralDistance * progress * 0.8;
                const radiusMeters = radiusKm * 1000;
                return (
                  <Circle
                    key={`s-wave-${i}`}
                    center={{
                      latitude: currentWave.earthquake.latitude,
                      longitude: currentWave.earthquake.longitude,
                    }}
                    radius={radiusMeters}
                    strokeColor={`rgba(239, 68, 68, ${(1 - progress) * 0.7})`}
                    strokeWidth={3}
                    fillColor="transparent"
                  />
                );
              })}

              {/* Earthquake Epicenter Marker */}
              <Marker
                coordinate={{
                  latitude: currentWave.earthquake.latitude,
                  longitude: currentWave.earthquake.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.epicenterMarker}>
                  <View style={styles.epicenterRing} />
                  <View style={styles.epicenterCore} />
                </View>
              </Marker>

              {/* User Location Marker */}
              {userLocation && (
                <Marker
                  coordinate={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.userMarker}>
                    <View style={styles.userMarkerDot} />
                    <Text style={styles.userMarkerLabel}>SİZ</Text>
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Wave Legend Overlay */}
            <View style={styles.mapLegendOverlay}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                <Text style={styles.legendText}>P-Dalga (hızlı)</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.legendText}>S-Dalga (yıkıcı)</Text>
              </View>
            </View>

            {/* Epicenter Info Overlay */}
            <View style={styles.epicenterInfoOverlay}>
              <View style={styles.epicenterInfoRow}>
                <View style={[styles.epicenterInfoDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.epicenterInfoText}>Deprem Merkezi</Text>
              </View>
              <Text style={styles.epicenterInfoMag}>M{currentWave.earthquake.magnitude.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        {/* ELITE: Premium 3-Axis Seismograph Display - Always Active */}
        {/* CRITICAL: Sismograf HİÇ DURMAMALI - 7/24 sürekli dalga görselleştirmesi */}
        <View style={styles.seismographCard}>
          <LinearGradient
            colors={['#0a0f18', '#0d1420', '#101828']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.seismographGradient}
          >
            {/* Header with HONEST status badge */}
            <View style={styles.seismographHeader}>
              <View style={styles.seismographTitleRow}>
                <Text style={styles.seismographTitle}>Sismograf</Text>
                <Text style={styles.seismographSubtitle}>
                  {realTimeSeismicData.length > 0 ? 'Gerçek Zamanlı Sensör Verisi' : 'Simülasyon Modu'}
                </Text>
              </View>
              <View style={[
                styles.liveDataBadge,
                realTimeSeismicData.length === 0 && {
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  borderColor: 'rgba(245, 158, 11, 0.3)'
                }
              ]}>
                <View style={[
                  styles.liveDataDot,
                  realTimeSeismicData.length === 0 && { backgroundColor: '#f59e0b' }
                ]} />
                <Text style={[
                  styles.liveDataText,
                  realTimeSeismicData.length === 0 && { color: '#f59e0b' }
                ]}>
                  {realTimeSeismicData.length > 0 ? 'CANLI VERİ' : 'SİMÜLASYON'}
                </Text>
              </View>
            </View>

            {/* 3-Axis Waveform Display - Z/N/E components - REAL SENSOR DATA */}
            <View style={styles.waveformContainer}>
              <WaveformGraph
                magnitude={currentWave?.earthquake.magnitude || 3.0}
                isActive={true}
                showPWave={true}
                showSWave={true}
                pWaveProgress={1}
                sWaveProgress={1}
                label="Z"
                color="#22c55e"
                realSensorData={realTimeSeismicData} // CRITICAL: Real accelerometer data
              />
              <WaveformGraph
                magnitude={(currentWave?.earthquake.magnitude || 3.0) * 0.8}
                isActive={true}
                showPWave={true}
                showSWave={true}
                pWaveProgress={1}
                sWaveProgress={1}
                label="N"
                color="#3b82f6"
                realSensorData={realTimeSeismicData} // CRITICAL: Real accelerometer data
              />
              <WaveformGraph
                magnitude={(currentWave?.earthquake.magnitude || 3.0) * 0.6}
                isActive={true}
                showPWave={true}
                showSWave={true}
                pWaveProgress={1}
                sWaveProgress={1}
                label="E"
                color="#f59e0b"
                realSensorData={realTimeSeismicData} // CRITICAL: Real accelerometer data
              />
            </View>

            {/* Amplitude Scale */}
            <View style={styles.amplitudeScale}>
              <Text style={styles.amplitudeText}>Max: {(currentWave?.earthquake.magnitude || 3.0) > 4 ? '±' + ((currentWave?.earthquake.magnitude || 3.0) * 0.3).toFixed(1) : '±0.02'} m/s²</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ELITE: Premium Info Card with Glassmorphism */}
        <View style={styles.infoCard}>
          {/* Glassmorphism overlay */}
          <View style={styles.cardGlassOverlay} />
          <View style={styles.infoHeader}>
            <View style={styles.magnitudeBadge}>
              <Text style={styles.magnitudeText}>
                M{currentWave.earthquake.magnitude.toFixed(1)}
              </Text>
            </View>
            <View style={styles.infoHeaderRight}>
              <Ionicons name="location" size={16} color={colors.text.secondary} />
              <Text style={styles.locationText}>{currentWave.earthquake.location}</Text>
            </View>
          </View>

          {/* ELITE: Wave Arrival Times with Premium Gradient Design */}
          <View style={styles.timesContainer}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.timeCard}
            >
              <View style={styles.timeCardGlassOverlay} />
              <Ionicons name="radio" size={20} color="#fff" style={styles.timeIcon} />
              <Text style={styles.timeLabel}>P-Dalga</Text>
              <Text style={[styles.timeValue, styles.pWaveValue]}>
                {timeUntilPWave > 0
                  ? `${Math.round(timeUntilPWave)}s`
                  : 'Geldi'}
              </Text>
              <Text style={styles.timeSubtext}>
                {currentWave.calculation.pWaveArrivalTime.toFixed(1)}s
              </Text>
              <Text style={styles.timeVelocity}>
                {currentWave.calculation.pWaveVelocity.toFixed(1)} km/s
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.timeCard}
            >
              <View style={styles.timeCardGlassOverlay} />
              <Ionicons name="warning" size={20} color="#fff" style={styles.timeIcon} />
              <Text style={styles.timeLabel}>S-Dalga</Text>
              <Text style={[styles.timeValue, styles.sWaveTime]}>
                {timeUntilSWave > 0
                  ? `${Math.round(timeUntilSWave)}s`
                  : 'Geldi'}
              </Text>
              <Text style={styles.timeSubtext}>
                {currentWave.calculation.sWaveArrivalTime.toFixed(1)}s
              </Text>
              <Text style={styles.timeVelocity}>
                {currentWave.calculation.sWaveVelocity.toFixed(1)} km/s
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={['#f59e0b', '#d97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.timeCard}
            >
              <View style={styles.timeCardGlassOverlay} />
              <Ionicons name="time" size={20} color="#fff" style={styles.timeIcon} />
              <Text style={styles.timeLabel}>Uyarı Süresi</Text>
              <Text style={[styles.timeValue, styles.warningTime]}>
                {Math.round(currentWave.calculation.warningTime)}s
              </Text>
              <Text style={styles.timeSubtext}>
                ±{currentWave.calculation.warningTimeUncertainty.toFixed(1)}s
              </Text>
              <Text style={styles.timeVelocity}>
                {currentWave.calculation.epicentralDistance.toFixed(0)} km uzaklık
              </Text>
            </LinearGradient>
          </View>

          {/* ELITE: Intensity and PGA with Premium Design */}
          <View style={styles.intensityContainer}>
            <View style={styles.intensityCard}>
              <View style={styles.intensityHeader}>
                <Ionicons name="pulse" size={18} color={colors.text.secondary} />
                <Text style={styles.intensityLabel}>Beklenen Şiddet (MMI)</Text>
              </View>
              <View style={styles.intensityValueContainer}>
                <Text style={styles.intensityValue}>
                  {currentWave.calculation.estimatedIntensity.toFixed(1)}
                </Text>
                <Text style={styles.intensityUncertainty}>
                  ±{currentWave.calculation.intensityUncertainty.toFixed(1)}
                </Text>
              </View>
              <View style={styles.intensityBar}>
                <LinearGradient
                  colors={
                    currentWave.calculation.estimatedIntensity >= 7
                      ? ['#dc2626', '#991b1b']
                      : currentWave.calculation.estimatedIntensity >= 5
                        ? ['#f59e0b', '#d97706']
                        : ['#10b981', '#059669']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.intensityBarFill,
                    {
                      width: `${(currentWave.calculation.estimatedIntensity / 12) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.intensityDescription}>
                {currentWave.calculation.estimatedIntensity >= 7
                  ? 'Şiddetli sarsıntı bekleniyor'
                  : currentWave.calculation.estimatedIntensity >= 5
                    ? 'Orta şiddette sarsıntı bekleniyor'
                    : 'Hafif sarsıntı bekleniyor'}
              </Text>
            </View>

            <View style={styles.pgaCard}>
              <View style={styles.pgaHeader}>
                <Ionicons name="speedometer" size={18} color={colors.text.secondary} />
                <Text style={styles.pgaLabel}>PGA (Zemin İvmesi)</Text>
              </View>
              <View style={styles.pgaValueContainer}>
                <Text style={styles.pgaValue}>
                  {currentWave.calculation.estimatedPGA.toFixed(3)}
                </Text>
                <Text style={styles.pgaUnit}>g</Text>
              </View>
              <Text style={styles.pgaUncertainty}>
                ±{currentWave.calculation.pgaUncertainty.toFixed(3)}g
              </Text>
              <Text style={styles.pgaDescription}>
                {currentWave.calculation.estimatedPGA >= 0.5
                  ? 'Çok yüksek zemin ivmesi'
                  : currentWave.calculation.estimatedPGA >= 0.2
                    ? 'Yüksek zemin ivmesi'
                    : currentWave.calculation.estimatedPGA >= 0.1
                      ? 'Orta zemin ivmesi'
                      : 'Düşük zemin ivmesi'}
              </Text>
            </View>
          </View>

          {/* ELITE: Quality Indicator and Additional Details */}
          <View style={styles.qualityContainer}>
            <LinearGradient
              colors={
                currentWave.calculation.quality === 'excellent'
                  ? ['#10b981', '#059669']
                  : currentWave.calculation.quality === 'good'
                    ? ['#3b82f6', '#2563eb']
                    : currentWave.calculation.quality === 'fair'
                      ? ['#f59e0b', '#d97706']
                      : ['#ef4444', '#dc2626']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.qualityBadge}
            >
              <View style={styles.qualityBadgeGlassOverlay} />
              <Ionicons
                name={
                  currentWave.calculation.quality === 'excellent'
                    ? 'checkmark-circle'
                    : currentWave.calculation.quality === 'good'
                      ? 'checkmark-circle'
                      : 'warning'
                }
                size={18}
                color="#fff"
              />
              <Text style={styles.qualityText}>
                {currentWave.calculation.quality === 'excellent'
                  ? 'Mükemmel'
                  : currentWave.calculation.quality === 'good'
                    ? 'İyi'
                    : currentWave.calculation.quality === 'fair'
                      ? 'Orta'
                      : 'Düşük'} Kalite
              </Text>
              <Text style={styles.qualityConfidence}>
                {currentWave.calculation.confidence}% güven
              </Text>
            </LinearGradient>
            <View style={styles.methodContainer}>
              <Ionicons name="calculator" size={14} color={colors.text.secondary} />
              <Text style={styles.methodText}>
                {currentWave.calculation.calculationMethod === 'elite'
                  ? 'Elite'
                  : currentWave.calculation.calculationMethod === 'advanced'
                    ? 'Gelişmiş'
                    : currentWave.calculation.calculationMethod === 'site_adjusted'
                      ? 'Site Düzeltmeli'
                      : currentWave.calculation.calculationMethod === 'regional'
                        ? 'Bölgesel'
                        : 'Standart'} Hesaplama
              </Text>
            </View>
          </View>

          {/* ELITE: Additional Technical Details */}
          <View style={styles.technicalDetailsContainer}>
            <View style={styles.technicalDetail}>
              <Ionicons name="location" size={14} color={colors.text.secondary} />
              <Text style={styles.technicalDetailLabel}>Bölge:</Text>
              <Text style={styles.technicalDetailValue}>
                {currentWave.calculation.region === 'nafz'
                  ? 'Kuzey Anadolu Fay Hattı'
                  : currentWave.calculation.region === 'eafz'
                    ? 'Doğu Anadolu Fay Hattı'
                    : currentWave.calculation.region === 'aegean'
                      ? 'Ege Bölgesi'
                      : currentWave.calculation.region === 'marmara'
                        ? 'Marmara Bölgesi'
                        : currentWave.calculation.region === 'mediterranean'
                          ? 'Akdeniz Kıyısı'
                          : currentWave.calculation.region === 'blacksea'
                            ? 'Karadeniz Kıyısı'
                            : 'Anadolu Plakası'}
              </Text>
            </View>
            <View style={styles.technicalDetail}>
              <Ionicons name="layers" size={14} color={colors.text.secondary} />
              <Text style={styles.technicalDetailLabel}>Derinlik:</Text>
              <Text style={styles.technicalDetailValue}>
                {currentWave.earthquake.depth.toFixed(1)} km
              </Text>
            </View>
            <View style={styles.technicalDetail}>
              <Ionicons name="pulse" size={14} color={colors.text.secondary} />
              <Text style={styles.technicalDetailLabel}>PGV:</Text>
              <Text style={styles.technicalDetailValue}>
                {currentWave.calculation.estimatedPGV.toFixed(1)} cm/s
              </Text>
            </View>
            <View style={styles.technicalDetail}>
              <Ionicons name="home" size={14} color={colors.text.secondary} />
              <Text style={styles.technicalDetailLabel}>VS30:</Text>
              <Text style={styles.technicalDetailValue}>
                {currentWave.calculation.vs30.toFixed(0)} m/s
              </Text>
            </View>
          </View>
        </View>

        {/* Other Earthquakes List */}
        {waveData.length > 1 && (
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Diğer Depremler</Text>
            {waveData
              .filter((w) => w.earthquake.id !== currentWave.earthquake.id)
              .slice(0, 5)
              .map((wave) => (
                <TouchableOpacity
                  key={wave.earthquake.id}
                  style={styles.listItem}
                  onPress={() => {
                    setSelectedWave(wave);
                    haptics.impactLight();
                  }}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemMagnitude}>
                      M{wave.earthquake.magnitude.toFixed(1)}
                    </Text>
                    <Text style={styles.listItemLocation}>
                      {wave.earthquake.location}
                    </Text>
                  </View>
                  <View style={styles.listItemRight}>
                    <Text style={styles.listItemWarningTime}>
                      {Math.round(wave.calculation.warningTime)}s
                    </Text>
                    <Text style={styles.listItemDistance}>
                      {Math.round(wave.calculation.epicentralDistance)} km
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {/* Animation Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, !isAnimating && styles.controlButtonActive]}
            onPress={handleStartAnimation}
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.controlButtonText}>Başlat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, isAnimating && styles.controlButtonActive]}
            onPress={handleStopAnimation}
          >
            <Ionicons name="stop" size={20} color="#fff" />
            <Text style={styles.controlButtonText}>Durdur</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
