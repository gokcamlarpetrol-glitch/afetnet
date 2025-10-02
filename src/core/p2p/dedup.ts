import AsyncStorage from '@react-native-async-storage/async-storage';

interface LRUCacheItem {
  key: string;
  value: boolean;
  timestamp: number;
}

// Simple Bloom filter implementation
class SimpleBloomFilter {
  private bits: boolean[];
  private size: number;
  private hashCount: number;

  constructor(capacity: number, errorRate: number) {
    this.size = Math.ceil(-(capacity * Math.log(errorRate)) / (Math.log(2) * Math.log(2)));
    this.bits = new Array(this.size).fill(false);
    this.hashCount = Math.ceil((this.size / capacity) * Math.log(2));
  }

  private hash(str: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % this.size;
  }

  add(str: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      this.bits[this.hash(str, i)] = true;
    }
  }

  has(str: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      if (!this.bits[this.hash(str, i)]) {
        return false;
      }
    }
    return true;
  }

  get size(): number {
    return this.bits.filter(bit => bit).length;
  }

  rate(): number {
    return Math.pow(1 - Math.exp(-this.hashCount * this.size / this.bits.length), this.hashCount);
  }

  // Serialization for persistence
  serialize(): string {
    return JSON.stringify({
      bits: this.bits,
      size: this.size,
      hashCount: this.hashCount,
    });
  }

  static deserialize(data: string): SimpleBloomFilter {
    const parsed = JSON.parse(data);
    const filter = new SimpleBloomFilter(10000, 0.01); // Dummy values
    filter.bits = parsed.bits;
    filter.size = parsed.size;
    filter.hashCount = parsed.hashCount;
    return filter;
  }
}

export class MessageDeduplicator {
  private static instance: MessageDeduplicator;
  private lruCache: Map<string, LRUCacheItem>;
  private bloomFilter: SimpleBloomFilter;
  private readonly LRU_MAX_SIZE = 5000;
  private readonly BLOOM_CAPACITY = 10000;
  private readonly BLOOM_ERROR_RATE = 0.01;
  private readonly PERSISTENCE_KEY = 'afetnet_message_dedup';
  private readonly PERSISTENCE_INTERVAL = 60000; // 1 minute
  private persistenceTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.lruCache = new Map();
    this.bloomFilter = new SimpleBloomFilter(this.BLOOM_CAPACITY, this.BLOOM_ERROR_RATE);
  }

  static getInstance(): MessageDeduplicator {
    if (!MessageDeduplicator.instance) {
      MessageDeduplicator.instance = new MessageDeduplicator();
    }
    return MessageDeduplicator.instance;
  }

  async initialize(): Promise<void> {
    await this.loadPersistedData();
    this.startPeriodicPersistence();
    console.log('MessageDeduplicator initialized');
  }

  private async loadPersistedData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.PERSISTENCE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Load Bloom filter
        if (data.bloomFilter) {
          this.bloomFilter = SimpleBloomFilter.deserialize(data.bloomFilter);
        }
        
        console.log('Deduplication data loaded from storage');
      }
    } catch (error) {
      console.error('Failed to load persisted dedup data:', error);
    }
  }

  private async savePersistedData(): Promise<void> {
    try {
      const data = {
        bloomFilter: this.bloomFilter.serialize(),
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(this.PERSISTENCE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save dedup data:', error);
    }
  }

  private startPeriodicPersistence(): void {
    this.persistenceTimer = setInterval(() => {
      this.savePersistedData();
    }, this.PERSISTENCE_INTERVAL);
  }

  private cleanupLRU(): void {
    if (this.lruCache.size <= this.LRU_MAX_SIZE) {
      return;
    }

    // Remove oldest entries
    const entries = Array.from(this.lruCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, this.lruCache.size - this.LRU_MAX_SIZE);
    toRemove.forEach(([key]) => {
      this.lruCache.delete(key);
    });
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, item] of this.lruCache.entries()) {
      if (now - item.timestamp > maxAge) {
        this.lruCache.delete(key);
      }
    }
  }

  isDuplicate(messageId: string): boolean {
    // Check LRU cache first (fastest)
    if (this.lruCache.has(messageId)) {
      const item = this.lruCache.get(messageId)!;
      item.timestamp = Date.now(); // Update access time
      return item.value;
    }

    // Check Bloom filter (fast but may have false positives)
    if (!this.bloomFilter.has(messageId)) {
      // Definitely not seen before
      this.bloomFilter.add(messageId);
      this.lruCache.set(messageId, {
        key: messageId,
        value: false,
        timestamp: Date.now(),
      });
      this.cleanupLRU();
      return false;
    }

    // Bloom filter says it might be a duplicate
    // In a real app, you'd check persistent storage here
    // For now, we'll assume it's a duplicate if it's in the bloom filter
    this.lruCache.set(messageId, {
      key: messageId,
      value: true,
      timestamp: Date.now(),
    });
    this.cleanupLRU();
    return true;
  }

  markAsSeen(messageId: string): void {
    this.bloomFilter.add(messageId);
    this.lruCache.set(messageId, {
      key: messageId,
      value: true,
      timestamp: Date.now(),
    });
    this.cleanupLRU();
  }

  getStats(): {
    lruSize: number;
    bloomFilterSize: number;
    estimatedFalsePositiveRate: number;
  } {
    return {
      lruSize: this.lruCache.size,
      bloomFilterSize: this.bloomFilter.size,
      estimatedFalsePositiveRate: this.bloomFilter.rate(),
    };
  }

  clear(): void {
    this.lruCache.clear();
    this.bloomFilter = new SimpleBloomFilter(this.BLOOM_CAPACITY, this.BLOOM_ERROR_RATE);
  }

  // Periodic cleanup
  startPeriodicCleanup(intervalMs: number = 60000): void {
    setInterval(() => {
      this.cleanupOldEntries();
    }, intervalMs);
  }

  cleanup(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    this.savePersistedData();
    console.log('MessageDeduplicator cleaned up');
  }
}
