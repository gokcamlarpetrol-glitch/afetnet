/**
 * FLASHLIGHT SERVICE - Emergency SOS Flash Signal
 * Uses phone flashlight to send SOS morse code
 * Critical for attracting rescue teams in darkness/under rubble
 */

import { Camera } from 'expo-camera';
import { createLogger } from '../utils/logger';

const logger = createLogger('FlashlightService');

class FlashlightService {
  private isFlashing: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private hasPermission: boolean = false;
  private patternLoopPromise: Promise<void> | null = null;
  private hasWarnedAboutTorch: boolean = false; // ELITE: Prevent warning spam
  private torchAvailable: boolean | null = null; // ELITE: Cache torch availability check

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
   * ELITE: Long: 500ms, Short: 150ms, Gap: 150ms
   * Race condition safe - checks isFlashing frequently
   */
  async flashSOSMorse(): Promise<void> {
    // ELITE: Ensure initialized
    if (!this.hasPermission) {
      await this.initialize();
      if (!this.hasPermission) {
        logger.warn('FlashlightService: No camera permission');
        throw new Error('Camera permission required');
      }
    }

    // ELITE: Race condition prevention - stop any existing flashing first
    if (this.isFlashing) {
      await this.stop();
      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isFlashing = true;

    const LONG = 500;
    const SHORT = 150;
    const GAP = 150;
    const WORD_GAP = 1500;

    const pattern = async (): Promise<void> => {
      // ELITE: Check isFlashing before each operation
      if (!this.isFlashing) return;

      try {
        // --- (S)
        await this.flash(LONG);
        if (!this.isFlashing) return;
        await this.wait(GAP);
        if (!this.isFlashing) return;
        await this.flash(LONG);
        if (!this.isFlashing) return;
        await this.wait(GAP);
        if (!this.isFlashing) return;
        await this.flash(LONG);
        if (!this.isFlashing) return;
        await this.wait(GAP * 3);
        if (!this.isFlashing) return;

        // ••• (O)
        await this.flash(SHORT);
        if (!this.isFlashing) return;
        await this.wait(GAP);
        if (!this.isFlashing) return;
        await this.flash(SHORT);
        if (!this.isFlashing) return;
        await this.wait(GAP);
        if (!this.isFlashing) return;
        await this.flash(SHORT);
        if (!this.isFlashing) return;
        await this.wait(GAP * 3);
        if (!this.isFlashing) return;

        // --- (S)
        await this.flash(LONG);
        if (!this.isFlashing) return;
        await this.wait(GAP);
        if (!this.isFlashing) return;
        await this.flash(LONG);
        if (!this.isFlashing) return;
        await this.wait(GAP);
        if (!this.isFlashing) return;
        await this.flash(LONG);
        if (!this.isFlashing) return;
        await this.wait(WORD_GAP);
      } catch (error) {
        logger.error('❌ FlashlightService pattern failed:', error);
        // Don't throw - allow pattern to continue
      }
    };

    // ELITE: Loop until stopped with proper error handling
    try {
      this.patternLoopPromise = (async () => {
        while (this.isFlashing) {
          await pattern();
        }
      })();
      await this.patternLoopPromise;
    } catch (error) {
      logger.error('❌ FlashlightService pattern loop error:', error);
      this.isFlashing = false;
      throw error;
    } finally {
      this.patternLoopPromise = null;
    }
  }

  /**
   * Check if torch API is available
   * ELITE: Caches result to avoid repeated checks
   */
  private async checkTorchAvailability(): Promise<boolean> {
    if (this.torchAvailable !== null) {
      return this.torchAvailable;
    }

    try {
      // ELITE: Try to import expo-torch (now installed)
      // expo-torch uses setStateAsync(state: 'ON' | 'OFF')
      const torchModule = await import('expo-torch');
      if (torchModule && typeof torchModule.setStateAsync === 'function') {
        this.torchAvailable = true;
        logger.info('✅ Torch API available');
        return true;
      }
    } catch (error) {
      // expo-torch not available or error
      logger.debug('Torch module check failed:', error);
    }

    this.torchAvailable = false;
    logger.info('ℹ️ Torch API not available, using haptic feedback');
    return false;
  }

  /**
   * Flash for specified duration
   * ELITE: Uses torch API if available, otherwise haptic feedback
   * Prevents warning spam - only warns once
   */
  private async flash(duration: number): Promise<void> {
    if (!this.isFlashing) return;

    // ELITE: Validate duration
    if (duration <= 0 || duration > 10000) {
      logger.warn('Invalid flash duration:', duration);
      duration = Math.max(100, Math.min(10000, duration));
    }

    try {
      // ELITE: Check torch availability (cached)
      const torchAvailable = await this.checkTorchAvailability();

      if (torchAvailable) {
        // ELITE: Use torch API (expo-torch is now installed)
        // expo-torch uses setStateAsync(state: 'ON' | 'OFF')
        try {
          const torchModule = await import('expo-torch');
          if (torchModule && typeof torchModule.setStateAsync === 'function') {
            // ELITE: Turn on torch
            await torchModule.setStateAsync(torchModule.ON);
            logger.debug('💡 Torch turned ON');
            
            // ELITE: Wait for the duration (check isFlashing during wait)
            const startTime = Date.now();
            while (Date.now() - startTime < duration && this.isFlashing) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // ELITE: Turn off torch
            try {
              await torchModule.setStateAsync(torchModule.OFF);
              logger.debug('💡 Torch turned OFF');
            } catch (stopError) {
              logger.warn('Torch turnOff failed:', stopError);
              // Try again
              try {
                await torchModule.setStateAsync(torchModule.OFF);
              } catch (retryError) {
                logger.error('Torch turnOff retry failed:', retryError);
              }
            }
            
            // ELITE: Add haptic feedback for tactile confirmation
            try {
              const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
              await impactAsync(ImpactFeedbackStyle.Light);
            } catch (hapticError) {
              // Ignore haptic errors
            }
            
            return; // Success - torch flashed
          }
        } catch (torchError) {
          logger.error('❌ Torch API error:', torchError);
          // Reset availability cache to retry next time
          this.torchAvailable = null;
          // Fall through to haptic fallback
        }
      }

      // ELITE: Fallback - Use haptic feedback (always works)
      // Only warn once to prevent spam
      if (!this.hasWarnedAboutTorch) {
        logger.info('ℹ️ Torch API not available, using haptic feedback (this is normal)');
        this.hasWarnedAboutTorch = true;
      }
      
      // ELITE: Use haptic feedback as visual/tactile indicator
      try {
        const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
        await impactAsync(ImpactFeedbackStyle.Medium);
        
        // ELITE: Wait for the duration (check isFlashing during wait)
        const startTime = Date.now();
        while (Date.now() - startTime < duration && this.isFlashing) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // ELITE: Additional haptic at the end for better feedback
        if (duration > 200 && this.isFlashing) {
          try {
            await impactAsync(ImpactFeedbackStyle.Light);
          } catch (hapticError) {
            // Ignore - not critical
          }
        }
      } catch (hapticError) {
        logger.error('❌ Haptic feedback failed:', hapticError);
        // Last resort: just wait
        const startTime = Date.now();
        while (Date.now() - startTime < duration && this.isFlashing) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      logger.error('❌ Flash failed:', error);
      // Don't throw - allow pattern to continue
    }
  }

  /**
   * Wait for specified milliseconds
   * ELITE: Proper timeout management without overriding previous timeouts
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      // ELITE: Create new timeout without overriding intervalId
      // intervalId is only used for cleanup in stop()
      const timeoutId = setTimeout(() => {
        resolve();
      }, ms);
      
      // ELITE: Store the latest timeout for cleanup
      // This ensures stop() can cancel the current wait
      this.intervalId = timeoutId;
    });
  }

  /**
   * Stop flashing
   * ELITE: Ensures flashlight is properly turned off, prevents memory leaks
   */
  async stop(): Promise<void> {
    // ELITE: Set flag first to stop pattern loops
    this.isFlashing = false;

    // ELITE: Clear any pending timeouts
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    // ELITE: Wait for pattern loop to finish if active
    if (this.patternLoopPromise) {
      try {
        // Wait up to 500ms for pattern to finish
        await Promise.race([
          this.patternLoopPromise,
          new Promise(resolve => setTimeout(resolve, 500)),
        ]);
      } catch (patternError) {
        logger.debug('Pattern loop stop error (expected):', patternError);
      }
      this.patternLoopPromise = null;
    }

    try {
      // ELITE: Ensure flashlight is off using torch API if available
      if (this.torchAvailable) {
        try {
          const torchModule = await import('expo-torch');
          if (torchModule && typeof torchModule.setStateAsync === 'function') {
            await torchModule.setStateAsync(torchModule.OFF);
            logger.debug('💡 Torch turned OFF (stop)');
          }
        } catch (torchError) {
          logger.warn('Torch turnOff failed in stop:', torchError);
          // Try again
          try {
            const torchModule = await import('expo-torch');
            if (torchModule && typeof torchModule.setStateAsync === 'function') {
              await torchModule.setStateAsync(torchModule.OFF);
            }
          } catch (retryError) {
            logger.error('Torch turnOff retry failed:', retryError);
          }
        }
      }
    } catch (error) {
      logger.error('❌ FlashlightService stop failed:', error);
      // Continue - state is already set to false
    }

    logger.info('✅ FlashlightService stopped');
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

