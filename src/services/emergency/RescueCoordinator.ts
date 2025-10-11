import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface RescueOperation {
  id: string;
  type: 'survivor' | 'medical' | 'evacuation' | 'search';
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  estimatedVictims: number;
  notes: string[];
  createdAt: number;
  updatedAt: number;
  assignedTeam?: string;
  estimatedETA?: number;
}

class RescueCoordinator extends SimpleEventEmitter {
  private activeOperations = new Map<string, RescueOperation>();
  private operationHistory: RescueOperation[] = [];

  constructor() {
    super();
    logger.debug('🚁 Rescue Coordinator initialized');
  }

  // CRITICAL: Create Rescue Operation
  async createRescueOperation(operationData: Omit<RescueOperation, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const operationId = `rescue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const operation: RescueOperation = {
        ...operationData,
        id: operationId,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.activeOperations.set(operationId, operation);
      
      this.emit('rescueOperationCreated', operation);
      emergencyLogger.logSystem('info', 'Rescue operation created', { operationId, type: operation.type, priority: operation.priority });
      
      logger.debug(`🚁 Rescue operation created: ${operationId}`);
      return operationId;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to create rescue operation', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Get Active Operations
  getActiveOperations(): RescueOperation[] {
    return Array.from(this.activeOperations.values());
  }

  // CRITICAL: Update Operation Status
  async updateOperationStatus(operationId: string, status: RescueOperation['status']): Promise<boolean> {
    try {
      const operation = this.activeOperations.get(operationId);
      if (!operation) return false;

      operation.status = status;
      operation.updatedAt = Date.now();

      if (status === 'completed' || status === 'cancelled') {
        this.activeOperations.delete(operationId);
        this.operationHistory.push(operation);
      }

      this.emit('rescueOperationUpdated', operation);
      emergencyLogger.logSystem('info', 'Rescue operation status updated', { operationId, status });
      
      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to update operation status', { error: String(error) });
      return false;
    }
  }
}

export const rescueCoordinator = new RescueCoordinator();
export default RescueCoordinator;