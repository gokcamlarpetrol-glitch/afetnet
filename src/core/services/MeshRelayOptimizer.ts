/**
 * MESH RELAY OPTIMIZER - ELITE EDITION
 * Optimizes message relay for maximum coverage with minimum power.
 *
 * Features:
 * - Smart relay decision based on network topology
 * - Power-aware broadcast timing
 * - Congestion detection and backoff
 * - Route caching for efficiency
 */

import { createLogger } from '../utils/logger';
import { useMeshStore } from '../stores/meshStore';
import { QMeshPacket, PacketPriority, PacketType } from './mesh/QMeshProtocol';

const logger = createLogger('MeshRelayOptimizer');

// Optimizer Constants
const MIN_RELAY_INTERVAL_MS = 100; // Minimum delay between relays
const CONGESTION_THRESHOLD = 10; // Packets per second
const POWER_SAVE_THRESHOLD = 20; // Battery percentage

export interface RelayDecision {
    shouldRelay: boolean;
    delayMs: number;
    reason: string;
}

export interface NetworkTopology {
    peerCount: number;
    avgRSSI: number;
    congestionLevel: number;
    isCongested: boolean;
}

class MeshRelayOptimizer {
  private relayCount = 0;
  private lastRelayTime = 0;
  private congestionWindow: number[] = [];
  private routeCache: Map<string, string[]> = new Map();

  /**
     * Decide whether and when to relay a packet
     */
  decideRelay(packet: QMeshPacket): RelayDecision {
    const now = Date.now();
    const topology = this.getTopology();

    // Always relay critical messages
    if (packet.header.priority === PacketPriority.CRITICAL || packet.header.type === PacketType.HEARTBEAT) {
      return {
        shouldRelay: true,
        delayMs: 0,
        reason: 'critical_priority',
      };
    }

    // Check congestion
    if (topology.isCongested) {
      const backoff = this.calculateBackoff(packet.header.priority);
      return {
        shouldRelay: true,
        delayMs: backoff,
        reason: 'congestion_backoff',
      };
    }

    // Check minimum interval
    const timeSinceLastRelay = now - this.lastRelayTime;
    if (timeSinceLastRelay < MIN_RELAY_INTERVAL_MS) {
      return {
        shouldRelay: true,
        delayMs: MIN_RELAY_INTERVAL_MS - timeSinceLastRelay,
        reason: 'rate_limit',
      };
    }

    // Check peer count (no peers = no relay needed)
    if (topology.peerCount === 0) {
      return {
        shouldRelay: false,
        delayMs: 0,
        reason: 'no_peers',
      };
    }

    // Standard relay
    const jitter = Math.floor(Math.random() * 50); // Random jitter to prevent collisions
    return {
      shouldRelay: true,
      delayMs: jitter,
      reason: 'standard',
    };
  }

  /**
     * Record that a relay was made
     */
  recordRelay() {
    const now = Date.now();
    this.relayCount++;
    this.lastRelayTime = now;
    this.congestionWindow.push(now);

    // Keep only last 1 second of data
    const oneSecondAgo = now - 1000;
    this.congestionWindow = this.congestionWindow.filter((t) => t > oneSecondAgo);
  }

  /**
     * Get current network topology
     */
  getTopology(): NetworkTopology {
    const state = useMeshStore.getState();
    const peers = Object.values(state.peers);

    const peerCount = peers.length;
    const avgRSSI =
            peers.length > 0
              ? peers.reduce((sum, p) => sum + p.rssi, 0) / peers.length
              : -100;

    const congestionLevel = this.congestionWindow.length;
    const isCongested = congestionLevel > CONGESTION_THRESHOLD;

    return {
      peerCount,
      avgRSSI,
      congestionLevel,
      isCongested,
    };
  }

  /**
     * Cache a known route
     */
  cacheRoute(destination: string, hops: string[]) {
    this.routeCache.set(destination, hops);

    // Limit cache size
    if (this.routeCache.size > 100) {
      const oldest = this.routeCache.keys().next().value;
      if (oldest) this.routeCache.delete(oldest);
    }
  }

  /**
     * Get cached route if available
     */
  getCachedRoute(destination: string): string[] | undefined {
    return this.routeCache.get(destination);
  }

  /**
     * Clear route cache
     */
  clearRouteCache() {
    this.routeCache.clear();
  }

  // Private Helpers

  private calculateBackoff(priority: PacketPriority): number {
    const baseDelay = MIN_RELAY_INTERVAL_MS;
    const congestion = this.congestionWindow.length;

    switch (priority) {
    case PacketPriority.HIGH:
      return baseDelay + congestion * 10;
    case PacketPriority.NORMAL:
      return baseDelay + congestion * 20;
    case PacketPriority.LOW:
      return baseDelay + congestion * 50;
    default:
      return baseDelay;
    }
  }
}

export const meshRelayOptimizer = new MeshRelayOptimizer();
