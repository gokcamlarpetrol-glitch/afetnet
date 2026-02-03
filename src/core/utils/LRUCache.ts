/**
 * LRU CACHE - ELITE EDITION
 * Least Recently Used cache implementation for efficient memory usage
 * 
 * Features:
 * - O(1) get/set operations
 * - Automatic eviction of least recently used items
 * - Size-bounded memory usage
 * - Persistence support
 */

export class LRUCache<K, V> {
    private cache: Map<K, V>;
    private readonly maxSize: number;

    constructor(maxSize: number) {
        if (maxSize <= 0) throw new Error('LRU cache size must be positive');
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    /**
     * Get a value from the cache, updating its recency
     */
    get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }

        // Move to end (most recently used)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    /**
     * Set a value in the cache
     */
    set(key: K, value: V): void {
        // If key exists, delete it first (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Add to cache
        this.cache.set(key, value);

        // Evict oldest if over capacity
        if (this.cache.size > this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
    }

    /**
     * Check if key exists
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Delete a key
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear the entire cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get current size
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Get all keys (oldest to newest)
     */
    keys(): K[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get all values (oldest to newest)
     */
    values(): V[] {
        return Array.from(this.cache.values());
    }

    /**
     * Get all entries (oldest to newest)
     */
    entries(): [K, V][] {
        return Array.from(this.cache.entries());
    }

    /**
     * Check and record (for seen ID tracking)
     * Returns true if the key was NOT in cache (new)
     */
    checkAndRecord(key: K, value: V): boolean {
        if (this.has(key)) {
            return false; // Already seen
        }
        this.set(key, value);
        return true; // New
    }

    /**
     * Export to array for persistence
     */
    toArray(): [K, V][] {
        return this.entries();
    }

    /**
     * Import from array
     */
    fromArray(entries: [K, V][]): void {
        this.clear();
        // Only take the last maxSize entries
        const startIndex = Math.max(0, entries.length - this.maxSize);
        for (let i = startIndex; i < entries.length; i++) {
            this.cache.set(entries[i][0], entries[i][1]);
        }
    }
}

/**
 * Simple Set-like LRU for ID tracking
 */
export class LRUSet<T> {
    private lru: LRUCache<T, boolean>;

    constructor(maxSize: number) {
        this.lru = new LRUCache<T, boolean>(maxSize);
    }

    add(value: T): boolean {
        const isNew = !this.lru.has(value);
        this.lru.set(value, true);
        return isNew;
    }

    has(value: T): boolean {
        return this.lru.has(value);
    }

    delete(value: T): boolean {
        return this.lru.delete(value);
    }

    clear(): void {
        this.lru.clear();
    }

    get size(): number {
        return this.lru.size;
    }

    /**
     * Check if value exists, if not add it
     * Returns true if the value is NEW (not seen before)
     */
    checkAndAdd(value: T): boolean {
        if (this.has(value)) {
            return false; // Already exists
        }
        this.add(value);
        return true; // New
    }

    toArray(): T[] {
        return this.lru.keys();
    }

    fromArray(values: T[]): void {
        this.clear();
        values.forEach(v => this.add(v));
    }
}

export default LRUCache;
