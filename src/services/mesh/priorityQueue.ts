import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { MeshMsg, clampTTL, generateMsgId } from './codec';

export type Priority = 'HIGH' | 'NORMAL' | 'LOW';

export interface QueuedMessage {
  msg: MeshMsg;
  priority: Priority;
  attempts: number;
  lastAttempt: number;
  maxAttempts: number;
}

export interface QueueStats {
  high: number;
  normal: number;
  low: number;
  total: number;
}

class PriorityQueue {
  private queues: Map<Priority, QueuedMessage[]> = new Map([
    ['HIGH', []],
    ['NORMAL', []],
    ['LOW', []]
  ]);
  private seenIds: Set<string> = new Set();
  private storageKey = 'afn/mesh/queue';

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.queues = new Map(data.queues);
        this.seenIds = new Set(data.seenIds);
      }
    } catch (error) {
      logger.warn('Failed to load queue from storage:', error);
    }
  }

  private async saveToStorage() {
    try {
      const data = {
        queues: Array.from(this.queues.entries()),
        seenIds: Array.from(this.seenIds)
      };
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      logger.warn('Failed to save queue to storage:', error);
    }
  }

  private cleanupSeenIds() {
    // Keep only recent IDs to prevent memory bloat
    if (this.seenIds.size > 1000) {
      const ids = Array.from(this.seenIds);
      this.seenIds = new Set(ids.slice(-500));
    }
  }

  enqueue(msg: MeshMsg, priority: Priority = 'NORMAL', maxAttempts: number = 3): boolean {
    // Check if already seen
    if (this.seenIds.has(msg.id)) {
      return false;
    }

    // Clamp TTL
    msg.ttl = clampTTL(msg.ttl);

    const queuedMsg: QueuedMessage = {
      msg,
      priority,
      attempts: 0,
      lastAttempt: 0,
      maxAttempts
    };

    this.queues.get(priority)!.push(queuedMsg);
    this.seenIds.add(msg.id);
    this.cleanupSeenIds();
    this.saveToStorage();
    return true;
  }

  dequeue(): QueuedMessage | null {
    // Priority order: HIGH -> NORMAL -> LOW
    for (const priority of ['HIGH', 'NORMAL', 'LOW'] as Priority[]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  peekNext(): QueuedMessage | null {
    for (const priority of ['HIGH', 'NORMAL', 'LOW'] as Priority[]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue[0];
      }
    }
    return null;
  }

  retry(msg: QueuedMessage): boolean {
    if (msg.attempts >= msg.maxAttempts) {
      return false; // Max attempts reached
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    const baseDelay = Math.pow(2, msg.attempts) * 1000; // Exponential backoff
    const delay = baseDelay + jitter;

    msg.attempts++;
    msg.lastAttempt = Date.now() + delay;

    // Re-queue with delay
    setTimeout(() => {
      this.queues.get(msg.priority)!.push(msg);
      this.saveToStorage();
    }, delay);

    return true;
  }

  isSeen(msgId: string): boolean {
    return this.seenIds.has(msgId);
  }

  markSeen(msgId: string) {
    this.seenIds.add(msgId);
    this.cleanupSeenIds();
  }

  getStats(): QueueStats {
    return {
      high: this.queues.get('HIGH')!.length,
      normal: this.queues.get('NORMAL')!.length,
      low: this.queues.get('LOW')!.length,
      total: this.queues.get('HIGH')!.length + 
             this.queues.get('NORMAL')!.length + 
             this.queues.get('LOW')!.length
    };
  }

  clear() {
    this.queues.forEach(queue => queue.length = 0);
    this.seenIds.clear();
    this.saveToStorage();
  }

  flush(priority?: Priority) {
    if (priority) {
      this.queues.get(priority)!.length = 0;
    } else {
      this.queues.forEach(queue => queue.length = 0);
    }
    this.saveToStorage();
  }
}

export const meshQueue = new PriorityQueue();
