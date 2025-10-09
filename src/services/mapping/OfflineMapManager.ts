import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface MapLocation {
  id: string;
  name: string;
  type: 'debris' | 'safe_zone' | 'hazard' | 'evacuation_point' | 'medical_station';
  location: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  verified: boolean;
}

class OfflineMapManager extends SimpleEventEmitter {
  private mapLocations = new Map<string, MapLocation>();

  constructor() {
    super();
    console.log('🗺️ Offline Map Manager initialized');
  }

  // CRITICAL: Add Map Location
  async addMapLocation(location: Omit<MapLocation, 'id' | 'timestamp'>): Promise<string> {
    try {
      const locationId = `location_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const mapLocation: MapLocation = {
        ...location,
        id: locationId,
        timestamp: Date.now()
      };

      this.mapLocations.set(locationId, mapLocation);
      
      this.emit('mapLocationAdded', mapLocation);
      emergencyLogger.logSystem('info', 'Map location added', { locationId, type: location.type });
      
      return locationId;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to add map location', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Get Map Locations
  getMapLocations(): MapLocation[] {
    return Array.from(this.mapLocations.values());
  }

  // CRITICAL: Set Offline Mode
  setOfflineMode(isOffline: boolean): void {
    try {
      console.log(`🗺️ Setting offline mode: ${isOffline}`);
      
      this.emit('offlineModeChanged', { isOffline });
      emergencyLogger.logSystem('info', 'Offline mode changed', { isOffline });
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to set offline mode', { error: String(error) });
    }
  }

  // CRITICAL: Get All Debris Locations
  getAllDebrisLocations(): MapLocation[] {
    return Array.from(this.mapLocations.values()).filter(location => location.type === 'debris');
  }
}

export const offlineMapManager = new OfflineMapManager();
export default OfflineMapManager;