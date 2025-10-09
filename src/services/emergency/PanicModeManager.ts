import AsyncStorage from '@react-native-async-storage/async-storage';
import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';

export interface PanicModeConfig {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  actions: PanicAction[];
  autoActivate: boolean;
  requiresConfirmation: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface PanicAction {
  id: string;
  type: 'sos' | 'location' | 'message' | 'call' | 'notification' | 'system';
  parameters: any;
  delay: number; // seconds
  repeat: boolean;
  repeatInterval: number; // seconds
}

export interface PanicModeSession {
  id: string;
  configId: string;
  activatedAt: number;
  deactivatedAt?: number;
  duration: number; // seconds
  actionsExecuted: string[];
  location: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  batteryLevel: number;
  signalStrength: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: number;
  isActive: boolean;
}

class PanicModeManager extends SimpleEventEmitter {
  private panicConfigs = new Map<string, PanicModeConfig>();
  private activeSessions = new Map<string, PanicModeSession>();
  private emergencyContacts: EmergencyContact[] = [];
  private isPanicModeActive = false;
  private currentSession: PanicModeSession | null = null;
  private actionIntervals = new Map<string, NodeJS.Timeout>();
  private panicButtonCooldown = 0;

  constructor() {
    super();
    this.initializePanicConfigs();
    this.loadEmergencyContacts();
  }

  private initializePanicConfigs() {
    console.log('🚨 Initializing Panic Mode Manager...');

    const panicConfigs: PanicModeConfig[] = [
      {
        id: 'emergency_sos',
        name: 'Acil SOS',
        description: 'Anında yardım talebi gönder',
        triggers: ['panic_button', 'voice_command', 'gesture'],
        actions: [
          {
            id: 'send_sos',
            type: 'sos',
            parameters: { message: 'PANIC MODE: Immediate help needed', priority: 'critical' },
            delay: 0,
            repeat: true,
            repeatInterval: 60,
          },
          {
            id: 'send_location',
            type: 'location',
            parameters: { priority: 'critical' },
            delay: 5,
            repeat: true,
            repeatInterval: 30,
          },
          {
            id: 'notify_contacts',
            type: 'notification',
            parameters: { message: 'PANIC MODE ACTIVATED', contacts: 'all' },
            delay: 10,
            repeat: false,
            repeatInterval: 0,
          },
        ],
        autoActivate: true,
        requiresConfirmation: false,
        priority: 'critical',
      },
      {
        id: 'medical_emergency',
        name: 'Tıbbi Acil Durum',
        description: 'Tıbbi yardım talebi',
        triggers: ['voice_command', 'manual'],
        actions: [
          {
            id: 'send_medical_sos',
            type: 'sos',
            parameters: { message: 'MEDICAL EMERGENCY: Immediate medical help needed', priority: 'critical' },
            delay: 0,
            repeat: true,
            repeatInterval: 120,
          },
          {
            id: 'send_location',
            type: 'location',
            parameters: { priority: 'high' },
            delay: 5,
            repeat: true,
            repeatInterval: 60,
          },
          {
            id: 'notify_family',
            type: 'notification',
            parameters: { message: 'Medical emergency - help needed', contacts: 'family' },
            delay: 15,
            repeat: false,
            repeatInterval: 0,
          },
        ],
        autoActivate: true,
        requiresConfirmation: false,
        priority: 'critical',
      },
      {
        id: 'trapped_emergency',
        name: 'Enkaz Altında',
        description: 'Enkaz altında kaldım',
        triggers: ['voice_command', 'sensor_detection'],
        actions: [
          {
            id: 'send_trapped_sos',
            type: 'sos',
            parameters: { message: 'TRAPPED UNDER DEBRIS: Help needed urgently', priority: 'critical' },
            delay: 0,
            repeat: true,
            repeatInterval: 30,
          },
          {
            id: 'continuous_location',
            type: 'location',
            parameters: { priority: 'critical' },
            delay: 5,
            repeat: true,
            repeatInterval: 15,
          },
          {
            id: 'audio_signal',
            type: 'system',
            parameters: { action: 'play_audio_signal', frequency: 1000 },
            delay: 10,
            repeat: true,
            repeatInterval: 10,
          },
        ],
        autoActivate: true,
        requiresConfirmation: false,
        priority: 'critical',
      },
      {
        id: 'fire_emergency',
        name: 'Yangın Alarmı',
        description: 'Yangın durumu',
        triggers: ['voice_command', 'sensor_detection'],
        actions: [
          {
            id: 'send_fire_alert',
            type: 'sos',
            parameters: { message: 'FIRE EMERGENCY: Fire detected, evacuation needed', priority: 'critical' },
            delay: 0,
            repeat: true,
            repeatInterval: 45,
          },
          {
            id: 'send_location',
            type: 'location',
            parameters: { priority: 'high' },
            delay: 5,
            repeat: true,
            repeatInterval: 20,
          },
          {
            id: 'evacuation_notification',
            type: 'notification',
            parameters: { message: 'FIRE: Evacuate immediately', contacts: 'nearby' },
            delay: 10,
            repeat: true,
            repeatInterval: 60,
          },
        ],
        autoActivate: true,
        requiresConfirmation: false,
        priority: 'critical',
      },
      {
        id: 'gas_leak_emergency',
        name: 'Gaz Sızıntısı',
        description: 'Gaz sızıntısı tespit edildi',
        triggers: ['voice_command', 'sensor_detection'],
        actions: [
          {
            id: 'send_gas_alert',
            type: 'sos',
            parameters: { message: 'GAS LEAK: Gas leak detected, immediate evacuation needed', priority: 'critical' },
            delay: 0,
            repeat: true,
            repeatInterval: 30,
          },
          {
            id: 'send_location',
            type: 'location',
            parameters: { priority: 'critical' },
            delay: 5,
            repeat: true,
            repeatInterval: 15,
          },
          {
            id: 'evacuation_alert',
            type: 'notification',
            parameters: { message: 'GAS LEAK: Evacuate immediately, do not use electrical devices', contacts: 'all' },
            delay: 10,
            repeat: true,
            repeatInterval: 30,
          },
        ],
        autoActivate: true,
        requiresConfirmation: false,
        priority: 'critical',
      },
    ];

    panicConfigs.forEach(config => {
      this.panicConfigs.set(config.id, config);
    });

    console.log('✅ Panic mode configurations initialized');
  }

  // CRITICAL: Activate Panic Mode
  async activatePanicMode(configId: string, trigger: string = 'manual'): Promise<boolean> {
    // Check cooldown
    if (Date.now() - this.panicButtonCooldown < 5000) {
      console.log('⏰ Panic mode cooldown active');
      return false;
    }

    const config = this.panicConfigs.get(configId);
    if (!config) return false;

    try {
      console.log(`🚨 ACTIVATING PANIC MODE: ${config.name}`);

      // Create panic session
      const session: PanicModeSession = {
        id: `panic_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        configId: config.id,
        activatedAt: Date.now(),
        duration: 0,
        actionsExecuted: [],
        location: await this.getCurrentLocation(),
        status: 'active',
        batteryLevel: await this.getBatteryLevel(),
        signalStrength: await this.getSignalStrength(),
      };

      this.currentSession = session;
      this.activeSessions.set(session.id, session);
      this.isPanicModeActive = true;

      // Execute panic actions
      await this.executePanicActions(config, session);

      // Set cooldown
      this.panicButtonCooldown = Date.now();

      this.emit('panicModeActivated', { session, config });
      console.log(`✅ Panic mode activated: ${session.id}`);

      return true;

    } catch (error) {
      console.error('❌ Failed to activate panic mode:', error);
      return false;
    }
  }

  // CRITICAL: Deactivate Panic Mode
  async deactivatePanicMode(sessionId?: string): Promise<boolean> {
    const session = sessionId ? this.activeSessions.get(sessionId) : this.currentSession;
    if (!session || session.status !== 'active') return false;

    try {
      console.log(`🛑 DEACTIVATING PANIC MODE: ${session.id}`);

      // Stop all action intervals
      this.actionIntervals.forEach((interval, actionId) => {
        clearInterval(interval);
        this.actionIntervals.delete(actionId);
      });

      // Update session
      session.status = 'completed';
      session.deactivatedAt = Date.now();
      session.duration = (session.deactivatedAt - session.activatedAt) / 1000;

      // Clear current session if it's the one being deactivated
      if (session.id === this.currentSession?.id) {
        this.currentSession = null;
        this.isPanicModeActive = false;
      }

      // Save session
      await this.savePanicSession(session);

      this.emit('panicModeDeactivated', session);
      console.log(`✅ Panic mode deactivated: ${session.id}`);

      return true;

    } catch (error) {
      console.error('❌ Failed to deactivate panic mode:', error);
      return false;
    }
  }

  // CRITICAL: Execute Panic Actions
  private async executePanicActions(config: PanicModeConfig, session: PanicModeSession): Promise<void> {
    console.log(`🚨 Executing ${config.actions.length} panic actions...`);

    for (const action of config.actions) {
      try {
        // Schedule action execution
        const executeAction = async () => {
          await this.executePanicAction(action, session);
          session.actionsExecuted.push(action.id);
        };

        if (action.delay === 0) {
          // Execute immediately
          await executeAction();
        } else {
          // Schedule execution
          setTimeout(executeAction, action.delay * 1000);
        }

        // Set up repeating actions
        if (action.repeat && action.repeatInterval > 0) {
          const interval = setInterval(async () => {
            await this.executePanicAction(action, session);
            session.actionsExecuted.push(action.id);
          }, action.repeatInterval * 1000);

          this.actionIntervals.set(action.id, interval);
        }

      } catch (error) {
        console.error(`❌ Error executing panic action ${action.id}:`, error);
      }
    }
  }

  // CRITICAL: Execute Individual Panic Action
  private async executePanicAction(action: PanicAction, session: PanicModeSession): Promise<void> {
    console.log(`🚨 Executing panic action: ${action.type}`);

    try {
      switch (action.type) {
        case 'sos':
          await this.sendSOS(action.parameters, session);
          break;

        case 'location':
          await this.sendLocation(action.parameters, session);
          break;

        case 'message':
          await this.sendMessage(action.parameters, session);
          break;

        case 'call':
          await this.makeEmergencyCall(action.parameters, session);
          break;

        case 'notification':
          await this.sendNotification(action.parameters, session);
          break;

        case 'system':
          await this.executeSystemAction(action.parameters, session);
          break;

        default:
          console.warn(`Unknown panic action type: ${action.type}`);
      }

    } catch (error) {
      console.error(`❌ Error executing panic action ${action.id}:`, error);
    }
  }

  // CRITICAL: Send SOS
  private async sendSOS(parameters: any, session: PanicModeSession): Promise<void> {
    const { offlineMessageManager } = await import('../messaging/OfflineMessageManager');
    const { emergencyMeshManager } = await import('./EmergencyMeshManager');

    const message = parameters.message || 'PANIC MODE: Immediate help needed';
    const priority = parameters.priority || 'critical';

    // Send via offline message manager
    await offlineMessageManager.sendSOSMessage(
      session.location,
      message,
      1,
      undefined
    );

    // Send via emergency mesh
    await emergencyMeshManager.sendEmergencySOS(
      session.location,
      message,
      1,
      priority as any
    );

    console.log(`🚨 SOS sent: ${message}`);
  }

  // CRITICAL: Send Location
  private async sendLocation(parameters: any, session: PanicModeSession): Promise<void> {
    const { offlineMessageManager } = await import('../messaging/OfflineMessageManager');

    const priority = parameters.priority || 'high';

    await offlineMessageManager.sendLocationMessage(
      session.location,
      undefined,
      priority as any
    );

    console.log(`📍 Location sent: ${session.location.lat}, ${session.location.lon}`);
  }

  // CRITICAL: Send Message
  private async sendMessage(parameters: any, session: PanicModeSession): Promise<void> {
    const { offlineMessageManager } = await import('../messaging/OfflineMessageManager');

    const message = parameters.message || 'Panic mode message';
    const priority = parameters.priority || 'high';

    await offlineMessageManager.sendTextMessage(
      message,
      undefined,
      priority as any
    );

    console.log(`📨 Message sent: ${message}`);
  }

  // CRITICAL: Make Emergency Call
  private async makeEmergencyCall(parameters: any, session: PanicModeSession): Promise<void> {
    // In a real implementation, this would make actual phone calls
    console.log(`📞 Emergency call made to: ${parameters.phone || 'emergency services'}`);
  }

  // CRITICAL: Send Notification
  private async sendNotification(parameters: any, session: PanicModeSession): Promise<void> {
    const message = parameters.message || 'Panic mode activated';
    const contacts = parameters.contacts || 'all';

    // Send to emergency contacts
    const targetContacts = this.getEmergencyContacts(contacts);
    
    for (const contact of targetContacts) {
      if (contact.isActive) {
        // In a real implementation, this would send actual notifications
        console.log(`📢 Notification sent to ${contact.name}: ${message}`);
      }
    }
  }

  // CRITICAL: Execute System Action
  private async executeSystemAction(parameters: any, session: PanicModeSession): Promise<void> {
    const action = parameters.action;

    switch (action) {
      case 'play_audio_signal':
        await this.playAudioSignal(parameters.frequency || 1000);
        break;

      case 'flash_light':
        await this.flashLight(parameters.duration || 5);
        break;

      case 'vibrate':
        await this.vibrateDevice(parameters.pattern || 'continuous');
        break;

      case 'max_volume':
        await this.setMaxVolume();
        break;

      default:
        console.warn(`Unknown system action: ${action}`);
    }
  }

  // CRITICAL: Add Emergency Contact
  async addEmergencyContact(contact: Omit<EmergencyContact, 'id'>): Promise<string> {
    const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const newContact: EmergencyContact = {
      ...contact,
      id: contactId,
    };

    this.emergencyContacts.push(newContact);
    await this.saveEmergencyContacts();

    this.emit('emergencyContactAdded', newContact);
    console.log(`📞 Emergency contact added: ${newContact.name}`);

    return contactId;
  }

  // CRITICAL: Get Emergency Contacts
  getEmergencyContacts(filter: string = 'all'): EmergencyContact[] {
    let contacts = [...this.emergencyContacts];

    switch (filter) {
      case 'family':
        contacts = contacts.filter(c => c.relationship === 'family');
        break;
      case 'active':
        contacts = contacts.filter(c => c.isActive);
        break;
      case 'priority':
        contacts = contacts.filter(c => c.priority <= 3);
        break;
    }

    return contacts.sort((a, b) => a.priority - b.priority);
  }

  // CRITICAL: Get Panic Mode Status
  getPanicModeStatus(): {
    isActive: boolean;
    currentSession: PanicModeSession | null;
    activeSessions: PanicModeSession[];
    emergencyContacts: EmergencyContact[];
  } {
    return {
      isActive: this.isPanicModeActive,
      currentSession: this.currentSession,
      activeSessions: Array.from(this.activeSessions.values()),
      emergencyContacts: [...this.emergencyContacts],
    };
  }

  // CRITICAL: Get Available Panic Configs
  getAvailablePanicConfigs(): PanicModeConfig[] {
    return Array.from(this.panicConfigs.values());
  }

  // Private helper methods
  private async getCurrentLocation(): Promise<{ lat: number; lon: number; accuracy: number }> {
    // In a real implementation, this would use GPS
    return {
      lat: 41.0082 + (Math.random() - 0.5) * 0.01,
      lon: 28.9784 + (Math.random() - 0.5) * 0.01,
      accuracy: 10,
    };
  }

  private async getBatteryLevel(): Promise<number> {
    // In a real implementation, this would get actual battery level
    return Math.floor(Math.random() * 100);
  }

  private async getSignalStrength(): Promise<number> {
    // In a real implementation, this would get actual signal strength
    return Math.floor(Math.random() * 100);
  }

  private async playAudioSignal(frequency: number): Promise<void> {
    console.log(`🔊 Playing audio signal at ${frequency}Hz`);
    // In a real implementation, this would play actual audio
  }

  private async flashLight(duration: number): Promise<void> {
    console.log(`💡 Flashing light for ${duration} seconds`);
    // In a real implementation, this would control device flashlight
  }

  private async vibrateDevice(pattern: string): Promise<void> {
    console.log(`📳 Vibrating device with pattern: ${pattern}`);
    // In a real implementation, this would control device vibration
  }

  private async setMaxVolume(): Promise<void> {
    console.log(`🔊 Setting volume to maximum`);
    // In a real implementation, this would set device volume to maximum
  }

  private async loadEmergencyContacts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('emergency_contacts');
      if (stored) {
        this.emergencyContacts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
    }
  }

  private async saveEmergencyContacts(): Promise<void> {
    try {
      await AsyncStorage.setItem('emergency_contacts', JSON.stringify(this.emergencyContacts));
    } catch (error) {
      console.error('Failed to save emergency contacts:', error);
    }
  }

  private async savePanicSession(session: PanicModeSession): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('panic_sessions');
      const sessions = stored ? JSON.parse(stored) : [];
      
      sessions.push(session);
      
      // Keep only last 50 sessions
      if (sessions.length > 50) {
        sessions.splice(0, sessions.length - 50);
      }
      
      await AsyncStorage.setItem('panic_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save panic session:', error);
    }
  }
}

// Export singleton instance
export const panicModeManager = new PanicModeManager();
export default PanicModeManager;
