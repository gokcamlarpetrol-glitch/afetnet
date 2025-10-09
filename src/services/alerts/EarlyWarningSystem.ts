import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';

export interface EarthquakeWarning {
  id: string;
  type: 'earthquake' | 'tsunami' | 'aftershock' | 'landslide';
  severity: 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme';
  magnitude?: number; // Richter scale
  epicenter: {
    lat: number;
    lon: number;
    depth: number; // km
  };
  affectedArea: {
    radius: number; // km
    population: number;
    cities: string[];
  };
  estimatedArrival: number; // seconds until impact
  intensity: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X' | 'XI' | 'XII'; // Modified Mercalli Scale
  source: string; // AFAD, USGS, etc.
  confidence: number; // 0-100
  timestamp: number;
  expiresAt: number;
}

export interface EmergencyAlert {
  id: string;
  type: 'evacuation' | 'shelter_in_place' | 'medical_emergency' | 'fire' | 'gas_leak' | 'structural_damage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  location: {
    lat: number;
    lon: number;
    radius: number; // meters
  };
  instructions: string[];
  estimatedDuration: number; // minutes
  source: string;
  timestamp: number;
  expiresAt: number;
  acknowledged: boolean;
  actions: EmergencyAction[];
}

export interface EmergencyAction {
  id: string;
  type: 'evacuate' | 'shelter' | 'avoid' | 'prepare' | 'monitor';
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number; // minutes
  requiredItems: string[];
  instructions: string[];
}

export interface SafetyZone {
  id: string;
  name: string;
  type: 'evacuation_center' | 'safe_building' | 'open_space' | 'medical_facility';
  location: {
    lat: number;
    lon: number;
  };
  capacity: number;
  currentOccupancy: number;
  facilities: string[];
  accessibility: 'accessible' | 'limited' | 'not_accessible';
  status: 'open' | 'full' | 'closed' | 'damaged';
  contact: string;
  distance: number; // meters from user
}

class EarlyWarningSystem extends SimpleEventEmitter {
  private activeWarnings = new Map<string, EarthquakeWarning>();
  private activeAlerts = new Map<string, EmergencyAlert>();
  private safetyZones = new Map<string, SafetyZone>();
  private userLocation: { lat: number; lon: number } | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeSafetyZones();
  }

  private async initializeSafetyZones() {
    console.log('🚨 Initializing Early Warning System...');

    // Pre-defined safety zones for Istanbul
    const zones: SafetyZone[] = [
      {
        id: 'zone_1',
        name: 'Taksim Meydanı',
        type: 'open_space',
        location: { lat: 41.0369, lon: 28.9850 },
        capacity: 10000,
        currentOccupancy: 0,
        facilities: ['water', 'toilets', 'first_aid'],
        accessibility: 'accessible',
        status: 'open',
        contact: '+90 212 123 4567',
        distance: 0,
      },
      {
        id: 'zone_2',
        name: 'Sultanahmet Meydanı',
        type: 'open_space',
        location: { lat: 41.0055, lon: 28.9769 },
        capacity: 8000,
        currentOccupancy: 0,
        facilities: ['water', 'toilets'],
        accessibility: 'accessible',
        status: 'open',
        contact: '+90 212 234 5678',
        distance: 0,
      },
      {
        id: 'zone_3',
        name: 'İstanbul Üniversitesi',
        type: 'safe_building',
        location: { lat: 41.0082, lon: 28.9784 },
        capacity: 5000,
        currentOccupancy: 0,
        facilities: ['water', 'toilets', 'first_aid', 'food'],
        accessibility: 'accessible',
        status: 'open',
        contact: '+90 212 345 6789',
        distance: 0,
      },
    ];

    zones.forEach(zone => {
      this.safetyZones.set(zone.id, zone);
    });

    console.log('✅ Early Warning System initialized');
  }

  // CRITICAL: Start Early Warning Monitoring
  async startEarlyWarningMonitoring(): Promise<boolean> {
    if (this.isMonitoring) return true;

    try {
      console.log('🚨 Starting early warning monitoring...');

      // Get user location
      this.userLocation = await this.getCurrentLocation();

      // Start monitoring for earthquake warnings
      this.monitoringInterval = setInterval(async () => {
        await this.checkForEarthquakeWarnings();
      }, 10000); // Check every 10 seconds

      // Start monitoring for emergency alerts
      this.alertCheckInterval = setInterval(async () => {
        await this.checkForEmergencyAlerts();
      }, 30000); // Check every 30 seconds

      this.isMonitoring = true;
      this.emit('earlyWarningStarted');
      
      console.log('✅ Early warning monitoring started');
      return true;

    } catch (error) {
      console.error('❌ Failed to start early warning monitoring:', error);
      return false;
    }
  }

  // CRITICAL: Stop Early Warning Monitoring
  async stopEarlyWarningMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    try {
      console.log('🛑 Stopping early warning monitoring...');

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      if (this.alertCheckInterval) {
        clearInterval(this.alertCheckInterval);
        this.alertCheckInterval = null;
      }

      this.isMonitoring = false;
      this.emit('earlyWarningStopped');
      
      console.log('✅ Early warning monitoring stopped');

    } catch (error) {
      console.error('❌ Error stopping early warning monitoring:', error);
    }
  }

  // CRITICAL: Check for Earthquake Warnings
  private async checkForEarthquakeWarnings(): Promise<void> {
    try {
      // In a real implementation, this would connect to AFAD, USGS, or other seismic monitoring services
      // For now, we'll simulate earthquake detection
      
      const randomWarning = Math.random();
      
      if (randomWarning > 0.98) { // 2% chance of detecting a warning
        await this.generateSimulatedEarthquakeWarning();
      }

    } catch (error) {
      console.error('❌ Error checking for earthquake warnings:', error);
    }
  }

  // CRITICAL: Generate Simulated Earthquake Warning
  private async generateSimulatedEarthquakeWarning(): Promise<void> {
    const magnitudes = [4.5, 5.2, 6.1, 6.8, 7.3];
    const magnitude = magnitudes[Math.floor(Math.random() * magnitudes.length)];
    
    const warning: EarthquakeWarning = {
      id: `warning_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'earthquake',
      severity: this.getSeverityFromMagnitude(magnitude),
      magnitude,
      epicenter: {
        lat: 40.8 + Math.random() * 0.4, // Istanbul area
        lon: 28.6 + Math.random() * 0.6,
        depth: Math.random() * 20 + 5, // 5-25 km depth
      },
      affectedArea: {
        radius: this.getAffectedRadius(magnitude),
        population: Math.floor(Math.random() * 1000000) + 100000,
        cities: ['İstanbul', 'Kocaeli', 'Sakarya'],
      },
      estimatedArrival: Math.floor(Math.random() * 30) + 10, // 10-40 seconds
      intensity: this.getIntensityFromMagnitude(magnitude),
      source: 'AFAD',
      confidence: Math.floor(Math.random() * 20) + 80, // 80-100% confidence
      timestamp: Date.now(),
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
    };

    this.activeWarnings.set(warning.id, warning);

    // Check if warning affects user location
    if (this.userLocation && this.isLocationAffected(this.userLocation, warning)) {
      await this.processEarthquakeWarning(warning);
    }

    this.emit('earthquakeWarningReceived', warning);
    console.log(`🌍 Earthquake warning received: ${warning.severity} (${magnitude} magnitude)`);
  }

  // CRITICAL: Process Earthquake Warning
  private async processEarthquakeWarning(warning: EarthquakeWarning): Promise<void> {
    console.log(`🚨 PROCESSING EARTHQUAKE WARNING: ${warning.severity} severity`);

    // Generate emergency actions based on warning
    const actions = this.generateEmergencyActions(warning);
    
    // Create emergency alert
    const alert: EmergencyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: warning.severity === 'extreme' || warning.severity === 'severe' ? 'evacuation' : 'shelter_in_place',
      severity: warning.severity === 'extreme' ? 'critical' : warning.severity === 'severe' ? 'high' : 'medium',
      title: `DEPREM UYARISI - ${warning.severity.toUpperCase()}`,
      message: `${warning.magnitude} büyüklüğünde deprem uyarısı! Tahmini varış süresi: ${warning.estimatedArrival} saniye`,
      location: {
        lat: this.userLocation!.lat,
        lon: this.userLocation!.lon,
        radius: 1000,
      },
      instructions: [
        warning.severity === 'extreme' || warning.severity === 'severe' ? 
          'Hemen güvenli bir alana çıkın!' : 
          'Güvenli bir yerde kalın',
        'Başınızı koruyun',
        'Ağır eşyalardan uzak durun',
        'Elektrik ve gazı kapatın',
        'Acil durum çantasını alın',
      ],
      estimatedDuration: this.getEstimatedDuration(warning),
      source: 'AfetNet Early Warning System',
      timestamp: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour default
      acknowledged: false,
      actions,
    };

    this.activeAlerts.set(alert.id, alert);

    // Send immediate notifications
    await this.sendEmergencyNotifications(alert);

    // Auto-trigger panic mode for extreme warnings
    if (warning.severity === 'extreme') {
      await this.triggerEmergencyPanicMode(warning);
    }

    this.emit('emergencyAlertCreated', alert);
    console.log(`🚨 Emergency alert created: ${alert.title}`);
  }

  // CRITICAL: Check for Emergency Alerts
  private async checkForEmergencyAlerts(): Promise<void> {
    try {
      // Check for expired alerts
      const now = Date.now();
      for (const [id, alert] of this.activeAlerts.entries()) {
        if (now > alert.expiresAt) {
          this.activeAlerts.delete(id);
          this.emit('emergencyAlertExpired', alert);
        }
      }

      // Check for expired warnings
      for (const [id, warning] of this.activeWarnings.entries()) {
        if (now > warning.expiresAt) {
          this.activeWarnings.delete(id);
          this.emit('earthquakeWarningExpired', warning);
        }
      }

    } catch (error) {
      console.error('❌ Error checking for emergency alerts:', error);
    }
  }

  // CRITICAL: Generate Emergency Actions
  private generateEmergencyActions(warning: EarthquakeWarning): EmergencyAction[] {
    const actions: EmergencyAction[] = [];

    if (warning.severity === 'extreme' || warning.severity === 'severe') {
      actions.push({
        id: 'evacuate_immediately',
        type: 'evacuate',
        description: 'Hemen tahliye edin',
        urgency: 'critical',
        estimatedTime: 5,
        requiredItems: ['Acil durum çantası', 'Su', 'İlaçlar'],
        instructions: [
          'En yakın güvenli alana gidin',
          'Asansör kullanmayın',
          'Merdivenden çıkın',
          'Açık alanda bekleyin',
        ],
      });
    } else {
      actions.push({
        id: 'shelter_in_place',
        type: 'shelter',
        description: 'Güvenli yerde kalın',
        urgency: 'high',
        estimatedTime: 10,
        requiredItems: ['Su', 'İlaçlar', 'Fener'],
        instructions: [
          'Güvenli bir yerde bekleyin',
          'Başınızı koruyun',
          'Ağır eşyalardan uzak durun',
          'Elektrik ve gazı kapatın',
        ],
      });
    }

    actions.push({
      id: 'prepare_emergency_kit',
      type: 'prepare',
      description: 'Acil durum çantasını hazırlayın',
      urgency: 'medium',
      estimatedTime: 15,
      requiredItems: ['Su', 'Yiyecek', 'İlaçlar', 'Fener', 'Radyo'],
      instructions: [
        'Su şişelerini alın',
        'Konserve yiyecekleri alın',
        'İlaçlarınızı alın',
        'Fener ve pilleri alın',
      ],
    });

    return actions;
  }

  // CRITICAL: Send Emergency Notifications
  private async sendEmergencyNotifications(alert: EmergencyAlert): Promise<void> {
    try {
      console.log(`📢 Sending emergency notifications: ${alert.title}`);

      // Send via offline message manager (simplified for Expo Go)
      console.log(`EMERGENCY ALERT: ${alert.message}`);
      
      // Send location-based alert (simplified)
      console.log(`Location alert: ${alert.location.lat}, ${alert.location.lon}`);

      // Send to emergency contacts (simplified for Expo Go)
      console.log(`📢 Alert would be sent to emergency contacts: ${alert.message}`);

    } catch (error) {
      console.error('❌ Error sending emergency notifications:', error);
    }
  }

  // CRITICAL: Trigger Emergency Panic Mode
  private async triggerEmergencyPanicMode(warning: EarthquakeWarning): Promise<void> {
    try {
      console.log('🚨 Triggering emergency panic mode for extreme earthquake warning');

      // Panic mode activation (simplified for Expo Go)
      console.log('🚨 Triggering emergency panic mode for extreme earthquake warning');
      
      // Send immediate SOS (simplified)
      console.log(`EXTREME EARTHQUAKE WARNING: ${warning.magnitude} magnitude earthquake approaching! Immediate evacuation required!`);

    } catch (error) {
      console.error('❌ Error triggering emergency panic mode:', error);
    }
  }

  // CRITICAL: Get Nearest Safety Zones
  getNearestSafetyZones(limit: number = 5): SafetyZone[] {
    if (!this.userLocation) return [];

    const zones = Array.from(this.safetyZones.values())
      .filter(zone => zone.status === 'open')
      .map(zone => ({
        ...zone,
        distance: this.calculateDistance(this.userLocation!, zone.location),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return zones;
  }

  // CRITICAL: Get Active Warnings
  getActiveWarnings(): EarthquakeWarning[] {
    const now = Date.now();
    return Array.from(this.activeWarnings.values())
      .filter(warning => now < warning.expiresAt);
  }

  // CRITICAL: Get Active Alerts
  getActiveAlerts(): EmergencyAlert[] {
    const now = Date.now();
    return Array.from(this.activeAlerts.values())
      .filter(alert => now < alert.expiresAt);
  }

  // CRITICAL: Acknowledge Alert
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.activeAlerts.set(alertId, alert);

    this.emit('alertAcknowledged', alert);
    console.log(`✅ Alert acknowledged: ${alert.title}`);

    return true;
  }

  // CRITICAL: Create Custom Emergency Alert
  async createEmergencyAlert(alert: Omit<EmergencyAlert, 'id' | 'timestamp' | 'expiresAt' | 'acknowledged'>): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const newAlert: EmergencyAlert = {
      ...alert,
      id: alertId,
      timestamp: Date.now(),
      expiresAt: Date.now() + alert.estimatedDuration * 60 * 1000,
      acknowledged: false,
    };

    this.activeAlerts.set(alertId, newAlert);

    // Send notifications
    await this.sendEmergencyNotifications(newAlert);

    this.emit('customEmergencyAlertCreated', newAlert);
    console.log(`🚨 Custom emergency alert created: ${newAlert.title}`);

    return alertId;
  }

  // Private helper methods
  private getSeverityFromMagnitude(magnitude: number): EarthquakeWarning['severity'] {
    if (magnitude >= 7.0) return 'extreme';
    if (magnitude >= 6.0) return 'severe';
    if (magnitude >= 5.0) return 'strong';
    if (magnitude >= 4.0) return 'moderate';
    return 'minor';
  }

  private getAffectedRadius(magnitude: number): number {
    // Rough estimation of affected radius in km
    return Math.pow(10, magnitude - 2) * 10;
  }

  private getIntensityFromMagnitude(magnitude: number): EarthquakeWarning['intensity'] {
    if (magnitude >= 8.0) return 'X';
    if (magnitude >= 7.0) return 'VIII';
    if (magnitude >= 6.0) return 'VII';
    if (magnitude >= 5.0) return 'VI';
    if (magnitude >= 4.0) return 'V';
    return 'IV';
  }

  private getEstimatedDuration(warning: EarthquakeWarning): number {
    // Estimated duration in minutes based on magnitude
    if (warning.magnitude! >= 7.0) return 120; // 2 hours
    if (warning.magnitude! >= 6.0) return 60;  // 1 hour
    if (warning.magnitude! >= 5.0) return 30;  // 30 minutes
    return 15; // 15 minutes
  }

  private isLocationAffected(location: { lat: number; lon: number }, warning: EarthquakeWarning): boolean {
    const distance = this.calculateDistance(location, warning.epicenter);
    return distance <= warning.affectedArea.radius * 1000; // Convert km to meters
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

  private async getCurrentLocation(): Promise<{ lat: number; lon: number }> {
    // In a real implementation, this would use GPS
    return {
      lat: 41.0082 + (Math.random() - 0.5) * 0.01,
      lon: 28.9784 + (Math.random() - 0.5) * 0.01,
    };
  }
}

// Export singleton instance
export const earlyWarningSystem = new EarlyWarningSystem();
export default EarlyWarningSystem;
