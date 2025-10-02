import { KeyManager } from './keys';

export interface EphemeralIdInfo {
  id: string;
  publicKey: Uint8Array;
  timestamp: number;
  expiresAt: number;
}

export class EphemeralIdManager {
  private static instance: EphemeralIdManager;
  private keyManager: KeyManager;
  private rotationCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.keyManager = KeyManager.getInstance();
  }

  static getInstance(): EphemeralIdManager {
    if (!EphemeralIdManager.instance) {
      EphemeralIdManager.instance = new EphemeralIdManager();
    }
    return EphemeralIdManager.instance;
  }

  async initialize(): Promise<void> {
    // Start periodic rotation check
    this.startRotationCheck();
    console.log('EphemeralIdManager initialized');
  }

  private startRotationCheck(): void {
    // Check every 5 minutes if rotation is needed
    this.rotationCheckInterval = setInterval(async () => {
      await this.checkAndRotateIfNeeded();
    }, 5 * 60 * 1000);
  }

  private async checkAndRotateIfNeeded(): Promise<void> {
    try {
      const currentId = this.keyManager.getCurrentEphemeralId();
      if (!currentId) {
        // ID expired, rotate
        await this.keyManager.rotateEphemeralId();
        console.log('Ephemeral ID rotated due to expiration');
      }
    } catch (error) {
      console.error('Error checking ephemeral ID rotation:', error);
    }
  }

  getCurrentId(): string | null {
    const ephemeralId = this.keyManager.getCurrentEphemeralId();
    return ephemeralId ? ephemeralId.id : null;
  }

  getCurrentIdInfo(): EphemeralIdInfo | null {
    const ephemeralId = this.keyManager.getCurrentEphemeralId();
    if (!ephemeralId) {
      return null;
    }

    return {
      id: ephemeralId.id,
      publicKey: ephemeralId.publicKey,
      timestamp: ephemeralId.timestamp,
      expiresAt: ephemeralId.expiresAt,
    };
  }

  async forceRotation(): Promise<string> {
    const newEphemeralId = await this.keyManager.rotateEphemeralId();
    console.log('Ephemeral ID force rotated');
    return newEphemeralId.id;
  }

  getTimeUntilExpiration(): number {
    const ephemeralId = this.keyManager.getCurrentEphemeralId();
    if (!ephemeralId) {
      return 0;
    }

    const now = Date.now();
    return Math.max(0, ephemeralId.expiresAt - now);
  }

  getRotationProgress(): number {
    const ephemeralId = this.keyManager.getCurrentEphemeralId();
    if (!ephemeralId) {
      return 1; // Expired
    }

    const now = Date.now();
    const totalDuration = ephemeralId.expiresAt - ephemeralId.timestamp;
    const elapsed = now - ephemeralId.timestamp;
    
    return Math.min(1, elapsed / totalDuration);
  }

  cleanup(): void {
    if (this.rotationCheckInterval) {
      clearInterval(this.rotationCheckInterval);
      this.rotationCheckInterval = null;
    }
    console.log('EphemeralIdManager cleaned up');
  }
}
