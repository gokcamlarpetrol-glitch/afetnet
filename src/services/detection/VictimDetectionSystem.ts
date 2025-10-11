import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';

export interface VictimSignal {
  id: string;
  type: 'acoustic' | 'thermal' | 'vibration' | 'voice' | 'movement';
  strength: number; // 0-100
  frequency: number; // Hz
  location: {
    lat: number;
    lon: number;
    accuracy: number;
    depth?: number; // meters under debris
  };
  timestamp: number;
  confidence: number; // 0-100
  source: string; // device ID
  metadata: {
    temperature?: number; // for thermal detection
    soundLevel?: number; // dB
    vibrationIntensity?: number; // g-force
    voicePattern?: string; // detected words
    movementType?: 'breathing' | 'struggling' | 'conscious' | 'unconscious';
  };
}

export interface VictimDetection {
  id: string;
  victimId: string;
  signals: VictimSignal[];
  status: 'detected' | 'confirmed' | 'rescued' | 'lost';
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: {
    lat: number;
    lon: number;
    accuracy: number;
    depth: number;
  };
  estimatedVictims: number;
  lastSignalTime: number;
  rescueTeamAssigned: string[];
  rescueStatus: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  notes: string[];
}

export interface AcousticPattern {
  pattern: string;
  description: string;
  frequency: number;
  duration: number;
  confidence: number;
}

class VictimDetectionSystem extends SimpleEventEmitter {
  private activeDetections = new Map<string, VictimDetection>();
  private victimSignals = new Map<string, VictimSignal[]>();
  private acousticPatterns = new Map<string, AcousticPattern>();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private signalProcessingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeAcousticPatterns();
  }

  private initializeAcousticPatterns() {
    logger.debug('🌡️ Initializing Victim Detection System...');

    const patterns: AcousticPattern[] = [
      {
        pattern: 'help',
        description: 'Yardım çağrısı',
        frequency: 2000,
        duration: 1000,
        confidence: 0.9,
      },
      {
        pattern: 'sos',
        description: 'SOS sinyali',
        frequency: 1500,
        duration: 500,
        confidence: 0.95,
      },
      {
        pattern: 'breathing',
        description: 'Nefes alma sesi',
        frequency: 500,
        duration: 2000,
        confidence: 0.7,
      },
      {
        pattern: 'tapping',
        description: 'Vurma sesi',
        frequency: 3000,
        duration: 200,
        confidence: 0.8,
      },
      {
        pattern: 'crying',
        description: 'Ağlama sesi',
        frequency: 800,
        duration: 3000,
        confidence: 0.85,
      },
      {
        pattern: 'screaming',
        description: 'Çığlık sesi',
        frequency: 4000,
        duration: 1000,
        confidence: 0.9,
      },
    ];

    patterns.forEach(pattern => {
      this.acousticPatterns.set(pattern.pattern, pattern);
    });

    logger.debug('✅ Victim detection patterns initialized');
  }

  // CRITICAL: Start Victim Detection Monitoring
  async startVictimDetection(): Promise<boolean> {
    if (this.isMonitoring) return true;

    try {
      logger.debug('🌡️ Starting victim detection monitoring...');

      // Start acoustic monitoring
      await this.startAcousticMonitoring();
      
      // Start thermal monitoring
      await this.startThermalMonitoring();
      
      // Start vibration monitoring
      await this.startVibrationMonitoring();

      // Start signal processing
      this.startSignalProcessing();

      this.isMonitoring = true;
      this.emit('victimDetectionStarted');
      
      logger.debug('✅ Victim detection monitoring started');
      return true;

    } catch (error) {
      logger.error('❌ Failed to start victim detection:', error);
      return false;
    }
  }

  // CRITICAL: Stop Victim Detection Monitoring
  async stopVictimDetection(): Promise<void> {
    if (!this.isMonitoring) return;

    try {
      logger.debug('🛑 Stopping victim detection monitoring...');

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      if (this.signalProcessingInterval) {
        clearInterval(this.signalProcessingInterval);
        this.signalProcessingInterval = null;
      }

      this.isMonitoring = false;
      this.emit('victimDetectionStopped');
      
      logger.debug('✅ Victim detection monitoring stopped');

    } catch (error) {
      logger.error('❌ Error stopping victim detection:', error);
    }
  }

  // CRITICAL: Start Acoustic Monitoring
  private async startAcousticMonitoring(): Promise<void> {
    try {
      logger.debug('🔊 Starting acoustic monitoring...');

      // Simulate acoustic monitoring
      this.monitoringInterval = setInterval(async () => {
        await this.scanForAcousticSignals();
      }, 2000); // Scan every 2 seconds

    } catch (error) {
      logger.warn('⚠️ Acoustic monitoring not available:', error);
    }
  }

  // CRITICAL: Start Thermal Monitoring
  private async startThermalMonitoring(): Promise<void> {
    try {
      logger.debug('🌡️ Starting thermal monitoring...');

      // In a real implementation, this would use thermal sensors
      // For now, we'll simulate thermal detection

    } catch (error) {
      logger.warn('⚠️ Thermal monitoring not available:', error);
    }
  }

  // CRITICAL: Start Vibration Monitoring
  private async startVibrationMonitoring(): Promise<void> {
    try {
      logger.debug('📳 Starting vibration monitoring...');

      // In a real implementation, this would use accelerometer for vibration detection
      // For now, we'll simulate vibration detection

    } catch (error) {
      logger.warn('⚠️ Vibration monitoring not available:', error);
    }
  }

  // CRITICAL: Scan for Acoustic Signals
  private async scanForAcousticSignals(): Promise<void> {
    try {
      // Simulate acoustic signal detection
      const randomSignal = Math.random();
      
      if (randomSignal > 0.95) { // 5% chance of detecting a signal
        const signalType = ['help', 'breathing', 'tapping', 'sos'][Math.floor(Math.random() * 4)];
        const pattern = this.acousticPatterns.get(signalType);
        
        if (pattern) {
          await this.processAcousticSignal(pattern);
        }
      }

    } catch (error) {
      logger.error('❌ Error scanning for acoustic signals:', error);
    }
  }

  // CRITICAL: Process Acoustic Signal
  private async processAcousticSignal(pattern: AcousticPattern): Promise<void> {
    const signal: VictimSignal = {
      id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'acoustic',
      strength: Math.floor(pattern.confidence * 100),
      frequency: pattern.frequency,
      location: { ...await this.getCurrentLocation(), depth: 0 },
      timestamp: Date.now(),
      confidence: Math.floor(pattern.confidence * 100),
      source: await this.getDeviceId(),
      metadata: {
        soundLevel: Math.floor(Math.random() * 80) + 20, // 20-100 dB
        voicePattern: pattern.pattern,
      },
    };

    // Add signal to processing queue
    this.addVictimSignal(signal);

    // Check if this signal indicates a new victim
    await this.analyzeSignalForVictim(signal);

    logger.debug(`🔊 Acoustic signal detected: ${pattern.description} (${signal.confidence}% confidence)`);
  }

  // CRITICAL: Analyze Signal for Victim Detection
  private async analyzeSignalForVictim(signal: VictimSignal): Promise<void> {
    try {
      // Check if this signal matches existing victims
      let matchedVictim: VictimDetection | null = null;
      
      for (const detection of this.activeDetections.values()) {
        const distance = this.calculateDistance(signal.location, detection.location);
        
        if (distance < 10 && detection.status !== 'rescued') { // Within 10 meters
          matchedVictim = detection;
          break;
        }
      }

      if (matchedVictim) {
        // Update existing victim detection
        matchedVictim.signals.push(signal);
        matchedVictim.lastSignalTime = signal.timestamp;
        
        // Update priority based on signal strength
        if (signal.confidence > 80) {
          matchedVictim.priority = 'critical';
        } else if (signal.confidence > 60) {
          matchedVictim.priority = 'high';
        }

        this.activeDetections.set(matchedVictim.id, matchedVictim);
        
        this.emit('victimSignalUpdated', matchedVictim);
        logger.debug(`👤 Victim signal updated: ${matchedVictim.id}`);

      } else {
        // Create new victim detection
        const detection: VictimDetection = {
          id: `victim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          victimId: `person_${Date.now()}`,
          signals: [signal],
          status: 'detected',
          priority: signal.confidence > 80 ? 'critical' : signal.confidence > 60 ? 'high' : 'medium',
          location: { ...signal.location, depth: signal.location.depth || 0 } as any,
          estimatedVictims: 1,
          lastSignalTime: signal.timestamp,
          rescueTeamAssigned: [],
          rescueStatus: 'not_started',
          notes: [`Victim detected via ${signal.type} signal`],
        };

        this.activeDetections.set(detection.id, detection);
        
        this.emit('victimDetected', detection);
        logger.debug(`👤 New victim detected: ${detection.id}`);

        // Auto-trigger rescue operation for critical victims
        if (detection.priority === 'critical') {
          await this.triggerRescueOperation(detection);
        }
      }

    } catch (error) {
      logger.error('❌ Error analyzing signal for victim:', error);
    }
  }

  // CRITICAL: Trigger Rescue Operation
  private async triggerRescueOperation(detection: VictimDetection): Promise<void> {
    try {
      logger.debug(`🚁 Triggering rescue operation for victim: ${detection.id}`);

      // Dynamic imports temporarily disabled for Expo Go compatibility
      // const { rescueGuidanceSystem } = await import('../rescue/RescueGuidanceSystem');
      // const { offlineMessageManager } = await import('../messaging/OfflineMessageManager');

      // Create rescue mission (simplified for Expo Go)
      const mission = {
        id: `mission_${Date.now()}`,
        victimId: detection.victimId,
        name: `Victim ${detection.id}`,
        location: detection.location,
        estimatedDepth: detection.location.depth || 0,
        accessibility: 'accessible',
        lastSeen: detection.lastSignalTime,
      };

      // Send emergency message (simplified for Expo Go)
      logger.debug(`CRITICAL: Victim detected under debris at ${detection.location.lat}, ${detection.location.lon}. Signals: ${detection.signals.length}`);

      detection.rescueStatus = 'in_progress';
      detection.rescueTeamAssigned.push(mission.id);

      this.activeDetections.set(detection.id, detection);

      this.emit('rescueOperationTriggered', { detection, mission });
      logger.debug(`✅ Rescue operation triggered: ${mission.id}`);

    } catch (error) {
      logger.error('❌ Error triggering rescue operation:', error);
    }
  }

  // CRITICAL: Start Signal Processing
  private startSignalProcessing(): void {
    this.signalProcessingInterval = setInterval(async () => {
      await this.processPendingSignals();
    }, 5000); // Process signals every 5 seconds
  }

  // CRITICAL: Process Pending Signals
  private async processPendingSignals(): Promise<void> {
    try {
      // Analyze signal patterns and update victim statuses
      for (const detection of this.activeDetections.values()) {
        if (detection.status === 'detected' || detection.status === 'confirmed') {
          await this.updateVictimStatus(detection);
        }
      }

      // Clean up old signals
      this.cleanupOldSignals();

    } catch (error) {
      logger.error('❌ Error processing pending signals:', error);
    }
  }

  // CRITICAL: Update Victim Status
  private async updateVictimStatus(detection: VictimDetection): Promise<void> {
    const timeSinceLastSignal = Date.now() - detection.lastSignalTime;
    
    // If no signals for more than 5 minutes, mark as lost
    if (timeSinceLastSignal > 5 * 60 * 1000) {
      detection.status = 'lost';
      detection.rescueStatus = 'abandoned';
      
      this.activeDetections.set(detection.id, detection);
      
      this.emit('victimLost', detection);
      logger.debug(`⚠️ Victim lost: ${detection.id}`);
    }
    // If we have recent strong signals, confirm victim
    else if (detection.signals.some(s => s.confidence > 70 && (Date.now() - s.timestamp) < 60000)) {
      if (detection.status === 'detected') {
        detection.status = 'confirmed';
        
        this.activeDetections.set(detection.id, detection);
        
        this.emit('victimConfirmed', detection);
        logger.debug(`✅ Victim confirmed: ${detection.id}`);
      }
    }
  }

  // CRITICAL: Add Victim Signal
  private addVictimSignal(signal: VictimSignal): void {
    const signals = this.victimSignals.get(signal.source) || [];
    signals.push(signal);
    
    // Keep only last 100 signals per source
    if (signals.length > 100) {
      signals.splice(0, signals.length - 100);
    }
    
    this.victimSignals.set(signal.source, signals);
  }

  // CRITICAL: Cleanup Old Signals
  private cleanupOldSignals(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [source, signals] of this.victimSignals.entries()) {
      const recentSignals = signals.filter(s => s.timestamp > cutoffTime);
      this.victimSignals.set(source, recentSignals);
    }
  }

  // CRITICAL: Get Active Victim Detections
  getActiveDetections(): VictimDetection[] {
    return Array.from(this.activeDetections.values()).filter(d => d.status !== 'rescued' && d.status !== 'lost');
  }

  // CRITICAL: Get Victim Detection by ID
  getVictimDetection(id: string): VictimDetection | null {
    return this.activeDetections.get(id) || null;
  }

  // CRITICAL: Update Victim Detection
  async updateVictimDetection(id: string, updates: Partial<VictimDetection>): Promise<boolean> {
    const detection = this.activeDetections.get(id);
    if (!detection) return false;

    Object.assign(detection, updates);
    detection.notes.push(`Updated at ${new Date().toISOString()}: ${JSON.stringify(updates)}`);

    this.activeDetections.set(id, detection);
    
    this.emit('victimDetectionUpdated', detection);
    logger.debug(`📝 Victim detection updated: ${id}`);

    return true;
  }

  // CRITICAL: Mark Victim as Rescued
  async markVictimAsRescued(id: string, rescueNotes?: string): Promise<boolean> {
    const detection = this.activeDetections.get(id);
    if (!detection) return false;

    detection.status = 'rescued';
    detection.rescueStatus = 'completed';
    
    if (rescueNotes) {
      detection.notes.push(`Rescued at ${new Date().toISOString()}: ${rescueNotes}`);
    }

    this.activeDetections.set(id, detection);
    
    this.emit('victimRescued', detection);
    logger.debug(`✅ Victim rescued: ${id}`);

    return true;
  }

  // CRITICAL: Get Acoustic Patterns
  getAcousticPatterns(): AcousticPattern[] {
    return Array.from(this.acousticPatterns.values());
  }

  // CRITICAL: Add Custom Acoustic Pattern
  async addAcousticPattern(pattern: AcousticPattern): Promise<void> {
    this.acousticPatterns.set(pattern.pattern, pattern);
    logger.debug(`🔊 Custom acoustic pattern added: ${pattern.pattern}`);
  }

  // Private helper methods
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

  private async getCurrentLocation(): Promise<{ lat: number; lon: number; accuracy: number }> {
    // In a real implementation, this would use GPS
    return {
      lat: 41.0082 + (Math.random() - 0.5) * 0.01,
      lon: 28.9784 + (Math.random() - 0.5) * 0.01,
      accuracy: 10,
    };
  }

  private async getDeviceId(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem('device_id');
      if (stored) return stored;
      
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await AsyncStorage.setItem('device_id', deviceId);
      return deviceId;
    } catch (error) {
      return `device_${Date.now()}`;
    }
  }
}

// Export singleton instance
export const victimDetectionSystem = new VictimDetectionSystem();
export default VictimDetectionSystem;
