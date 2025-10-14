import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface EmergencyGuidance {
  id: string;
  type: 'earthquake' | 'fire' | 'flood' | 'gas_leak' | 'medical' | 'evacuation' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  steps: GuidanceStep[];
  estimatedDuration: number; // minutes
  priority: number; // 1-10
  location: {
    lat: number;
    lon: number;
  };
  timestamp: number;
  completed: boolean;
}

export interface GuidanceStep {
  id: string;
  order: number;
  title: string;
  description: string;
  action: string;
  estimatedTime: number; // seconds
  completed: boolean;
  critical: boolean;
  tips?: string[];
  warnings?: string[];
}

export interface EmergencyScenario {
  id: string;
  name: string;
  description: string;
  type: EmergencyGuidance['type'];
  triggers: string[];
  guidance: EmergencyGuidance;
  probability: number; // 0-100
}

class EmergencyGuidanceSystem extends SimpleEventEmitter {
  private activeGuidance = new Map<string, EmergencyGuidance>();
  private guidanceHistory: EmergencyGuidance[] = [];
  private emergencyScenarios = new Map<string, EmergencyScenario>();
  private isActive = false;
  private guidanceInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeEmergencyScenarios();
  }

  // CRITICAL: Initialize Emergency Scenarios
  private initializeEmergencyScenarios(): void {
    logger.debug('🎯 Initializing emergency scenarios...');

    // Earthquake scenario
    this.addEmergencyScenario({
      id: 'earthquake_response',
      name: 'Deprem Müdahale Planı',
      description: 'Deprem anında ve sonrasında yapılması gerekenler',
      type: 'earthquake',
      triggers: ['seismic_activity', 'building_shake', 'earthquake_warning'],
      probability: 85,
      guidance: {
        id: 'earthquake_guidance',
        type: 'earthquake',
        severity: 'critical',
        title: '🚨 DEPREM ACİL DURUM REHBERİ',
        description: 'Deprem sırasında ve sonrasında hayatta kalma rehberi',
        steps: [
          {
            id: 'step_1',
            order: 1,
            title: 'Sakin Olun ve Güvenli Yere Geçin',
            description: 'Hemen masa, yatak veya sağlam mobilyaların altına geçin',
            action: 'find_cover',
            estimatedTime: 30,
            completed: false,
            critical: true,
            tips: ['Başınızı koruyun', 'Sarsıntı bitene kadar bekleyin'],
            warnings: ['Asansör kullanmayın', 'Merdivenlerden kaçının']
          },
          {
            id: 'step_2',
            order: 2,
            title: 'Acil Durum Çantanızı Alın',
            description: 'Önceden hazırladığınız acil durum çantasını alın',
            action: 'grab_emergency_kit',
            estimatedTime: 60,
            completed: false,
            critical: true,
            tips: ['Çanta hazır değilse su ve yiyecek alın'],
            warnings: ['Çok fazla eşya almayın']
          },
          {
            id: 'step_3',
            order: 3,
            title: 'Güvenli Çıkış Yolunu Bulun',
            description: 'Bina güvenliyse en kısa yoldan çıkın',
            action: 'find_exit',
            estimatedTime: 120,
            completed: false,
            critical: true,
            tips: ['Önce kapıyı kontrol edin', 'Duman varsa yere yakın kalın'],
            warnings: ['Asansör kullanmayın', 'Acil çıkışları kullanın']
          },
          {
            id: 'step_4',
            order: 4,
            title: 'Açık Alana Geçin',
            description: 'Binalardan uzak, açık bir alana geçin',
            action: 'go_to_open_area',
            estimatedTime: 180,
            completed: false,
            critical: true,
            tips: ['Elektrik direklerinden uzak durun', 'Yüksek binalardan kaçının'],
            warnings: ['Artçı sarsıntılara dikkat edin']
          },
          {
            id: 'step_5',
            order: 5,
            title: 'Acil Durum Ekiplerini Arayın',
            description: '112 acil hat numarasını arayın',
            action: 'call_emergency',
            estimatedTime: 60,
            completed: false,
            critical: true,
            tips: ['Sakin konuşun', 'Konumunuzu belirtin'],
            warnings: ['Telefon hatları yoğun olabilir']
          }
        ],
        estimatedDuration: 10,
        priority: 10,
        location: { lat: 0, lon: 0 },
        timestamp: Date.now(),
        completed: false
      }
    });

    // Fire scenario
    this.addEmergencyScenario({
      id: 'fire_response',
      name: 'Yangın Müdahale Planı',
      description: 'Yangın durumunda yapılması gerekenler',
      type: 'fire',
      triggers: ['smoke_detected', 'fire_alarm', 'heat_sensor'],
      probability: 70,
      guidance: {
        id: 'fire_guidance',
        type: 'fire',
        severity: 'critical',
        title: '🔥 YANGIN ACİL DURUM REHBERİ',
        description: 'Yangın sırasında hayatta kalma rehberi',
        steps: [
          {
            id: 'fire_step_1',
            order: 1,
            title: 'Yangını Tespit Edin',
            description: 'Duman, ısı veya alev belirtilerini kontrol edin',
            action: 'assess_fire',
            estimatedTime: 30,
            completed: false,
            critical: true,
            tips: ['Dumanın rengine dikkat edin', 'Rüzgarın yönünü belirleyin'],
            warnings: ['Kapıları dokunarak kontrol edin']
          },
          {
            id: 'fire_step_2',
            order: 2,
            title: 'Yangın Alarmını Çalıştırın',
            description: 'Mümkünse yangın alarmını çalıştırın',
            action: 'activate_alarm',
            estimatedTime: 15,
            completed: false,
            critical: true,
            tips: ['Alarm çalışmıyorsa sesli uyarı yapın'],
            warnings: ['Zaman kaybetmeyin']
          },
          {
            id: 'fire_step_3',
            order: 3,
            title: 'Güvenli Çıkış Yolunu Bulun',
            description: 'En yakın ve güvenli çıkış yolunu belirleyin',
            action: 'find_safe_exit',
            estimatedTime: 45,
            completed: false,
            critical: true,
            tips: ['Alternatif yollar belirleyin', 'Kapıları kontrol edin'],
            warnings: ['Asansör kullanmayın', 'Dumanlı alanlardan kaçının']
          },
          {
            id: 'fire_step_4',
            order: 4,
            title: 'Çıkış Yapın',
            description: 'Belirlenen güvenli yoldan çıkış yapın',
            action: 'evacuate',
            estimatedTime: 120,
            completed: false,
            critical: true,
            tips: ['Yere yakın kalın', 'Nefesinizi tutun'],
            warnings: ['Kapıları kapatın', 'Koşmayın']
          },
          {
            id: 'fire_step_5',
            order: 5,
            title: 'İtfaiyeyi Arayın',
            description: '110 itfaiye numarasını arayın',
            action: 'call_fire_department',
            estimatedTime: 60,
            completed: false,
            critical: true,
            tips: ['Yangının yerini belirtin', 'Yaralı varsa söyleyin'],
            warnings: ['Önce kendinizi kurtarın']
          }
        ],
        estimatedDuration: 8,
        priority: 9,
        location: { lat: 0, lon: 0 },
        timestamp: Date.now(),
        completed: false
      }
    });

    logger.debug('✅ Emergency scenarios initialized');
  }

  // CRITICAL: Start Guidance System
  async startGuidanceSystem(): Promise<boolean> {
    try {
      if (this.isActive) return true;

      logger.debug('🎯 Starting emergency guidance system...');
      this.isActive = true;

      // Start guidance monitoring
      this.guidanceInterval = setInterval(() => {
        this.performGuidanceMonitoring();
      }, 10000); // Every 10 seconds

      // Load guidance history
      await this.loadGuidanceHistory();

      this.emit('guidanceSystemStarted');
      emergencyLogger.logSystem('info', 'Emergency guidance system started');

      logger.debug('✅ Emergency guidance system started');
      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to start guidance system', { error: String(error) });
      logger.error('❌ Failed to start guidance system:', error);
      return false;
    }
  }

  // CRITICAL: Add Emergency Scenario
  addEmergencyScenario(scenario: EmergencyScenario): void {
    try {
      this.emergencyScenarios.set(scenario.id, scenario);
      emergencyLogger.logSystem('info', 'Emergency scenario added', { scenarioId: scenario.id, name: scenario.name });
      logger.debug(`📋 Emergency scenario added: ${scenario.name}`);
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to add emergency scenario', { error: String(error) });
    }
  }

  // CRITICAL: Trigger Emergency Guidance
  async triggerEmergencyGuidance(type: EmergencyGuidance['type'], location: { lat: number; lon: number }): Promise<string | null> {
    try {
      logger.debug(`🎯 Triggering emergency guidance for: ${type}`);

      // Find matching scenario
      const scenario = this.findMatchingScenario(type);
      if (!scenario) {
        logger.warn(`⚠️ No guidance scenario found for type: ${type}`);
        return null;
      }

      // Create guidance instance
      const guidance: EmergencyGuidance = {
        ...scenario.guidance,
        id: `guidance_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        location,
        timestamp: Date.now(),
        completed: false
      };

      // Add to active guidance
      this.activeGuidance.set(guidance.id, guidance);

      // Add to history
      this.guidanceHistory.push(guidance);

      // Save history
      await this.saveGuidanceHistory();

      this.emit('emergencyGuidanceTriggered', guidance);
      emergencyLogger.logSystem('info', 'Emergency guidance triggered', {
        guidanceId: guidance.id,
        type: guidance.type,
        severity: guidance.severity
      });

      logger.debug(`✅ Emergency guidance triggered: ${guidance.title}`);
      return guidance.id;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to trigger emergency guidance', { error: String(error) });
      logger.error('❌ Failed to trigger emergency guidance:', error);
      return null;
    }
  }

  // CRITICAL: Find Matching Scenario
  private findMatchingScenario(type: EmergencyGuidance['type']): EmergencyScenario | null {
    for (const scenario of this.emergencyScenarios.values()) {
      if (scenario.type === type) {
        return scenario;
      }
    }
    return null;
  }

  // CRITICAL: Complete Guidance Step
  async completeGuidanceStep(guidanceId: string, stepId: string): Promise<boolean> {
    try {
      const guidance = this.activeGuidance.get(guidanceId);
      if (!guidance) return false;

      const step = guidance.steps.find(s => s.id === stepId);
      if (!step) return false;

      step.completed = true;
      guidance.steps = [...guidance.steps]; // Trigger re-render

      // Update guidance
      this.activeGuidance.set(guidanceId, guidance);

      this.emit('guidanceStepCompleted', { guidanceId, stepId, step });
      emergencyLogger.logSystem('info', 'Guidance step completed', { guidanceId, stepId });

      // Check if all steps are completed
      const allCompleted = guidance.steps.every(s => s.completed);
      if (allCompleted) {
        await this.completeGuidance(guidanceId);
      }

      logger.debug(`✅ Guidance step completed: ${step.title}`);
      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to complete guidance step', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Complete Guidance
  private async completeGuidance(guidanceId: string): Promise<void> {
    try {
      const guidance = this.activeGuidance.get(guidanceId);
      if (!guidance) return;

      guidance.completed = true;
      this.activeGuidance.delete(guidanceId);

      // Update history
      const historyIndex = this.guidanceHistory.findIndex(g => g.id === guidanceId);
      if (historyIndex !== -1) {
        this.guidanceHistory[historyIndex] = guidance;
      }

      await this.saveGuidanceHistory();

      this.emit('guidanceCompleted', guidance);
      emergencyLogger.logSystem('info', 'Emergency guidance completed', { guidanceId });

      logger.debug(`🎉 Emergency guidance completed: ${guidance.title}`);

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to complete guidance', { error: String(error) });
    }
  }

  // CRITICAL: Get Active Guidance
  getActiveGuidance(): EmergencyGuidance[] {
    return Array.from(this.activeGuidance.values());
  }

  // CRITICAL: Get Guidance by ID
  getGuidance(guidanceId: string): EmergencyGuidance | null {
    return this.activeGuidance.get(guidanceId) || null;
  }

  // CRITICAL: Get Guidance History
  getGuidanceHistory(): EmergencyGuidance[] {
    return [...this.guidanceHistory].sort((a, b) => b.timestamp - a.timestamp);
  }

  // CRITICAL: Get Emergency Scenarios
  getEmergencyScenarios(): EmergencyScenario[] {
    return Array.from(this.emergencyScenarios.values());
  }

  // CRITICAL: Perform Guidance Monitoring
  private async performGuidanceMonitoring(): Promise<void> {
    try {
      // Check for completed guidance
      for (const [guidanceId, guidance] of this.activeGuidance) {
        const timeElapsed = Date.now() - guidance.timestamp;
        const estimatedDuration = guidance.estimatedDuration * 60 * 1000; // Convert to milliseconds

        // If guidance has been active longer than estimated duration
        if (timeElapsed > estimatedDuration) {
          logger.debug(`⚠️ Guidance timeout: ${guidance.title}`);
          
          // Send timeout notification
          this.emit('guidanceTimeout', guidance);
        }
      }

    } catch (error) {
      emergencyLogger.logSystem('error', 'Guidance monitoring failed', { error: String(error) });
    }
  }

  // CRITICAL: Save Guidance History
  private async saveGuidanceHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('guidance_history', JSON.stringify(this.guidanceHistory));
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to save guidance history', { error: String(error) });
    }
  }

  // CRITICAL: Load Guidance History
  private async loadGuidanceHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('guidance_history');
      if (stored) {
        this.guidanceHistory = JSON.parse(stored);
      }
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to load guidance history', { error: String(error) });
    }
  }

  // CRITICAL: Stop Guidance System
  async stopGuidanceSystem(): Promise<void> {
    try {
      if (!this.isActive) return;

      logger.debug('🛑 Stopping guidance system...');
      this.isActive = false;

      if (this.guidanceInterval) {
        clearInterval(this.guidanceInterval);
        this.guidanceInterval = null;
      }

      this.emit('guidanceSystemStopped');
      emergencyLogger.logSystem('info', 'Emergency guidance system stopped');

      logger.debug('✅ Emergency guidance system stopped');

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error stopping guidance system', { error: String(error) });
      logger.error('❌ Error stopping guidance system:', error);
    }
  }

  // CRITICAL: Get System Status
  getSystemStatus(): {
    isActive: boolean;
    activeGuidance: number;
    totalScenarios: number;
    completedGuidance: number;
  } {
    return {
      isActive: this.isActive,
      activeGuidance: this.activeGuidance.size,
      totalScenarios: this.emergencyScenarios.size,
      completedGuidance: this.guidanceHistory.filter(g => g.completed).length
    };
  }
}

// Export singleton instance
export const emergencyGuidanceSystem = new EmergencyGuidanceSystem();
export default EmergencyGuidanceSystem;










