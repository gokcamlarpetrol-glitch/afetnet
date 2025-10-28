// ADVANCED LOCATION MANAGEMENT WITH DEAD RECKONING & GPS ENHANCEMENT
// Ultra-precise location tracking for disaster scenarios

import { logger } from '../utils/productionLogger';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
  source: 'gps' | 'network' | 'dead_reckoning' | 'mesh' | 'estimated';
  confidence: number; // 0-100
  isCalibrated: boolean;
}

export interface MotionData {
  acceleration: { x: number; y: number; z: number };
  rotation: { alpha: number; beta: number; gamma: number };
  timestamp: number;
}

export interface DeadReckoningState {
  lastKnownLocation: LocationData;
  velocity: { x: number; y: number; z: number }; // m/s
  heading: number; // degrees
  lastUpdate: number;
  confidence: number;
  calibrationPoints: LocationData[];
  driftCorrection: { lat: number; lon: number };
}

export interface LocationCalibration {
  gpsPoints: LocationData[];
  calibrationAccuracy: number;
  lastCalibration: number;
  driftRate: { lat: number; lon: number }; // meters per second
  environmentalFactors: {
    buildingInterference: number;
    magneticInterference: number;
    signalQuality: number;
  };
}

class AdvancedLocationManager {
  private currentLocation: LocationData | null = null;
  private locationHistory: LocationData[] = [];
  private deadReckoningState: DeadReckoningState;
  private calibrationData: LocationCalibration;
  private motionSubscription: any = null;
  private locationSubscription: any = null;
  private isTracking = false;
  private gpsEnhancementActive = false;
  private meshLocationIntegration = false;

  constructor() {
    this.deadReckoningState = this.initializeDeadReckoning();
    this.calibrationData = this.initializeCalibration();
  }

  private initializeDeadReckoning(): DeadReckoningState {
    return {
      lastKnownLocation: {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        timestamp: Date.now(),
        source: 'estimated',
        confidence: 0,
        isCalibrated: false,
      },
      velocity: { x: 0, y: 0, z: 0 },
      heading: 0,
      lastUpdate: Date.now(),
      confidence: 0,
      calibrationPoints: [],
      driftCorrection: { lat: 0, lon: 0 },
    };
  }

  private initializeCalibration(): LocationCalibration {
    return {
      gpsPoints: [],
      calibrationAccuracy: 0,
      lastCalibration: 0,
      driftRate: { lat: 0, lon: 0 },
      environmentalFactors: {
        buildingInterference: 0,
        magneticInterference: 0,
        signalQuality: 100,
      },
    };
  }

  async start(): Promise<void> {
    logger.debug('📍 Starting advanced location manager...');

    try {
      // Request location permissions
      await this.requestLocationPermissions();

      // Load previous calibration data
      await this.loadCalibrationData();

      // Start GPS tracking
      this.startGPSTracking();

      // Start motion tracking for dead reckoning
      this.startMotionTracking();

      // Start periodic calibration
      this.startAutomaticCalibration();

      // Initialize GPS enhancement
      this.initializeGPSEnhancement();

      this.isTracking = true;
      logger.debug('✅ Advanced location manager started');

    } catch (error) {
      logger.error('❌ Failed to start advanced location manager:', error);
      throw error;
    }
  }

  private async requestLocationPermissions(): Promise<void> {
    logger.debug('🔐 Requesting location permissions...');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Request background location if needed
      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status !== 'granted') {
        logger.warn('Background location permission not granted');
      }

      logger.debug('✅ Location permissions granted');
    } catch (error) {
      logger.error('Failed to request location permissions:', error);
      throw error;
    }
  }

  private async loadCalibrationData(): Promise<void> {
    try {
      const calibrationData = await AsyncStorage.getItem('location_calibration');
      if (calibrationData) {
        this.calibrationData = { ...this.calibrationData, ...JSON.parse(calibrationData) };
        logger.debug('Calibration data loaded');
      }
    } catch (error) {
      logger.error('Failed to load calibration data:', error);
    }
  }

  private async saveCalibrationData(): Promise<void> {
    try {
      await AsyncStorage.setItem('location_calibration', JSON.stringify(this.calibrationData));
      logger.debug('Calibration data saved');
    } catch (error) {
      logger.error('Failed to save calibration data:', error);
    }
  }

  private startGPSTracking(): void {
    logger.debug('🛰️ Starting GPS tracking...');

    // Watch position with high accuracy
    this.locationSubscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000, // 1 second
        distanceInterval: 1, // 1 meter
      },
      (location) => {
        this.handleLocationUpdate(location);
      }
    );
  }

  private startMotionTracking(): void {
    logger.debug('📱 Starting motion tracking for dead reckoning...');

    // Subscribe to accelerometer
    Accelerometer.setUpdateInterval(100); // 10 Hz updates

    this.motionSubscription = Accelerometer.addListener((accelerometerData) => {
      this.handleMotionUpdate(accelerometerData);
    });
  }

  private handleLocationUpdate(location: any): void {
    const locationData: LocationData = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || 10,
      altitude: location.coords.altitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: Date.now(),
      source: 'gps',
      confidence: this.calculateGPSConfidence(location.coords),
      isCalibrated: true,
    };

    // Update current location
    this.currentLocation = locationData;

    // Add to history
    this.locationHistory.push(locationData);

    // Keep only last 1000 locations
    if (this.locationHistory.length > 1000) {
      this.locationHistory = this.locationHistory.slice(-1000);
    }

    // Update dead reckoning calibration
    this.updateDeadReckoningCalibration(locationData);

    // Update environmental factors
    this.updateEnvironmentalFactors(locationData);

    logger.debug(`📍 GPS location updated: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)} (accuracy: ${locationData.accuracy}m)`);
  }

  private calculateGPSConfidence(coords: any): number {
    let confidence = 100;

    // Reduce confidence based on accuracy
    if (coords.accuracy > 50) confidence -= 30;
    if (coords.accuracy > 100) confidence -= 20;
    if (coords.accuracy > 500) confidence -= 30;

    // Reduce confidence if no altitude (2D fix)
    if (!coords.altitude) confidence -= 10;

    // Reduce confidence if speed is unrealistic
    if (coords.speed && coords.speed > 100) confidence -= 20; // > 100 m/s is unrealistic

    return Math.max(0, Math.min(100, confidence));
  }

  private handleMotionUpdate(motionData: any): void {
    if (!this.currentLocation) return;

    try {
      // Extract acceleration and rotation data
      const acceleration = motionData.acceleration;
      const rotation = motionData.rotation;

      if (acceleration && rotation) {
        // Update dead reckoning state
        this.updateDeadReckoningState(acceleration, rotation);

        // Calculate estimated position
        const estimatedLocation = this.calculateDeadReckoningPosition();

        if (estimatedLocation) {
          logger.debug(`🧭 Dead reckoning position: ${estimatedLocation.latitude.toFixed(6)}, ${estimatedLocation.longitude.toFixed(6)}`);
        }
      }
    } catch (error) {
      logger.error('Failed to handle motion update:', error);
    }
  }

  private updateDeadReckoningState(acceleration: any, rotation: any): void {
    if (!this.currentLocation) return;

    const now = Date.now();
    const timeDelta = (now - this.deadReckoningState.lastUpdate) / 1000; // seconds

    if (timeDelta > 10) return; // Skip if too much time has passed

    // Update velocity based on acceleration (simple integration)
    this.deadReckoningState.velocity.x += acceleration.x * timeDelta;
    this.deadReckoningState.velocity.y += acceleration.y * timeDelta;
    this.deadReckoningState.velocity.z += acceleration.z * timeDelta;

    // Apply damping to prevent velocity drift
    const damping = 0.9;
    this.deadReckoningState.velocity.x *= damping;
    this.deadReckoningState.velocity.y *= damping;
    this.deadReckoningState.velocity.z *= damping;

    // Update heading based on rotation
    if (rotation.alpha !== null) {
      this.deadReckoningState.heading = rotation.alpha;
    }

    this.deadReckoningState.lastUpdate = now;
    this.deadReckoningState.confidence = Math.max(0, this.deadReckoningState.confidence - timeDelta * 5); // Confidence decreases over time
  }

  private calculateDeadReckoningPosition(): LocationData | null {
    if (!this.currentLocation || this.deadReckoningState.confidence < 20) return null;

    const now = Date.now();
    const timeDelta = (now - this.deadReckoningState.lastUpdate) / 1000;

    // Calculate displacement based on velocity and heading
    const speed = Math.sqrt(
      this.deadReckoningState.velocity.x ** 2 +
      this.deadReckoningState.velocity.y ** 2
    );

    if (speed < 0.1) return this.currentLocation; // Not moving

    // Calculate displacement in meters
    const distance = speed * timeDelta;
    const headingRad = (this.deadReckoningState.heading * Math.PI) / 180;

    // Convert to lat/lon displacement
    const latDisplacement = (distance * Math.cos(headingRad)) / 111320; // meters to degrees
    const lonDisplacement = (distance * Math.sin(headingRad)) / (111320 * Math.cos(this.currentLocation.latitude * Math.PI / 180));

    const estimatedLocation: LocationData = {
      latitude: this.currentLocation.latitude + latDisplacement,
      longitude: this.currentLocation.longitude + lonDisplacement,
      accuracy: this.currentLocation.accuracy + (distance * 2), // Accuracy degrades with distance
      heading: this.deadReckoningState.heading,
      speed: speed,
      timestamp: now,
      source: 'dead_reckoning',
      confidence: this.deadReckoningState.confidence,
      isCalibrated: this.deadReckoningState.confidence > 50,
    };

    return estimatedLocation;
  }

  private updateDeadReckoningCalibration(gpsLocation: LocationData): void {
    if (this.locationHistory.length < 2) return;

    const lastLocation = this.locationHistory[this.locationHistory.length - 2];
    const timeDelta = (gpsLocation.timestamp - lastLocation.timestamp) / 1000;

    if (timeDelta < 60) { // Only calibrate if points are close in time
      // Calculate drift correction
      const latDrift = gpsLocation.latitude - (lastLocation.latitude + this.deadReckoningState.driftCorrection.lat);
      const lonDrift = gpsLocation.longitude - (lastLocation.longitude + this.deadReckoningState.driftCorrection.lon);

      // Update drift correction (smooth over time)
      this.deadReckoningState.driftCorrection.lat = this.deadReckoningState.driftCorrection.lat * 0.9 + latDrift * 0.1;
      this.deadReckoningState.driftCorrection.lon = this.deadReckoningState.driftCorrection.lon * 0.9 + lonDrift * 0.1;

      // Update calibration confidence
      this.deadReckoningState.confidence = Math.min(100, this.deadReckoningState.confidence + 10);
    }
  }

  private updateEnvironmentalFactors(location: LocationData): void {
    // Update environmental interference factors
    const accuracy = location.accuracy;

    if (accuracy > 50) {
      this.calibrationData.environmentalFactors.buildingInterference += 0.1;
    } else {
      this.calibrationData.environmentalFactors.buildingInterference *= 0.95;
    }

    // Update signal quality
    this.calibrationData.environmentalFactors.signalQuality = Math.max(0,
      100 - (accuracy / 10) - this.calibrationData.environmentalFactors.buildingInterference
    );

    // Keep values in reasonable ranges
    this.calibrationData.environmentalFactors.buildingInterference = Math.max(0, Math.min(100,
      this.calibrationData.environmentalFactors.buildingInterference
    ));
  }

  private startPeriodicCalibration(): void {
    logger.debug('🔧 Starting periodic location calibration...');

    setInterval(() => {
      if (this.isTracking) {
        this.performPeriodicCalibration();
      }
    }, 300000); // Every 5 minutes
  }

  private performPeriodicCalibration(): void {
    logger.debug('🔧 Performing periodic location calibration...');

    // Analyze location history for patterns
    this.analyzeLocationPatterns();

    // Update drift rates
    this.updateDriftRates();

    // Recalibrate dead reckoning
    this.recalibrateDeadReckoning();

    logger.debug('✅ Periodic calibration completed');
  }

  private analyzeLocationPatterns(): void {
    if (this.locationHistory.length < 10) return;

    const recentLocations = this.locationHistory.slice(-20);

    // Calculate average speed and direction
    let totalDistance = 0;
    let totalTime = 0;
    let directionChanges = 0;

    for (let i = 1; i < recentLocations.length; i++) {
      const prev = recentLocations[i - 1];
      const curr = recentLocations[i];

      const distance = this.calculateDistance(prev, curr);
      const time = (curr.timestamp - prev.timestamp) / 1000;

      totalDistance += distance;
      totalTime += time;

      // Check for direction changes
      if (prev.heading && curr.heading) {
        const directionDiff = Math.abs(curr.heading - prev.heading);
        if (directionDiff > 45) { // 45 degree change
          directionChanges++;
        }
      }
    }

    const averageSpeed = totalDistance / totalTime;
    const directionStability = 1 - (directionChanges / recentLocations.length);

    logger.debug(`📊 Location analysis: ${averageSpeed.toFixed(2)} m/s average speed, ${directionStability.toFixed(2)} direction stability`);
  }

  private calculateDistance(loc1: LocationData, loc2: LocationData): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private updateDriftRates(): void {
    if (this.calibrationData.gpsPoints.length < 2) return;

    const recentGPS = this.calibrationData.gpsPoints.slice(-10);
    const recentDR = this.deadReckoningState.calibrationPoints.slice(-10);

    if (recentGPS.length === 0 || recentDR.length === 0) return;

    // Calculate average drift
    let totalLatDrift = 0;
    let totalLonDrift = 0;

    for (let i = 0; i < Math.min(recentGPS.length, recentDR.length); i++) {
      totalLatDrift += recentGPS[i].latitude - recentDR[i].latitude;
      totalLonDrift += recentGPS[i].longitude - recentDR[i].longitude;
    }

    const avgLatDrift = totalLatDrift / Math.min(recentGPS.length, recentDR.length);
    const avgLonDrift = totalLonDrift / Math.min(recentGPS.length, recentDR.length);

    this.calibrationData.driftRate.lat = avgLatDrift;
    this.calibrationData.driftRate.lon = avgLonDrift;

    logger.debug(`📐 Drift rates updated: lat=${avgLatDrift.toFixed(6)}, lon=${avgLonDrift.toFixed(6)}`);
  }

  private recalibrateDeadReckoning(): void {
    if (!this.currentLocation) return;

    // Reset dead reckoning state with current GPS position
    this.deadReckoningState.lastKnownLocation = this.currentLocation;
    this.deadReckoningState.velocity = { x: 0, y: 0, z: 0 };
    this.deadReckoningState.confidence = this.currentLocation.confidence;
    this.deadReckoningState.lastUpdate = Date.now();

    logger.debug('🔄 Dead reckoning recalibrated with GPS position');
  }

  private initializeGPSEnhancement(): void {
    logger.debug('🛰️ Initializing GPS enhancement...');

    // In real implementation, would integrate with external GPS enhancement services
    // like RTK (Real-Time Kinematic) or DGPS (Differential GPS)

    this.gpsEnhancementActive = true;

    logger.debug('✅ GPS enhancement initialized');
  }

  private startAutomaticCalibration(): void {
    logger.debug('🔧 Starting automatic calibration...');

    setInterval(() => {
      this.performAutomaticCalibration();
    }, 600000); // Every 10 minutes
  }

  private performAutomaticCalibration(): void {
    if (this.locationHistory.length < 5) return;

    // Automatic calibration based on location history
    const recentLocations = this.locationHistory.slice(-10);
    const avgAccuracy = recentLocations.reduce((sum, loc) => sum + loc.accuracy, 0) / recentLocations.length;

    this.calibrationData.calibrationAccuracy = avgAccuracy;
    this.calibrationData.lastCalibration = Date.now();

    logger.debug(`🔧 Automatic calibration completed: ${avgAccuracy.toFixed(2)}m average accuracy`);
  }

  // Public API
  public getCurrentLocation(): LocationData | null {
    return this.currentLocation;
  }

  public getLocationHistory(): LocationData[] {
    return [...this.locationHistory];
  }

  public getDeadReckoningState(): DeadReckoningState {
    return { ...this.deadReckoningState };
  }

  public getCalibrationData(): LocationCalibration {
    return { ...this.calibrationData };
  }

  public async getEnhancedLocation(): Promise<LocationData> {
    // Get the most accurate location available
    if (this.currentLocation && this.currentLocation.confidence > 80) {
      return this.currentLocation; // High confidence GPS
    }

    // Try dead reckoning
    const deadReckoningLocation = this.calculateDeadReckoningPosition();
    if (deadReckoningLocation && deadReckoningLocation.confidence > 50) {
      return deadReckoningLocation;
    }

    // Try mesh network location
    const meshLocation = await this.getMeshNetworkLocation();
    if (meshLocation) {
      return meshLocation;
    }

    // Fallback to last known location
    if (this.currentLocation) {
      return this.currentLocation;
    }

    // Emergency fallback
    return {
      latitude: 39.9334, // Default to Ankara coordinates
      longitude: 32.8597,
      accuracy: 10000,
      timestamp: Date.now(),
      source: 'estimated',
      confidence: 0,
      isCalibrated: false,
    };
  }

  private async getMeshNetworkLocation(): Promise<LocationData | null> {
    // Get location from mesh network devices
    // This would integrate with BLE mesh for location sharing

    if (!this.meshLocationIntegration) return null;

    // Mock implementation - in real system would query mesh network
    return null;
  }

  public async calibrateWithKnownLocation(knownLocation: { lat: number; lon: number }): Promise<void> {
    logger.debug(`🎯 Calibrating with known location: ${knownLocation.lat}, ${knownLocation.lon}`);

    if (this.currentLocation) {
      // Calculate calibration correction
      const latCorrection = knownLocation.lat - this.currentLocation.latitude;
      const lonCorrection = knownLocation.lon - this.currentLocation.longitude;

      // Apply correction to dead reckoning
      this.deadReckoningState.driftCorrection.lat += latCorrection;
      this.deadReckoningState.driftCorrection.lon += lonCorrection;

      // Add calibration point
      const calibrationPoint: LocationData = {
        latitude: knownLocation.lat,
        longitude: knownLocation.lon,
        accuracy: 1, // Very high accuracy for known point
        timestamp: Date.now(),
        source: 'estimated',
        confidence: 100,
        isCalibrated: true,
      };

      this.deadReckoningState.calibrationPoints.push(calibrationPoint);
      this.calibrationData.gpsPoints.push(calibrationPoint);

      // Keep only recent calibration points
      if (this.deadReckoningState.calibrationPoints.length > 20) {
        this.deadReckoningState.calibrationPoints = this.deadReckoningState.calibrationPoints.slice(-20);
      }

      logger.debug('✅ Location calibration completed');
    }
  }

  public getLocationAccuracy(): {
    currentAccuracy: number;
    averageAccuracy: number;
    deadReckoningAccuracy: number;
    environmentalInterference: number;
    recommendation: string;
  } {
    const currentAccuracy = this.currentLocation?.accuracy || 1000;
    const recentLocations = this.locationHistory.slice(-20);
    const averageAccuracy = recentLocations.length > 0
      ? recentLocations.reduce((sum, loc) => sum + loc.accuracy, 0) / recentLocations.length
      : 1000;

    const deadReckoningAccuracy = this.deadReckoningState.confidence > 0
      ? 100 - this.deadReckoningState.confidence
      : 100;

    const environmentalInterference = this.calibrationData.environmentalFactors.buildingInterference +
                                     this.calibrationData.environmentalFactors.magneticInterference;

    let recommendation = 'Location accuracy is good';
    if (currentAccuracy > 100) {
      recommendation = 'Consider moving to open area for better GPS signal';
    } else if (environmentalInterference > 50) {
      recommendation = 'High environmental interference detected. Indoor navigation may be affected.';
    } else if (this.deadReckoningState.confidence > 70) {
      recommendation = 'Dead reckoning is highly accurate. Good for indoor navigation.';
    }

    return {
      currentAccuracy,
      averageAccuracy,
      deadReckoningAccuracy,
      environmentalInterference,
      recommendation,
    };
  }

  public enableMeshLocationIntegration(): void {
    logger.debug('🔗 Enabling mesh network location integration...');
    this.meshLocationIntegration = true;
  }

  public disableMeshLocationIntegration(): void {
    logger.debug('🔌 Disabling mesh network location integration...');
    this.meshLocationIntegration = false;
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping advanced location manager...');

    this.isTracking = false;

    // Stop subscriptions
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.motionSubscription) {
      this.motionSubscription.remove();
      this.motionSubscription = null;
    }

    // Save calibration data
    await this.saveCalibrationData();

    logger.debug('✅ Advanced location manager stopped');
  }
}

// Export singleton instance
export const advancedLocationManager = new AdvancedLocationManager();
