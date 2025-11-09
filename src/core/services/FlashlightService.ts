/**
 * FLASHLIGHT SERVICE - Emergency SOS Flash Signal
 * Uses phone flashlight to send SOS morse code
 * Critical for attracting rescue teams in darkness/under rubble
 */

import { Camera } from 'expo-camera';
import { logger } from '../utils/logger';

class FlashlightService {
  private isFlashing: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private hasPermission: boolean = false;

  /**
   * Initialize camera permissions
   */
  async initialize() {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      this.hasPermission = status === 'granted';
      
      if (this.hasPermission) {
        logger.info('FlashlightService initialized');
      } else {
        logger.warn('FlashlightService: Camera permission denied');
      }
    } catch (error) {
      logger.error('FlashlightService init failed:', error);
    }
  }

  /**
   * Flash SOS Morse Pattern: --- ••• ---
   * Long: 500ms, Short: 150ms, Gap: 150ms
   */
  async flashSOSMorse() {
    if (!this.hasPermission) {
      logger.warn('FlashlightService: No camera permission');
      return;
    }

    if (this.isFlashing) {
      await this.stop();
    }

    this.isFlashing = true;

    const LONG = 500;
    const SHORT = 150;
    const GAP = 150;
    const WORD_GAP = 1500;

    const pattern = async () => {
      if (!this.isFlashing) return;

      try {
        // --- (S)
        await this.flash(LONG);
        await this.wait(GAP);
        await this.flash(LONG);
        await this.wait(GAP);
        await this.flash(LONG);
        await this.wait(GAP * 3);

        // ••• (O)
        await this.flash(SHORT);
        await this.wait(GAP);
        await this.flash(SHORT);
        await this.wait(GAP);
        await this.flash(SHORT);
        await this.wait(GAP * 3);

        // --- (S)
        await this.flash(LONG);
        await this.wait(GAP);
        await this.flash(LONG);
        await this.wait(GAP);
        await this.flash(LONG);
        await this.wait(WORD_GAP);
      } catch (error) {
        logger.error('FlashlightService pattern failed:', error);
      }
    };

    // Loop until stopped
    while (this.isFlashing) {
      await pattern();
    }
  }

  /**
   * Flash for specified duration
   */
  private async flash(duration: number) {
    if (!this.isFlashing) return;

    try {
      // Turn on flashlight
      const cameraModule: any = Camera;
      if (cameraModule.setFlashModeAsync) {
        await cameraModule.setFlashModeAsync('torch');
        await this.wait(duration);
        await cameraModule.setFlashModeAsync('off');
      } else {
        logger.warn('Camera flash API not available');
      }
    } catch (error) {
      // Silently handle - flashlight might not be available
      logger.debug('Flash failed:', error);
    }
  }

  /**
   * Wait for specified milliseconds
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.intervalId = setTimeout(resolve, ms);
    });
  }

  /**
   * Stop flashing
   */
  async stop() {
    this.isFlashing = false;

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    try {
      // Ensure flashlight is off
      const cameraModule: any = Camera;
      if (cameraModule.setFlashModeAsync) {
        await cameraModule.setFlashModeAsync('off');
      }
    } catch (error) {
      logger.error('FlashlightService stop failed:', error);
    }

    logger.info('FlashlightService stopped');
  }

  /**
   * Check if flashlight is currently active
   */
  isActive(): boolean {
    return this.isFlashing;
  }

  /**
   * Check if flashlight is available
   */
  isAvailable(): boolean {
    return this.hasPermission;
  }
}

export const flashlightService = new FlashlightService();

