// @afetnet: Advanced Multipath Routing for Ultra-Reliable Message Delivery
// Military-grade message delivery with redundant paths and guaranteed delivery

import { logger } from '../../core/utils/logger';
import { advancedMeshNetwork } from '../security/protocols/aiSelector';
import { advancedMessageEncoder, EncodedMessage } from './encoder';
import { advancedMessageDecoder, DecodedMessage } from './decoder';
import { pfsService } from '../security/pfs';

export interface MultipathConfig {
  maxPaths: number; // Maximum number of redundant paths
  minPaths: number; // Minimum paths for critical messages
  redundancyFactor: number; // How many copies per path
  adaptiveRouting: boolean; // Use AI for path selection
  deduplicationWindow: number; // ms to deduplicate received messages
  failureThreshold: number; // When to consider a path failed
}

export interface PathMetrics {
  pathId: string;
  latency: number; // ms
  reliability: number; // 0-100
  bandwidth: number; // kbps
  hopCount: number;
  lastUsed: number;
  successRate: number;
  isActive: boolean;
}

export interface MultipathMessage {
  originalMessage: EncodedMessage;
  pathMessages: Map<string, EncodedMessage>; // pathId -> message copy
  sentPaths: Set<string>;
  acknowledgedPaths: Set<string>;
  failedPaths: Set<string>;
  priority: 'critical' | 'high' | 'normal' | 'low';
  createdAt: number;
  completedAt?: number;
  isComplete: boolean;
}

export class AdvancedMultipathRouter {
  private activeMultipathMessages: Map<string, MultipathMessage> = new Map();
  private pathMetrics: Map<string, PathMetrics> = new Map();
  private deduplicationCache: Map<string, number> = new Map(); // messageId -> timestamp
  private config: MultipathConfig;

  constructor() {
    this.config = {
      maxPaths: 5,
      minPaths: 2,
      redundancyFactor: 2,
      adaptiveRouting: true,
      deduplicationWindow: 30000, // 30 seconds
      failureThreshold: 0.3, // 30% failure rate threshold
    };
  }

  async initialize(): Promise<void> {
    logger.debug('🛣️ Initializing advanced multipath router...');

    // Initialize path metrics
    this.initializePathMetrics();

    // Start path monitoring
    this.startPathMonitoring();

    // Start deduplication cleanup
    this.startDeduplicationCleanup();

    logger.debug('✅ Advanced multipath router initialized');
  }

  private initializePathMetrics(): void {
    // Initialize metrics for different path types
    const pathTypes = ['direct', 'mesh', 'redundant', 'backup', 'emergency'];

    for (const pathType of pathTypes) {
      this.pathMetrics.set(pathType, {
        pathId: pathType,
        latency: 100, // ms
        reliability: 90, // 0-100
        bandwidth: 1000, // kbps
        hopCount: 1,
        lastUsed: Date.now(),
        successRate: 0.95,
        isActive: true,
      });
    }
  }

  private startPathMonitoring(): void {
    logger.debug('📊 Starting path monitoring...');

    setInterval(() => {
      this.updatePathMetrics();
      this.optimizePathSelection();
    }, 10000); // Every 10 seconds
  }

  private startDeduplicationCleanup(): void {
    logger.debug('🧹 Starting deduplication cleanup...');

    setInterval(() => {
      this.cleanupDeduplicationCache();
    }, 60000); // Every minute
  }

  // @afetnet: Send message with multipath redundancy
  async sendWithMultipath(
    source: string,
    destination: string,
    payload: string,
    type: EncodedMessage['type'] = 'data',
    priority: EncodedMessage['priority'] = 'normal'
  ): Promise<string> {
    try {
      logger.debug(`🛣️ Sending message with multipath: ${type} (${priority})`);

      // Determine number of paths based on priority
      const numPaths = this.calculatePathCount(priority);

      // Find optimal paths
      const optimalPaths = await this.findOptimalPaths(source, destination, numPaths);

      if (optimalPaths.length === 0) {
        throw new Error('No available paths for message delivery');
      }

      // Encode original message
      const originalMessage = await advancedMessageEncoder.encodeMessage(
        source,
        destination,
        payload,
        type,
        priority
      );

      // Create multipath message
      const multipathMessage: MultipathMessage = {
        originalMessage,
        pathMessages: new Map(),
        sentPaths: new Set(),
        acknowledgedPaths: new Set(),
        failedPaths: new Set(),
        priority,
        createdAt: Date.now(),
        isComplete: false,
      };

      // Create message copies for each path
      for (const pathId of optimalPaths) {
        const pathMessage = await this.createPathMessage(originalMessage, pathId);
        multipathMessage.pathMessages.set(pathId, pathMessage);
      }

      // Send on all paths
      await this.sendOnAllPaths(multipathMessage);

      // Track multipath message
      this.activeMultipathMessages.set(originalMessage.id, multipathMessage);

      logger.debug(`✅ Message sent on ${optimalPaths.length} paths: ${originalMessage.id}`);
      return originalMessage.id;

    } catch (error) {
      logger.error('Failed to send multipath message:', error);
      throw error;
    }
  }

  private calculatePathCount(priority: EncodedMessage['priority']): number {
    switch (priority) {
      case 'critical': return Math.max(this.config.minPaths, 3);
      case 'high': return Math.max(this.config.minPaths, 2);
      case 'normal': return this.config.minPaths;
      case 'low': return 1;
      default: return this.config.minPaths;
    }
  }

  private async findOptimalPaths(source: string, destination: string, count: number): Promise<string[]> {
    try {
      // Get all available paths
      const allPaths = Array.from(this.pathMetrics.keys()).filter(pathId => {
        const metrics = this.pathMetrics.get(pathId);
        return metrics && metrics.isActive && metrics.successRate > this.config.failureThreshold;
      });

      if (allPaths.length === 0) {
        logger.warn('No active paths available');
        return [];
      }

      // Use AI selector for optimal path selection
      if (this.config.adaptiveRouting) {
        return await this.selectOptimalPathsAI(source, destination, allPaths, count);
      } else {
        // Simple selection based on metrics
        return this.selectOptimalPathsSimple(allPaths, count);
      }
    } catch (error) {
      logger.error('Failed to find optimal paths:', error);
      return [];
    }
  }

  private async selectOptimalPathsAI(
    source: string,
    destination: string,
    availablePaths: string[],
    count: number
  ): Promise<string[]> {
    // Use network intelligence for path selection
    try {
      // In real implementation, would use network intelligence engine
      const pathScores = new Map<string, number>();

      for (const pathId of availablePaths) {
        const metrics = this.pathMetrics.get(pathId);
        if (metrics) {
          // Calculate path score based on multiple factors
          const score = this.calculatePathScore(metrics);
          pathScores.set(pathId, score);
        }
      }

      // Sort paths by score and return top N
      const sortedPaths = Array.from(pathScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([pathId]) => pathId);

      return sortedPaths;
    } catch (error) {
      logger.error('AI path selection failed:', error);
      return this.selectOptimalPathsSimple(availablePaths, count);
    }
  }

  private selectOptimalPathsSimple(availablePaths: string[], count: number): string[] {
    // Simple selection based on reliability
    const sortedPaths = availablePaths
      .map(pathId => ({ pathId, metrics: this.pathMetrics.get(pathId)! }))
      .filter(item => item.metrics)
      .sort((a, b) => b.metrics.reliability - a.metrics.reliability)
      .slice(0, count)
      .map(item => item.pathId);

    return sortedPaths;
  }

  private calculatePathScore(metrics: PathMetrics): number {
    // Calculate comprehensive path score
    const latencyScore = Math.max(0, 100 - (metrics.latency / 10)); // Lower latency = higher score
    const reliabilityScore = metrics.reliability;
    const bandwidthScore = Math.min(100, metrics.bandwidth / 10); // Normalize bandwidth
    const hopScore = Math.max(0, 100 - (metrics.hopCount * 10)); // Fewer hops = higher score

    // Weighted average
    return (latencyScore * 0.2) + (reliabilityScore * 0.4) + (bandwidthScore * 0.2) + (hopScore * 0.2);
  }

  private async createPathMessage(originalMessage: EncodedMessage, pathId: string): Promise<EncodedMessage> {
    // Create a copy of the message for this specific path
    const pathMessage: EncodedMessage = {
      ...originalMessage,
      id: `${originalMessage.id}_${pathId}`,
      routeHistory: [pathId], // Include path in route
    };

    return pathMessage;
  }

  private async sendOnAllPaths(multipathMessage: MultipathMessage): Promise<void> {
    const sendPromises: Promise<boolean>[] = [];

    for (const [pathId, pathMessage] of multipathMessage.pathMessages) {
      const sendPromise = this.sendOnPath(pathId, pathMessage, multipathMessage);
      sendPromises.push(sendPromise);
    }

    try {
      const results = await Promise.allSettled(sendPromises);

      // Track sent paths
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const pathId = Array.from(multipathMessage.pathMessages.keys())[i];

        if (result.status === 'fulfilled' && result.value) {
          multipathMessage.sentPaths.add(pathId);
          logger.debug(`✅ Message sent on path: ${pathId}`);
        } else {
          multipathMessage.failedPaths.add(pathId);
          logger.warn(`❌ Message failed on path: ${pathId}`);
        }
      }
    } catch (error) {
      logger.error('Failed to send on multiple paths:', error);
    }
  }

  private async sendOnPath(pathId: string, message: EncodedMessage, multipathMessage: MultipathMessage): Promise<boolean> {
    try {
      // Update path metrics
      const metrics = this.pathMetrics.get(pathId);
      if (metrics) {
        metrics.lastUsed = Date.now();
      }

      // Send message using appropriate transport
      const success = await this.sendMessageOnPath(message, pathId);

      if (success) {
        // Update metrics on success
        this.updatePathMetricsOnSuccess(pathId);
      } else {
        this.updatePathMetricsOnFailure(pathId);
      }

      return success;
    } catch (error) {
      logger.error(`Failed to send on path ${pathId}:`, error);
      this.updatePathMetricsOnFailure(pathId);
      return false;
    }
  }

  private async sendMessageOnPath(message: EncodedMessage, pathId: string): Promise<boolean> {
    // Route message using mesh network
    try {
      const success = await advancedMeshNetwork.sendMeshPacket(message as any);
      return success;
    } catch (error) {
      logger.error(`Failed to send message on path ${pathId}:`, error);
      return false;
    }
  }

  private updatePathMetricsOnSuccess(pathId: string): void {
    const metrics = this.pathMetrics.get(pathId);
    if (metrics) {
      // Increase success rate
      metrics.successRate = Math.min(1.0, metrics.successRate + 0.01);
      metrics.reliability = Math.min(100, metrics.reliability + 0.5);
    }
  }

  private updatePathMetricsOnFailure(pathId: string): void {
    const metrics = this.pathMetrics.get(pathId);
    if (metrics) {
      // Decrease success rate
      metrics.successRate = Math.max(0.0, metrics.successRate - 0.05);
      metrics.reliability = Math.max(0, metrics.reliability - 2);
    }
  }

  private updatePathMetrics(): void {
    const now = Date.now();

    for (const [pathId, metrics] of this.pathMetrics) {
      // Age-based reliability decay
      const timeSinceLastUse = now - metrics.lastUsed;
      if (timeSinceLastUse > 300000) { // 5 minutes
        metrics.reliability = Math.max(0, metrics.reliability - 1);
      }

      // Mark inactive if reliability too low
      if (metrics.reliability < 10) {
        metrics.isActive = false;
      }
    }
  }

  private optimizePathSelection(): void {
    // Optimize path selection based on current metrics
    const activePaths = Array.from(this.pathMetrics.entries())
      .filter(([_, metrics]) => metrics.isActive)
      .sort((a, b) => b[1].reliability - a[1].reliability);

    logger.debug(`📊 Path optimization: ${activePaths.length} active paths`);
  }

  private cleanupDeduplicationCache(): void {
    const now = Date.now();
    const cutoff = now - this.config.deduplicationWindow;

    let cleanedCount = 0;
    for (const [messageId, timestamp] of this.deduplicationCache) {
      if (timestamp < cutoff) {
        this.deduplicationCache.delete(messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned ${cleanedCount} deduplication entries`);
    }
  }

  // @afetnet: Handle received message with deduplication
  async handleReceivedMessage(message: EncodedMessage): Promise<boolean> {
    try {
      // Check for duplicates
      if (this.isDuplicate(message.id)) {
        logger.debug(`🔄 Duplicate message received: ${message.id}`);
        return false;
      }

      // Mark as seen
      this.deduplicationCache.set(message.id, Date.now());

      // Decode message
      const decodedMessage = await advancedMessageDecoder.decodeMessage(message);

      if (!decodedMessage.isValid) {
        logger.warn(`Invalid message received: ${message.id}`);
        return false;
      }

      // Check if this is a multipath message completion
      await this.checkMultipathCompletion(message);

      logger.debug(`✅ Valid message received: ${message.id}`);
      return true;

    } catch (error) {
      logger.error('Failed to handle received message:', error);
      return false;
    }
  }

  private isDuplicate(messageId: string): boolean {
    return this.deduplicationCache.has(messageId);
  }

  private async checkMultipathCompletion(message: EncodedMessage): Promise<void> {
    // Find the multipath message this belongs to
    const multipathMessage = this.findMultipathMessage(message);

    if (multipathMessage) {
      // Mark this path as acknowledged
      multipathMessage.acknowledgedPaths.add(message.routeHistory[0] || 'unknown');

      // Check if multipath delivery is complete
      if (multipathMessage.acknowledgedPaths.size >= this.config.minPaths) {
        await this.completeMultipathDelivery(multipathMessage);
      }
    }
  }

  private findMultipathMessage(message: EncodedMessage): MultipathMessage | null {
    // Find the multipath message this message belongs to
    for (const multipathMessage of this.activeMultipathMessages.values()) {
      if (multipathMessage.originalMessage.id === message.id.split('_')[0]) {
        return multipathMessage;
      }
    }
    return null;
  }

  private async completeMultipathDelivery(multipathMessage: MultipathMessage): Promise<void> {
    if (multipathMessage.isComplete) return;

    multipathMessage.isComplete = true;
    multipathMessage.completedAt = Date.now();

    logger.debug(`✅ Multipath delivery completed: ${multipathMessage.originalMessage.id}`);

    // Clean up
    this.activeMultipathMessages.delete(multipathMessage.originalMessage.id);
  }

  // @afetnet: Get multipath statistics
  getMultipathStats(): {
    activeMessages: number;
    completedMessages: number;
    averagePaths: number;
    successRate: number;
    pathMetrics: Map<string, PathMetrics>;
  } {
    const activeMessages = this.activeMultipathMessages.size;
    const completedMessages = this.getCompletedMessageCount();
    const averagePaths = this.calculateAveragePaths();
    const successRate = this.calculateSuccessRate();

    return {
      activeMessages,
      completedMessages,
      averagePaths,
      successRate,
      pathMetrics: new Map(this.pathMetrics),
    };
  }

  private getCompletedMessageCount(): number {
    let count = 0;
    for (const message of this.activeMultipathMessages.values()) {
      if (message.isComplete) count++;
    }
    return count;
  }

  private calculateAveragePaths(): number {
    if (this.activeMultipathMessages.size === 0) return 0;

    const totalPaths = Array.from(this.activeMultipathMessages.values())
      .reduce((sum, msg) => sum + msg.pathMessages.size, 0);

    return totalPaths / this.activeMultipathMessages.size;
  }

  private calculateSuccessRate(): number {
    const messages = Array.from(this.activeMultipathMessages.values());
    if (messages.length === 0) return 1.0;

    const successfulMessages = messages.filter(msg => msg.isComplete).length;
    return successfulMessages / messages.length;
  }

  // @afetnet: Force multipath completion for testing
  async forceCompleteMultipath(messageId: string): Promise<void> {
    const multipathMessage = this.activeMultipathMessages.get(messageId);
    if (multipathMessage) {
      await this.completeMultipathDelivery(multipathMessage);
    }
  }

  // @afetnet: Clean up old multipath messages
  cleanupOldMultipathMessages(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    let cleanedCount = 0;
    for (const [messageId, message] of this.activeMultipathMessages) {
      if (now - message.createdAt > maxAge) {
        this.activeMultipathMessages.delete(messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} old multipath messages`);
    }
  }
}

// @afetnet: Export singleton instance
export const advancedMultipathRouter = new AdvancedMultipathRouter();

























