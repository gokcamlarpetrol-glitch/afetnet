import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface RescueMission {
  id: string;
  type: 'survivor' | 'medical' | 'evacuation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: number;
  estimatedDuration: number;
}

class RescueGuidanceSystem extends SimpleEventEmitter {
  private rescueMissions = new Map<string, RescueMission>();

  constructor() {
    super();
    console.log('🚁 Rescue Guidance System initialized');
  }

  // CRITICAL: Create Rescue Mission
  async createRescueMission(mission: Omit<RescueMission, 'id' | 'status' | 'createdAt'>): Promise<string> {
    try {
    const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
      const rescueMission: RescueMission = {
        ...mission,
      id: missionId,
        status: 'pending',
        createdAt: Date.now()
      };

      this.rescueMissions.set(missionId, rescueMission);
      
      this.emit('rescueMissionCreated', rescueMission);
      emergencyLogger.logSystem('info', 'Rescue mission created', { missionId, type: mission.type, priority: mission.priority });
      
      return missionId;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to create rescue mission', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Get Rescue Missions
  getRescueMissions(): RescueMission[] {
    return Array.from(this.rescueMissions.values());
  }

  // Active missions helper for dashboards
  getActiveMissions(): RescueMission[] {
    return Array.from(this.rescueMissions.values()).filter(m => m.status === 'active' || m.status === 'pending');
  }
}

export const rescueGuidanceSystem = new RescueGuidanceSystem();
export default RescueGuidanceSystem;