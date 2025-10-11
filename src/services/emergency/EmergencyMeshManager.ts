import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface MeshNode {
  id: string;
  name: string;
  location: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  lastSeen: number;
  signalStrength: number;
  batteryLevel: number;
  isActive: boolean;
  capabilities: string[];
  encrypted: boolean;
}

export interface MeshMessage {
  id: string;
  from: string;
  to: string;
  type: 'sos' | 'alert' | 'data' | 'control' | 'heartbeat';
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: any;
  timestamp: number;
  encrypted: boolean;
  hops: number;
  maxHops: number;
  signature?: string;
}

export interface SOSData {
  id: string;
  location: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  message: string;
  peopleCount: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  medicalInfo?: any;
  contactInfo?: any;
}

class EmergencyMeshManager extends SimpleEventEmitter {
  private isActive = false;
  private connectedNodes = new Map<string, MeshNode>();
  private messageQueue = new Map<string, MeshMessage[]>();
  private pendingMessages = new Map<string, MeshMessage>();
  private meshInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private nodeId: string;
  private maxHops = 5;
  private messageTimeout = 30000; // 30 seconds
  private batteryLevel = 100;
  private lastActivity = Date.now();

  constructor() {
    super();
    this.nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    logger.debug('🌐 Emergency Mesh Manager initialized');
  }

  // CRITICAL: Start Emergency Mesh Network
  async startEmergencyMesh(): Promise<boolean> {
    try {
      if (this.isActive) return true;

      logger.debug('🌐 Starting emergency mesh network...');

      this.isActive = true;

      // Start mesh operations
      this.meshInterval = setInterval(() => {
        this.processMeshOperations();
      }, 2000); // Every 2 seconds

      // Start heartbeat
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 10000); // Every 10 seconds

      // Load existing nodes and messages
      await this.loadMeshData();

      this.emit('meshStarted');
      emergencyLogger.logMesh('info', 'Emergency mesh network started', { nodeId: this.nodeId });

      logger.debug('✅ Emergency mesh network started');
      return true;

    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to start emergency mesh', { error: String(error) });
      logger.error('❌ Failed to start emergency mesh:', error);
      return false;
    }
  }

  // CRITICAL: Stop Emergency Mesh Network
  async stopEmergencyMesh(): Promise<void> {
    try {
      if (!this.isActive) return;

      logger.debug('🛑 Stopping emergency mesh network...');

      this.isActive = false;

      if (this.meshInterval) {
        clearInterval(this.meshInterval);
        this.meshInterval = null;
      }

      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Save mesh data
      await this.saveMeshData();

      this.emit('meshStopped');
      emergencyLogger.logMesh('info', 'Emergency mesh network stopped');

      logger.debug('✅ Emergency mesh network stopped');

    } catch (error) {
      emergencyLogger.logMesh('error', 'Error stopping emergency mesh', { error: String(error) });
      logger.error('❌ Error stopping emergency mesh:', error);
    }
  }

  // CRITICAL: Send Emergency SOS
  async sendEmergencySOS(sosData: SOSData): Promise<boolean> {
    try {
      logger.debug('🚨 Sending emergency SOS...');

      // Validate SOS data
      if (!this.validateSOSData(sosData)) {
        throw new Error('Invalid SOS data');
      }

      // Create SOS message
      const message: MeshMessage = {
        id: `sos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        from: this.nodeId,
        to: 'broadcast',
        type: 'sos',
        priority: sosData.priority,
        payload: sosData,
        timestamp: Date.now(),
        encrypted: true,
        hops: 0,
        maxHops: this.maxHops
      };

      // Send with multiple delivery attempts
      let deliverySuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          deliverySuccess = await this.sendMessage(message);
          if (deliverySuccess) break;
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } catch (error) {
          emergencyLogger.logMesh('error', `SOS delivery attempt ${attempt} failed`, { error: String(error) });
        }
      }

      // If primary delivery fails, try backup methods
      if (!deliverySuccess) {
        await this.emergencyBackupDelivery(sosData);
      }

      this.emit('sosSent', { message, success: deliverySuccess });
      emergencyLogger.logMesh('info', 'Emergency SOS sent', { 
        sosId: sosData.id, 
        success: deliverySuccess,
        attempts: 3
      });

      logger.debug(`🚨 Emergency SOS ${deliverySuccess ? 'sent successfully' : 'sent via backup methods'}`);
      return deliverySuccess;

    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to send emergency SOS', { error: String(error) });
      logger.error('❌ Failed to send emergency SOS:', error);
      return false;
    }
  }

  // CRITICAL: Emergency Backup Delivery
  private async emergencyBackupDelivery(sosData: SOSData): Promise<void> {
    try {
      logger.debug('🔄 Attempting emergency backup delivery...');

      // Try WiFi Direct
      await this.tryWiFiDirectDelivery(sosData);

      // Try Bluetooth Classic
      await this.tryBluetoothClassicDelivery(sosData);

      // Try Audio Beacon
      await this.tryAudioBeaconDelivery(sosData);

      // Try Visual Signal
      await this.tryVisualSignalDelivery(sosData);

      // Create emergency backup record
      await this.createEmergencyBackupRecord(sosData);

      emergencyLogger.logMesh('warn', 'Emergency backup delivery attempted', { sosId: sosData.id });

    } catch (error) {
      emergencyLogger.logMesh('error', 'Emergency backup delivery failed', { error: String(error) });
    }
  }

  // CRITICAL: Send Message
  async sendMessage(message: MeshMessage): Promise<boolean> {
    try {
      if (!this.isActive) return false;

      // Add to pending messages
      this.pendingMessages.set(message.id, message);

      // Set timeout for message
      setTimeout(() => {
        this.pendingMessages.delete(message.id);
      }, this.messageTimeout);

      // Send to connected nodes
      const connectedNodes = Array.from(this.connectedNodes.values()).filter(node => node.isActive);
      
      if (connectedNodes.length === 0) {
        logger.debug('⚠️ No connected nodes available for message delivery');
        return false;
      }

      // Send to all connected nodes
      let sentCount = 0;
      for (const node of connectedNodes) {
        try {
          await this.sendToNode(node, message);
          sentCount++;
        } catch (error) {
          emergencyLogger.logMesh('error', 'Failed to send to node', { nodeId: node.id, error: String(error) });
        }
      }

      const success = sentCount > 0;
      
      if (success) {
        this.emit('messageSent', message);
        emergencyLogger.logMesh('info', 'Message sent', { messageId: message.id, sentTo: sentCount });
      }

      return success;

    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to send message', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Send to Node
  private async sendToNode(node: MeshNode, message: MeshMessage): Promise<void> {
    try {
      // Simulate sending to node
      logger.debug(`📤 Sending message to node: ${node.id}`);
      
      // In real implementation, this would use BLE/WiFi Direct
      // For now, we'll simulate success
      return Promise.resolve();

    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to send to node', { nodeId: node.id, error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Process Mesh Operations
  private async processMeshOperations(): Promise<void> {
    try {
      // Process pending messages
      await this.processPendingMessages();

      // Discover new nodes
      await this.discoverNodes();

      // Clean up old connections
      this.cleanupOldConnections();

    } catch (error) {
      emergencyLogger.logMesh('error', 'Mesh operations failed', { error: String(error) });
    }
  }

  // CRITICAL: Process Pending Messages
  private async processPendingMessages(): Promise<void> {
    try {
      for (const [messageId, message] of this.pendingMessages) {
        // Check if message has exceeded max hops
        if (message.hops >= message.maxHops) {
          this.pendingMessages.delete(messageId);
          continue;
        }

        // Try to forward message
        await this.forwardMessage(message);
      }
    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to process pending messages', { error: String(error) });
    }
  }

  // CRITICAL: Forward Message
  private async forwardMessage(message: MeshMessage): Promise<void> {
    try {
      // Increment hop count
      message.hops++;

      // Find next hop nodes
      const nextHopNodes = this.findNextHopNodes(message);
      
      if (nextHopNodes.length === 0) {
        // No more hops available
        this.pendingMessages.delete(message.id);
        return;
      }

      // Forward to next hop nodes
      for (const node of nextHopNodes) {
        try {
          await this.sendToNode(node, message);
        } catch (error) {
          emergencyLogger.logMesh('error', 'Failed to forward message', { nodeId: node.id, error: String(error) });
        }
      }

    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to forward message', { error: String(error) });
    }
  }

  // CRITICAL: Find Next Hop Nodes
  private findNextHopNodes(message: MeshMessage): MeshNode[] {
    const availableNodes = Array.from(this.connectedNodes.values()).filter(node => 
      node.isActive && 
      node.id !== message.from && 
      node.id !== this.nodeId
    );

    // Simple routing: forward to nodes with better signal strength
    return availableNodes
      .sort((a, b) => b.signalStrength - a.signalStrength)
      .slice(0, 3); // Forward to top 3 nodes
  }

  // CRITICAL: Discover Nodes
  private async discoverNodes(): Promise<void> {
    try {
      // Simulate node discovery
      if (Math.random() < 0.3) { // 30% chance of discovering a new node
        const newNode = this.generateMockNode();
        this.connectedNodes.set(newNode.id, newNode);
        
        this.emit('nodeDiscovered', newNode);
        emergencyLogger.logMesh('info', 'New node discovered', { nodeId: newNode.id });
        
        logger.debug(`🔍 New node discovered: ${newNode.id}`);
      }
    } catch (error) {
      emergencyLogger.logMesh('error', 'Node discovery failed', { error: String(error) });
    }
  }

  // CRITICAL: Send Heartbeat
  private async sendHeartbeat(): Promise<void> {
    try {
      const heartbeat: MeshMessage = {
        id: `heartbeat_${Date.now()}`,
        from: this.nodeId,
        to: 'broadcast',
        type: 'heartbeat',
        priority: 'low',
        payload: {
          nodeId: this.nodeId,
          timestamp: Date.now(),
          status: 'active'
        },
        timestamp: Date.now(),
        encrypted: false,
        hops: 0,
        maxHops: 1
      };

      await this.sendMessage(heartbeat);

    } catch (error) {
      emergencyLogger.logMesh('error', 'Heartbeat failed', { error: String(error) });
    }
  }

  // CRITICAL: Get Mesh Status
  getMeshStatus(): {
    isActive: boolean;
    nodeId: string;
    connectedNodes: number;
    activeNodes: number;
    pendingMessages: number;
  } {
    const connectedNodes = Array.from(this.connectedNodes.values());
    const activeNodes = connectedNodes.filter(node => node.isActive);

    return {
      isActive: this.isActive,
      nodeId: this.nodeId,
      connectedNodes: connectedNodes.length,
      activeNodes: activeNodes.length,
      pendingMessages: this.pendingMessages.size
    };
  }

  // Helper methods
  private validateSOSData(sosData: SOSData): boolean {
    return !!(
      sosData.id &&
      sosData.location &&
      typeof sosData.location.lat === 'number' &&
      typeof sosData.location.lon === 'number' &&
      sosData.message &&
      typeof sosData.peopleCount === 'number' &&
      sosData.priority &&
      sosData.timestamp
    );
  }

  private generateMockNode(): MeshNode {
    return {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: `Node_${Math.floor(Math.random() * 1000)}`,
      location: {
        lat: 41.0082 + (Math.random() - 0.5) * 0.01,
        lon: 28.9784 + (Math.random() - 0.5) * 0.01,
        accuracy: Math.floor(Math.random() * 50) + 5
      },
      lastSeen: Date.now(),
      signalStrength: Math.floor(Math.random() * 100) + 20,
      batteryLevel: Math.floor(Math.random() * 100) + 10,
      isActive: true,
      capabilities: ['sos', 'alert', 'data'],
      encrypted: true
    };
  }

  private cleanupOldConnections(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    
    for (const [nodeId, node] of this.connectedNodes) {
      if (node.lastSeen < fiveMinutesAgo) {
        node.isActive = false;
        this.connectedNodes.set(nodeId, node);
        
        this.emit('nodeDisconnected', node);
        logger.debug(`🔌 Node disconnected: ${nodeId}`);
      }
    }
  }

  // Backup delivery methods (placeholders)
  private async tryWiFiDirectDelivery(sosData: SOSData): Promise<void> {
    logger.debug('📶 Attempting WiFi Direct delivery...');
    // Implementation would use WiFi Direct APIs
  }

  private async tryBluetoothClassicDelivery(sosData: SOSData): Promise<void> {
    logger.debug('🔵 Attempting Bluetooth Classic delivery...');
    // Implementation would use Bluetooth Classic APIs
  }

  private async tryAudioBeaconDelivery(sosData: SOSData): Promise<void> {
    logger.debug('🔊 Attempting Audio Beacon delivery...');
    // Implementation would use audio beacon technology
  }

  private async tryVisualSignalDelivery(sosData: SOSData): Promise<void> {
    logger.debug('💡 Attempting Visual Signal delivery...');
    // Implementation would use screen flash or LED patterns
  }

  private async createEmergencyBackupRecord(sosData: SOSData): Promise<void> {
    try {
      const backupRecord = {
        ...sosData,
        backupTimestamp: Date.now(),
        deliveryMethods: ['mesh_failed', 'wifi_direct', 'bluetooth', 'audio', 'visual']
      };

      await AsyncStorage.setItem(`emergency_backup_${sosData.id}`, JSON.stringify(backupRecord));
      emergencyLogger.logMesh('warn', 'Emergency backup record created', { sosId: sosData.id });
    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to create emergency backup record', { error: String(error) });
    }
  }

  private async saveMeshData(): Promise<void> {
    try {
      const meshData = {
        nodes: Array.from(this.connectedNodes.values()),
        messages: Array.from(this.pendingMessages.values())
      };

      await AsyncStorage.setItem('mesh_data', JSON.stringify(meshData));
    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to save mesh data', { error: String(error) });
    }
  }

  private async loadMeshData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('mesh_data');
      if (stored) {
        const meshData = JSON.parse(stored);
        
        if (meshData.nodes) {
          for (const node of meshData.nodes) {
            this.connectedNodes.set(node.id, node);
          }
        }
      }
    } catch (error) {
      emergencyLogger.logMesh('error', 'Failed to load mesh data', { error: String(error) });
    }
  }

  // Public getter for isActive
  get isMeshActive(): boolean {
    return this.isActive;
  }

  async getNetworkStats(): Promise<any> {
    return {
      totalNodes: this.connectedNodes.size,
      activeNodes: Array.from(this.connectedNodes.values()).filter(node => node.isActive).length,
      onlineNodes: Array.from(this.connectedNodes.values()).filter(node => node.isActive).length,
      totalMessages: this.messageQueue.size,
      networkHealth: this.calculateNetworkHealth(),
      averageSignalStrength: Array.from(this.connectedNodes.values()).reduce((sum, node) => sum + node.signalStrength, 0) / this.connectedNodes.size || 0,
      batteryLevel: this.batteryLevel,
      lastActivity: this.lastActivity
    };
  }

  // Compute a simple network health score 0-100
  private calculateNetworkHealth(): number {
    const nodeCount = this.connectedNodes.size;
    if (nodeCount === 0) { return 0; }
    const active = Array.from(this.connectedNodes.values()).filter(n => n.isActive);
    const activeRatio = active.length / nodeCount; // 0..1
    const avgSignal = active.length
      ? active.reduce((s, n) => s + (n.signalStrength || 0), 0) / active.length
      : 0; // assume 0..100
    // weight active ratio 70%, signal 30%
    const health = Math.max(0, Math.min(100, Math.round(activeRatio * 70 + (avgSignal / 100) * 30)));
    return health;
  }

  // Get connected nodes
  getConnectedNodes(): MeshNode[] {
    return Array.from(this.connectedNodes.values()).filter(node => node.isActive);
  }

  // Send emergency alert to all nodes
  async sendEmergencyAlert(alert: { type: string; message: string; priority: string; location?: any }): Promise<void> {
    const alertMessage: MeshMessage = {
      id: `alert_${Date.now()}`,
      from: this.nodeId,
      to: 'broadcast',
      type: 'alert',
      priority: alert.priority as any,
      payload: alert,
      timestamp: Date.now(),
      encrypted: false,
      hops: 0,
      maxHops: this.maxHops,
    };
    
    // Broadcast via BLE mesh
    const { BleMeshManager } = await import('../../ble/mesh/BleMeshManager');
    const manager: any = new BleMeshManager({} as any);
    if (manager.broadcastMessage) {
      await manager.broadcastMessage({
        id: alertMessage.id,
        type: 'HEARTBEAT' as any,
        payload: alert,
        timestamp: Date.now(),
        ttl: this.maxHops,
        hopCount: 0,
      });
    }
  }
}

// Export singleton instance
export const emergencyMeshManager = new EmergencyMeshManager();
export default EmergencyMeshManager;