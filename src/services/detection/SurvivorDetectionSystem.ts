import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface SurvivorSignal {
  id: string;
  type: 'audio' | 'vibration' | 'heat' | 'movement' | 'voice' | 'electronic';
  source: string;
  strength: number; // 0-100
  frequency: number; // Hz
  duration: number; // milliseconds
  timestamp: number;
  location: {
    lat: number;
    lon: number;
    accuracy: number;
    depth?: number; // meters underground
  };
  confidence: number; // 0-100
  metadata?: any;
}

export interface SurvivorDetection {
  id: string;
  survivorId: string;
  signals: SurvivorSignal[];
  location: {
    lat: number;
    lon: number;
    accuracy: number;
    depth?: number;
  };
  firstDetected: number;
  lastSignalTime: number;
  lastUpdated?: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'detected' | 'confirmed' | 'rescued' | 'lost';
  estimatedSurvivors: number;
  accessibility: 'accessible' | 'partially_blocked' | 'blocked' | 'unknown';
  estimatedDepth: number;
  notes: string[];
  rescueTeam?: string;
  rescueETA?: number; // minutes
}

class SurvivorDetectionSystem extends SimpleEventEmitter {
  private activeDetections = new Map<string, SurvivorDetection>();
  private survivorSignals = new Map<string, SurvivorSignal[]>();
  private isMonitoring = false;
  private detectionPatterns = new Map<string, any>();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDetectionPatterns();
  }

  private initializeDetectionPatterns() {
    logger.debug('👥 Initializing Survivor Detection System...');

    // Audio detection patterns
    this.detectionPatterns.set('human_voice', {
      frequencyRange: [85, 3400], // Human voice frequency range
      duration: [100, 10000],
      strength: [20, 100],
      confidence: 85
    });

    this.detectionPatterns.set('help_screams', {
      frequencyRange: [200, 3000],
      duration: [500, 3000],
      strength: [40, 100],
      confidence: 90
    });

    this.detectionPatterns.set('tapping', {
      frequencyRange: [100, 2000],
      duration: [50, 500],
      strength: [10, 80],
      confidence: 75
    });

    // Vibration patterns
    this.detectionPatterns.set('footsteps', {
      frequencyRange: [10, 100],
      duration: [200, 1000],
      strength: [30, 90],
      confidence: 70
    });

    this.detectionPatterns.set('heartbeat', {
      frequencyRange: [1, 3],
      duration: [800, 1200],
      strength: [5, 30],
      confidence: 60
    });

    // Electronic signals
    this.detectionPatterns.set('cellphone', {
      frequencyRange: [800, 2500],
      duration: [100, 5000],
      strength: [20, 100],
      confidence: 95
    });

    this.detectionPatterns.set('watch_alarm', {
      frequencyRange: [1000, 4000],
      duration: [100, 1000],
      strength: [15, 60],
      confidence: 80
    });

    logger.debug('✅ Survivor detection patterns initialized');
  }

  // CRITICAL: Start Survivor Detection Monitoring
  async startSurvivorDetection(): Promise<boolean> {
    try {
      if (this.isMonitoring) return true;

      logger.debug('👥 Starting survivor detection monitoring...');

      this.isMonitoring = true;

      // Start continuous monitoring
      this.monitoringInterval = setInterval(() => {
        this.performDetectionCycle();
      }, 2000); // Check every 2 seconds

      // Load existing detections
      await this.loadActiveDetections();

      this.emit('survivorDetectionStarted');
      emergencyLogger.logSystem('info', 'Survivor detection monitoring started');

      logger.debug('✅ Survivor detection monitoring started');
      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to start survivor detection', { error: String(error) });
      logger.error('❌ Failed to start survivor detection:', error);
      return false;
    }
  }

  // CRITICAL: Stop Survivor Detection Monitoring
  async stopSurvivorDetection(): Promise<void> {
    try {
      if (!this.isMonitoring) return;

      logger.debug('🛑 Stopping survivor detection monitoring...');

      this.isMonitoring = false;

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      // Save current detections
      await this.saveActiveDetections();

      this.emit('survivorDetectionStopped');
      emergencyLogger.logSystem('info', 'Survivor detection monitoring stopped');

      logger.debug('✅ Survivor detection monitoring stopped');

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error stopping survivor detection', { error: String(error) });
      logger.error('❌ Error stopping survivor detection:', error);
    }
  }

  // CRITICAL: Process New Signal
  async processSignal(signal: SurvivorSignal): Promise<void> {
    try {
      emergencyLogger.logSystem('info', 'Processing survivor signal', { signalId: signal.id, type: signal.type });

      // Validate signal
      if (!this.validateSignal(signal)) {
        logger.warn('⚠️ Invalid signal received:', signal.id);
        return;
      }

      // Add signal to collection
      this.addSurvivorSignal(signal);

      // Check if this signal indicates a new survivor
      await this.analyzeSignalForSurvivor(signal);

      // Update existing detections
      await this.updateExistingDetections();

      this.emit('survivorSignalProcessed', signal);

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error processing survivor signal', { error: String(error) });
      logger.error('❌ Error processing survivor signal:', error);
    }
  }

  // CRITICAL: Analyze Signal for Survivor Detection
  private async analyzeSignalForSurvivor(signal: SurvivorSignal): Promise<void> {
    try {
      // Check if this signal matches existing survivors
      let matchedSurvivor: SurvivorDetection | null = null;

      for (const detection of this.activeDetections.values()) {
        if (this.signalsAreRelated(signal, detection.signals)) {
          matchedSurvivor = detection;
          break;
        }
      }

      if (matchedSurvivor) {
        // Update existing survivor detection
        matchedSurvivor.signals.push(signal);
        matchedSurvivor.lastSignalTime = signal.timestamp;

        // Update priority based on signal strength
        if (signal.strength > 80 && signal.confidence > 90) {
          matchedSurvivor.priority = 'critical';
        } else if (signal.strength > 60 && signal.confidence > 80) {
          matchedSurvivor.priority = 'high';
        }

        this.activeDetections.set(matchedSurvivor.id, matchedSurvivor);

        this.emit('survivorSignalUpdated', matchedSurvivor);
        logger.debug(`👥 Survivor signal updated: ${matchedSurvivor.id}`);

      } else {
        // Create new survivor detection
        const detection: SurvivorDetection = {
          id: `survivor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          survivorId: `person_${Date.now()}`,
          signals: [signal],
          location: signal.location,
          firstDetected: signal.timestamp,
          lastSignalTime: signal.timestamp,
          priority: signal.confidence > 90 ? 'critical' : 'high',
          status: 'detected',
          estimatedSurvivors: 1,
          accessibility: 'unknown',
          estimatedDepth: signal.location.depth || 0,
          notes: [`Survivor detected via ${signal.type} signal`],
        };

        this.activeDetections.set(detection.id, detection);

        this.emit('survivorDetected', detection);
        emergencyLogger.logSystem('info', 'New survivor detected', { 
          detectionId: detection.id, 
          signalType: signal.type,
          location: signal.location 
        });
        logger.debug(`👥 New survivor detected: ${detection.id}`);

        // Auto-trigger rescue operation for critical survivors
        if (detection.priority === 'critical') {
          await this.triggerRescueOperation(detection);
        }
      }

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error analyzing signal for survivor', { error: String(error) });
      logger.error('❌ Error analyzing signal for survivor:', error);
    }
  }

  // CRITICAL: Trigger Rescue Operation
  private async triggerRescueOperation(detection: SurvivorDetection): Promise<void> {
    try {
      logger.debug(`🚁 Triggering rescue operation for survivor: ${detection.id}`);

      // Import rescue coordinator
      const { rescueCoordinator } = await import('../emergency/RescueCoordinator');

      // Create rescue mission
      const missionId = await rescueCoordinator.createRescueOperation({
        type: 'rescue',
        location: detection.location,
        priority: detection.priority,
        estimatedVictims: detection.estimatedSurvivors,
        notes: [`CRITICAL: Survivor detected under debris at ${detection.location.lat}, ${detection.location.lon}. Signals: ${detection.signals.length}`]
      } as any);

      detection.rescueTeam = missionId;
      detection.notes.push(`Rescue operation triggered: ${missionId}`);

      this.emit('rescueOperationTriggered', { detection, missionId });

      logger.debug(`CRITICAL: Survivor detected under debris at ${detection.location.lat}, ${detection.location.lon}. Signals: ${detection.signals.length}`);

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to trigger rescue operation', { error: String(error) });
      logger.error('❌ Failed to trigger rescue operation:', error);
    }
  }

  // CRITICAL: Perform Detection Cycle
  private async performDetectionCycle(): Promise<void> {
    try {
      // Simulate detection of new signals
      if (Math.random() < 0.1) { // 10% chance of detecting a signal
        const mockSignal = this.generateMockSignal();
        await this.processSignal(mockSignal);
      }

      // Analyze signal patterns and update survivor statuses
      for (const detection of this.activeDetections.values()) {
        if (Date.now() - detection.lastSignalTime > 300000) { // 5 minutes
          await this.updateSurvivorStatus(detection);
        }
      }

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error in detection cycle', { error: String(error) });
      logger.error('❌ Error in detection cycle:', error);
    }
  }

  // CRITICAL: Update Survivor Status
  private async updateSurvivorStatus(detection: SurvivorDetection): Promise<void> {
    try {
      const timeSinceLastSignal = Date.now() - detection.lastSignalTime;

      // If no signals for 10 minutes, mark as lost
      if (timeSinceLastSignal > 600000) { // 10 minutes
        detection.status = 'lost';
        this.emit('survivorLost', detection);
        logger.debug(`⚠️ Survivor lost: ${detection.id}`);
      }

      // If we have recent strong signals, confirm survivor
      const recentStrongSignals = detection.signals.filter(signal => 
        signal.timestamp > Date.now() - 300000 && // Last 5 minutes
        signal.strength > 70 &&
        signal.confidence > 80
      );

      if (recentStrongSignals.length >= 3 && detection.status === 'detected') {
        detection.status = 'confirmed';
        this.emit('survivorConfirmed', detection);
        logger.debug(`✅ Survivor confirmed: ${detection.id}`);
      }

      this.activeDetections.set(detection.id, detection);

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error updating survivor status', { error: String(error) });
      logger.error('❌ Error updating survivor status:', error);
    }
  }

  // CRITICAL: Add Survivor Signal
  private addSurvivorSignal(signal: SurvivorSignal): void {
    const signals = this.survivorSignals.get(signal.source) || [];

    signals.push(signal);

    // Keep only recent signals (last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentSignals = signals.filter(s => s.timestamp > oneHourAgo);

    this.survivorSignals.set(signal.source, recentSignals);
  }

  // CRITICAL: Get Active Survivor Detections
  getActiveDetections(): SurvivorDetection[] {
    return Array.from(this.activeDetections.values())
      .filter(detection => detection.status !== 'rescued' && detection.status !== 'lost');
  }

  // CRITICAL: Get Survivor Detection by ID
  getSurvivorDetection(id: string): SurvivorDetection | null {
    return this.activeDetections.get(id) || null;
  }

  // CRITICAL: Update Survivor Detection
  async updateSurvivorDetection(id: string, updates: Partial<SurvivorDetection>): Promise<boolean> {
    try {
      const detection = this.activeDetections.get(id);
      if (!detection) return false;

      Object.assign(detection, updates);

      this.activeDetections.set(id, detection);
      await this.saveActiveDetections();

      this.emit('survivorDetectionUpdated', detection);
      logger.debug(`📝 Survivor detection updated: ${id}`);

      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to update survivor detection', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Mark Survivor as Rescued
  async markSurvivorAsRescued(id: string, rescueNotes?: string): Promise<boolean> {
    try {
      const detection = this.activeDetections.get(id);
      if (!detection) return false;

      detection.status = 'rescued';
      detection.notes.push(`Rescued at ${new Date().toISOString()}`);
      
      if (rescueNotes) {
        detection.notes.push(`Rescue notes: ${rescueNotes}`);
      }

      this.activeDetections.set(id, detection);
      await this.saveActiveDetections();

      this.emit('survivorRescued', detection);
      emergencyLogger.logSystem('info', 'Survivor marked as rescued', { detectionId: id });
      logger.debug(`✅ Survivor rescued: ${id}`);

      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to mark survivor as rescued', { error: String(error) });
      return false;
    }
  }

  // Helper methods
  private validateSignal(signal: SurvivorSignal): boolean {
    return !!(
      signal.id &&
      signal.type &&
      signal.source &&
      signal.location &&
      typeof signal.location.lat === 'number' &&
      typeof signal.location.lon === 'number' &&
      signal.timestamp &&
      signal.strength >= 0 &&
      signal.strength <= 100 &&
      signal.confidence >= 0 &&
      signal.confidence <= 100
    );
  }

  private signalsAreRelated(signal1: SurvivorSignal, signals: SurvivorSignal[]): boolean {
    // Check if signal is from same source
    const sameSource = signals.some(s => s.source === signal1.source);
    if (sameSource) return true;

    // Check if signals are from nearby locations (within 10 meters)
    const nearbySignals = signals.filter(s => {
      const distance = this.calculateDistance(signal1.location, s.location);
      return distance < 10; // 10 meters
    });

    return nearbySignals.length > 0;
  }

  private calculateDistance(loc1: { lat: number; lon: number }, loc2: { lat: number; lon: number }): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = loc1.lat * Math.PI / 180;
    const φ2 = loc2.lat * Math.PI / 180;
    const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
    const Δλ = (loc2.lon - loc1.lon) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private generateMockSignal(): SurvivorSignal {
    const signalTypes: SurvivorSignal['type'][] = ['audio', 'vibration', 'voice', 'electronic'];
    const type = signalTypes[Math.floor(Math.random() * signalTypes.length)];

    return {
      id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      source: `source_${Math.floor(Math.random() * 1000)}`,
      strength: Math.floor(Math.random() * 80) + 20,
      frequency: Math.floor(Math.random() * 3000) + 100,
      duration: Math.floor(Math.random() * 5000) + 100,
      timestamp: Date.now(),
      location: {
        lat: 41.0082 + (Math.random() - 0.5) * 0.01,
        lon: 28.9784 + (Math.random() - 0.5) * 0.01,
        accuracy: Math.floor(Math.random() * 50) + 5,
        depth: Math.floor(Math.random() * 10)
      },
      confidence: Math.floor(Math.random() * 40) + 60
    };
  }

  private async saveActiveDetections(): Promise<void> {
    try {
      const detections = Array.from(this.activeDetections.values());
      await AsyncStorage.setItem('survivor_detections', JSON.stringify(detections));
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to save survivor detections', { error: String(error) });
    }
  }

  private async loadActiveDetections(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('survivor_detections');
      if (stored) {
        const detections: SurvivorDetection[] = JSON.parse(stored);
        for (const detection of detections) {
          this.activeDetections.set(detection.id, detection);
        }
      }
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to load survivor detections', { error: String(error) });
    }
  }

  private async updateExistingDetections(): Promise<void> {
    try {
      // Update timestamps and status for existing detections
      const now = Date.now();
      for (const detection of this.activeDetections.values()) {
        detection.lastUpdated = now;
        
        // Check if detection is still active (within last 5 minutes)
        if (now - detection.firstDetected > 5 * 60 * 1000 && detection.status === 'detected') {
          detection.status = 'lost';
        }
      }
      
      // Save updated detections
      await this.saveActiveDetections();
      
      emergencyLogger.logSystem('info', 'Updated existing survivor detections', { 
        totalDetections: this.activeDetections.size 
      });
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to update existing detections', { error: String(error) });
    }
  }

}

// Export singleton instance
export const survivorDetectionSystem = new SurvivorDetectionSystem();
export default SurvivorDetectionSystem;
