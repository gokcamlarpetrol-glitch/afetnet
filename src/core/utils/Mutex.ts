/**
 * SIMPLE MUTEX - ELITE EDITION
 * Basic mutex implementation for preventing race conditions
 */

export class Mutex {
    private locked = false;
    private waiting: (() => void)[] = [];

    /**
     * Acquire the lock
     */
    async acquire(): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return;
        }

        // Wait for lock to be released
        await new Promise<void>(resolve => {
            this.waiting.push(resolve);
        });
    }

    /**
     * Release the lock
     */
    release(): void {
        if (this.waiting.length > 0) {
            const next = this.waiting.shift();
            if (next) next();
        } else {
            this.locked = false;
        }
    }

    /**
     * Execute a function with the lock held
     */
    async withLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    /**
     * Check if lock is held
     */
    isLocked(): boolean {
        return this.locked;
    }
}

/**
 * Debounce utility
 */
export class Debouncer {
    private timer: NodeJS.Timeout | null = null;
    private readonly delay: number;

    constructor(delay: number) {
        this.delay = delay;
    }

    /**
     * Schedule a function to run after delay, canceling any pending calls
     */
    schedule(fn: () => void): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            this.timer = null;
            fn();
        }, this.delay);
    }

    /**
     * Cancel any pending execution
     */
    cancel(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * Force immediate execution of pending function
     */
    flush(fn: () => void): void {
        this.cancel();
        fn();
    }
}

/**
 * Rate limiter / throttle
 */
export class Throttle {
    private lastExecution: number = 0;
    private readonly interval: number;

    constructor(interval: number) {
        this.interval = interval;
    }

    /**
     * Check if we can execute (and update last execution time)
     */
    canExecute(): boolean {
        const now = Date.now();
        if (now - this.lastExecution >= this.interval) {
            this.lastExecution = now;
            return true;
        }
        return false;
    }

    /**
     * Execute function if throttle allows
     */
    execute<T>(fn: () => T): T | undefined {
        if (this.canExecute()) {
            return fn();
        }
        return undefined;
    }

    /**
     * Reset the throttle
     */
    reset(): void {
        this.lastExecution = 0;
    }
}

export default Mutex;
