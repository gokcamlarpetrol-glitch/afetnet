import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageData, MessageEncoder } from './message';
import { BLEMeshManager } from './ble';

export interface QueueMessage {
  id: string;
  data: MessageData;
  timestamp: number;
  ttl: number;
  retries: number;
  delivered: boolean;
  priority: number;
  isEEW?: boolean; // Flag for EEW messages that need fast-path processing
}

export interface DedupEntry {
  id: string;
  timestamp: number;
  seen: boolean;
}

export class MessageQueue {
  private static instance: MessageQueue;
  private queue: QueueMessage[] = [];
  private lruCache: Map<string, number> = new Map();
  private bloomFilter: Set<string> = new Set();
  private maxLRUSize = 5000;
  private maxBloomSize = 10000;
  private readonly STORAGE_KEY = 'message_queue';
  private readonly DEDUP_KEY = 'message_dedup';
  private readonly BLE_MANAGER = BLEMeshManager.getInstance();
  private burstMode = false;
  private burstTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.loadQueue();
    this.loadDedupData();
  }

  static getInstance(): MessageQueue {
    if (!MessageQueue.instance) {
      MessageQueue.instance = new MessageQueue();
    }
    return MessageQueue.instance;
  }

  async enqueue(messageData: MessageData, priority: number = 0, isEEW: boolean = false): Promise<void> {
    try {
      // Check for duplicates
      if (await this.isDuplicate(messageData.id)) {
        console.log('Duplicate message detected, skipping:', messageData.id);
        return;
      }

      // EEW messages get special fast-path processing
      if (isEEW || this.isEEWMessage(messageData)) {
        priority = Math.max(priority, 2); // Ensure EEW messages have highest priority
        console.log('EEW message detected, using fast-path:', messageData.id);
      }

      const queueMessage: QueueMessage = {
        id: messageData.id,
        data: messageData,
        timestamp: Date.now(),
        ttl: messageData.ttl,
        retries: 0,
        delivered: false,
        priority,
        isEEW: isEEW || this.isEEWMessage(messageData),
      };

      // Add to queue (sorted by priority, then timestamp)
      this.queue.push(queueMessage);
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.timestamp - b.timestamp; // Older messages first
      });

      // Update dedup data
      await this.addToDedup(messageData.id);

      // Save queue
      await this.saveQueue();

      console.log('Message enqueued:', messageData.id);
    } catch (error) {
      console.error('Failed to enqueue message:', error);
    }
  }

  // Fast-path method for EEW messages
  async enqueueEEWImmediate(messageData: MessageData): Promise<void> {
    try {
      console.log('EEW immediate enqueue:', messageData.id);
      
      // Skip duplicate check for immediate processing
      const queueMessage: QueueMessage = {
        id: messageData.id,
        data: messageData,
        timestamp: Date.now(),
        ttl: messageData.ttl,
        retries: 0,
        delivered: false,
        priority: 3, // Highest priority for immediate EEW
        isEEW: true,
      };

      // Add to front of queue for immediate processing
      this.queue.unshift(queueMessage);
      
      // Enable burst mode for fast propagation
      this.enableBurst(4000); // 4 second burst
      
      // Trigger immediate broadcast
      await this.BLE_MANAGER.advertiseMessage(queueMessage);
      
      // Save queue state
      await this.saveQueue();
      
      console.log('EEW message queued for immediate processing:', messageData.id);
    } catch (error) {
      console.error('Failed to enqueue EEW message immediately:', error);
    }
  }

  // Enable burst mode for increased scan/advertise frequency
  async enableBurst(durationMs: number = 4000): Promise<void> {
    try {
      if (this.burstMode) {
        return; // Already in burst mode
      }

      console.log(`Enabling EEW burst mode for ${durationMs}ms`);
      
      this.burstMode = true;
      
      // Increase BLE scan and advertise frequency
      await this.BLE_MANAGER.setBurstMode(true);
      
      // Set timer to disable burst mode
      this.burstTimer = setTimeout(async () => {
        await this.disableBurst();
      }, durationMs);
      
      console.log('EEW burst mode enabled');
    } catch (error) {
      console.error('Failed to enable EEW burst mode:', error);
    }
  }

  async disableBurst(): Promise<void> {
    try {
      if (!this.burstMode) {
        return;
      }

      console.log('Disabling EEW burst mode');
      
      this.burstMode = false;
      
      // Restore normal BLE scan and advertise frequency
      await this.BLE_MANAGER.setBurstMode(false);
      
      if (this.burstTimer) {
        clearTimeout(this.burstTimer);
        this.burstTimer = null;
      }
      
      console.log('EEW burst mode disabled');
    } catch (error) {
      console.error('Failed to disable EEW burst mode:', error);
    }
  }

  isBurstMode(): boolean {
    return this.burstMode;
  }

  async dequeue(): Promise<QueueMessage | null> {
    if (this.queue.length === 0) {
      return null;
    }

    const message = this.queue.shift();
    if (!message) {
      return null;
    }

    // Check TTL
    if (this.isExpired(message)) {
      console.log('Message expired, removing:', message.id);
      await this.saveQueue();
      return await this.dequeue(); // Try next message
    }

    // Save updated queue
    await this.saveQueue();

    return message;
  }

  async processQueue(): Promise<void> {
    try {
      const message = await this.dequeue();
      if (!message) {
        return;
      }

      // Try to send message via BLE
      const success = await this.sendMessage(message);
      
      if (success) {
        message.delivered = true;
        console.log('Message delivered:', message.id);
      } else {
        message.retries++;
        
        // If retries exceeded, remove from queue
        if (message.retries >= 3) {
          console.log('Message failed after max retries:', message.id);
          await this.saveQueue();
          return;
        }
        
        // Re-queue with backoff delay
        message.timestamp = Date.now() + (message.retries * 5000); // 5s, 10s, 15s backoff
        this.queue.push(message);
        this.queue.sort((a, b) => a.timestamp - b.timestamp);
      }

      await this.saveQueue();
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  }

  private async sendMessage(message: QueueMessage): Promise<boolean> {
    try {
      // Try to broadcast via BLE
      const sentCount = await this.BLE_MANAGER.broadcastMessage(message.data);
      return sentCount > 0;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  private isExpired(message: QueueMessage): boolean {
    const age = Date.now() - message.timestamp;
    const maxAge = message.ttl * 60000; // Convert TTL from minutes to milliseconds
    return age > maxAge;
  }

  private isEEWMessage(messageData: MessageData): boolean {
    // EEW messages are types 3 (EEW_P) and 4 (EEW_ACK)
    return messageData.t === 3 || messageData.t === 4;
  }

  private async isDuplicate(messageId: string): Promise<boolean> {
    // Check LRU cache first
    if (this.lruCache.has(messageId)) {
      this.lruCache.set(messageId, Date.now());
      return true;
    }

    // Check bloom filter
    if (this.bloomFilter.has(messageId)) {
      // Bloom filter says it might exist, check persistent storage
      const stored = await AsyncStorage.getItem(`${this.DEDUP_KEY}_${messageId}`);
      if (stored) {
        const entry: DedupEntry = JSON.parse(stored);
        const age = Date.now() - entry.timestamp;
        
        // If entry is older than 24 hours, it's no longer considered duplicate
        if (age > 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(`${this.DEDUP_KEY}_${messageId}`);
          return false;
        }
        
        this.lruCache.set(messageId, Date.now());
        return true;
      }
    }

    return false;
  }

  private async addToDedup(messageId: string): Promise<void> {
    const entry: DedupEntry = {
      id: messageId,
      timestamp: Date.now(),
      seen: true,
    };

    // Add to LRU cache
    this.lruCache.set(messageId, Date.now());
    this.manageLRUCache();

    // Add to bloom filter
    this.bloomFilter.add(messageId);
    this.manageBloomFilter();

    // Add to persistent storage
    await AsyncStorage.setItem(
      `${this.DEDUP_KEY}_${messageId}`,
      JSON.stringify(entry)
    );
  }

  private manageLRUCache(): void {
    if (this.lruCache.size > this.maxLRUSize) {
      // Remove oldest entries
      const entries = Array.from(this.lruCache.entries());
      entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp
      
      const toRemove = entries.slice(0, Math.floor(this.maxLRUSize * 0.2));
      for (const [key] of toRemove) {
        this.lruCache.delete(key);
      }
    }
  }

  private manageBloomFilter(): void {
    if (this.bloomFilter.size > this.maxBloomSize) {
      // Clear bloom filter when it gets too large
      this.bloomFilter.clear();
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedQueue = JSON.parse(stored);
        this.queue = parsedQueue.filter((msg: QueueMessage) => !this.isExpired(msg));
        console.log(`Loaded ${this.queue.length} messages from queue`);
      }
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save queue:', error);
    }
  }

  private async loadDedupData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const dedupKeys = keys.filter(key => key.startsWith(this.DEDUP_KEY));
      
      let loadedCount = 0;
      for (const key of dedupKeys) {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const entry: DedupEntry = JSON.parse(stored);
          const age = Date.now() - entry.timestamp;
          
          // Only load entries less than 24 hours old
          if (age < 24 * 60 * 60 * 1000) {
            this.lruCache.set(entry.id, entry.timestamp);
            this.bloomFilter.add(entry.id);
            loadedCount++;
          } else {
            // Remove expired entries
            await AsyncStorage.removeItem(key);
          }
        }
      }
      
      console.log(`Loaded ${loadedCount} dedup entries`);
    } catch (error) {
      console.error('Failed to load dedup data:', error);
    }
  }

  // Public utility methods
  getQueueLength(): number {
    return this.queue.length;
  }

  getQueueStatus(): {
    total: number;
    pending: number;
    delivered: number;
    expired: number;
  } {
    const total = this.queue.length;
    const pending = this.queue.filter(msg => !msg.delivered && !this.isExpired(msg)).length;
    const delivered = this.queue.filter(msg => msg.delivered).length;
    const expired = this.queue.filter(msg => this.isExpired(msg)).length;

    return { total, pending, delivered, expired };
  }

  async clearExpiredMessages(): Promise<number> {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(msg => !this.isExpired(msg));
    const removedCount = initialLength - this.queue.length;
    
    if (removedCount > 0) {
      await this.saveQueue();
      console.log(`Cleared ${removedCount} expired messages`);
    }
    
    return removedCount;
  }

  async clearAll(): Promise<void> {
    this.queue = [];
    this.lruCache.clear();
    this.bloomFilter.clear();
    await AsyncStorage.multiRemove([
      this.STORAGE_KEY,
      ...(await AsyncStorage.getAllKeys()).filter(key => key.startsWith(this.DEDUP_KEY))
    ]);
    console.log('Message queue cleared');
  }

  async startQueueProcessor(intervalMs: number = 5000): Promise<NodeJS.Timeout> {
    return setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }
}