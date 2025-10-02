export interface TTLConfig {
  defaultTTL: number;
  maxTTL: number;
  hopPenalty: number;
  timePenalty: number;
}

export class MessageTTL {
  private static instance: MessageTTL;
  private config: TTLConfig;

  private constructor() {
    this.config = {
      defaultTTL: 6,
      maxTTL: 8,
      hopPenalty: 1,
      timePenalty: 0.1, // per minute
    };
  }

  static getInstance(): MessageTTL {
    if (!MessageTTL.instance) {
      MessageTTL.instance = new MessageTTL();
    }
    return MessageTTL.instance;
  }

  async initialize(): Promise<void> {
    console.log('MessageTTL initialized');
  }

  isValid(ttl: number, hops: number): boolean {
    return ttl > 0 && hops < this.config.maxTTL;
  }

  decrementTTL(ttl: number, hops: number): number {
    const newTTL = ttl - this.config.hopPenalty;
    return Math.max(0, newTTL);
  }

  calculateTTL(priority: number, underRubble: boolean, injured: boolean): number {
    let ttl = this.config.defaultTTL;

    // High priority messages get longer TTL
    if (priority >= 2) {
      ttl += 2;
    } else if (priority >= 1) {
      ttl += 1;
    }

    // Critical conditions get longer TTL
    if (underRubble) {
      ttl += 2;
    }
    if (injured) {
      ttl += 1;
    }

    return Math.min(ttl, this.config.maxTTL);
  }

  getConfig(): TTLConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<TTLConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
