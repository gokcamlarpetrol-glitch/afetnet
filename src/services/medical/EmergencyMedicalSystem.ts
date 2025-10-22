import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface MedicalEmergency {
  id: string;
  type: 'injury' | 'illness' | 'trauma' | 'cardiac' | 'respiratory';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  patientInfo: {
    age?: number;
    gender?: string;
    medicalHistory?: string[];
    allergies?: string[];
  };
  symptoms: string[];
  timestamp: number;
  status: 'active' | 'treated' | 'transferred' | 'resolved';
}

class EmergencyMedicalSystem extends SimpleEventEmitter {
  private medicalEmergencies = new Map<string, MedicalEmergency>();

  constructor() {
    super();
    logger.debug('🏥 Emergency Medical System initialized');
  }

  // CRITICAL: Create Medical Emergency
  async createMedicalEmergency(emergency: Omit<MedicalEmergency, 'id' | 'timestamp' | 'status'>): Promise<string> {
    try {
      const emergencyId = `medical_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const medicalEmergency: MedicalEmergency = {
        ...emergency,
        id: emergencyId,
        timestamp: Date.now(),
        status: 'active',
      };

      this.medicalEmergencies.set(emergencyId, medicalEmergency);
      
      this.emit('medicalEmergencyCreated', medicalEmergency);
      emergencyLogger.logSystem('info', 'Medical emergency created', { emergencyId, type: emergency.type, severity: emergency.severity });
      
      return emergencyId;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to create medical emergency', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Get Medical Emergencies
  getMedicalEmergencies(): MedicalEmergency[] {
    return Array.from(this.medicalEmergencies.values());
  }

  // CRITICAL: Start Medical Monitoring
  async startMedicalMonitoring(): Promise<boolean> {
    try {
      logger.debug('🏥 Starting medical monitoring...');
      
      this.emit('medicalMonitoringStarted');
      emergencyLogger.logSystem('info', 'Medical monitoring started');
      
      return true;
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to start medical monitoring', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Stop Medical Monitoring
  async stopMedicalMonitoring(): Promise<boolean> {
    try {
      logger.debug('🏥 Stopping medical monitoring...');
      
      this.emit('medicalMonitoringStopped');
      emergencyLogger.logSystem('info', 'Medical monitoring stopped');
      
      return true;
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to stop medical monitoring', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Get Active Medical Emergencies
  getActiveMedicalEmergencies(): MedicalEmergency[] {
    return Array.from(this.medicalEmergencies.values()).filter(emergency => emergency.status === 'active');
  }
}

export const emergencyMedicalSystem = new EmergencyMedicalSystem();
export default EmergencyMedicalSystem;