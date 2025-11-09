/**
 * FLASHLIGHT SERVICE - Emergency SOS Flash Signal
 * Uses phone flashlight to send SOS morse code
 * CRITICAL: This can save lives in emergency situations
 * ELITE LEVEL: Uses expo-camera torch API (most reliable method)
 */

import * as Camera from 'expo-camera';
import { createLogger } from '../utils/logger';

const logger = createLogger('FlashlightService');

class FlashlightService {
  private isFlashing: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private hasPermission: boolean = false;
  private patternLoopPromise: Promise<void> | null = null;
  private hasWarnedAboutTorch: boolean = false;
  private cameraRef: any = null; // ELITE: Camera ref for torch control
  private torchModule: any = null; // ELITE: Cache expo-torch module if available

  /**
   * ELITE: Initialize with comprehensive permission handling
   */
  async initialize() {
    try {
      // ELITE: Request camera permissions with expo-camera v17 API
      let permissionResult;
      try {
        // expo-camera v17 uses requestCameraPermissionsAsync()
        // @ts-ignore - expo-camera types may not export this correctly
        permissionResult = await Camera.requestCameraPermissionsAsync();
      } catch (permissionError: any) {
        // ELITE: Fallback for Hermes engine compatibility
        logger.debug('Direct requestCameraPermissionsAsync failed, trying dynamic import:', permissionError?.message);
        try {
          const cameraModule = await import('expo-camera');
          const requestFn = (cameraModule as any).requestCameraPermissionsAsync || (cameraModule as any).default?.requestCameraPermissionsAsync;
          if (requestFn && typeof requestFn === 'function') {
            permissionResult = await requestFn();
          } else {
            throw new Error('requestCameraPermissionsAsync not found');
          }
        } catch (importError: any) {
          logger.debug('Dynamic import failed:', importError?.message);
          this.hasPermission = false;
          return;
        }
      }
      
      this.hasPermission = permissionResult?.status === 'granted';
      
      // ELITE: Try to load expo-torch as fallback
      if (this.hasPermission && !this.torchModule) {
        try {
          const torch = await import('expo-torch');
          if (torch && (torch.setStateAsync || torch.default?.setStateAsync)) {
            this.torchModule = torch.default || torch;
            logger.info('✅ expo-torch loaded as fallback');
          }
        } catch (torchError) {
          // expo-torch not available - will use Camera API
          logger.debug('expo-torch not available, using Camera API');
        }
      }
      
      if (this.hasPermission) {
        logger.info('✅ FlashlightService initialized with camera permissions');
      } else {
        logger.warn('FlashlightService: Camera permission denied');
      }
    } catch (error) {
      logger.error('FlashlightService init failed:', error);
      this.hasPermission = false;
    }
  }

  /**
   * ELITE: Set camera ref for torch control
   * This allows us to use Camera's torch API
   */
  setCameraRef(ref: any | null) {
    this.cameraRef = ref;
    if (ref) {
      logger.info('✅ Camera ref set for torch control');
    }
  }

  /**
   * ELITE: Turn torch on using Camera API or expo-torch fallback
   */
  private async turnTorchOn(): Promise<boolean> {
    try {
      // ELITE: Try Camera API first (most reliable)
      if (this.cameraRef) {
        try {
          await this.cameraRef.setTorchModeAsync('on');
          logger.info('💡 Torch turned ON (Camera API)');
          return true;
        } catch (cameraError: any) {
          const errorMsg = cameraError?.message || String(cameraError);
          logger.debug('Camera torch API failed:', errorMsg);
          // Continue to fallback
        }
      }

      // ELITE: Fallback to expo-torch if available
      if (this.torchModule) {
        try {
          const setStateAsync = this.torchModule.setStateAsync || this.torchModule.default?.setStateAsync;
          const ON = this.torchModule.ON || this.torchModule.default?.ON || 'ON';
          
          if (setStateAsync && typeof setStateAsync === 'function') {
            const onState = typeof ON === 'string' ? ON : (ON?.toString() || 'ON');
            await setStateAsync(onState);
            logger.info('💡 Torch turned ON (expo-torch fallback)');
            return true;
          }
        } catch (torchError: any) {
          const errorMsg = torchError?.message || String(torchError);
          if (!errorMsg.includes('native module') && !errorMsg.includes('ExpoTorch')) {
            logger.debug('expo-torch failed:', errorMsg);
          }
        }
      }

      return false;
    } catch (error: any) {
      logger.debug('Turn torch on failed:', error?.message);
      return false;
    }
  }

  /**
   * ELITE: Turn torch off using Camera API or expo-torch fallback
   */
  private async turnTorchOff(): Promise<void> {
    try {
      // ELITE: Try Camera API first
      if (this.cameraRef) {
        try {
          // ELITE: Try setTorchModeAsync method (if available)
          if (typeof (this.cameraRef as any).setTorchModeAsync === 'function') {
            await (this.cameraRef as any).setTorchModeAsync('off');
            logger.debug('💡 Torch turned OFF (Camera API - setTorchModeAsync)');
            return;
          }
          // ELITE: Try enableTorch method (if available)
          if (typeof (this.cameraRef as any).enableTorch === 'function') {
            await (this.cameraRef as any).enableTorch(false);
            logger.debug('💡 Torch turned OFF (Camera API - enableTorch)');
            return;
          }
        } catch (cameraError: any) {
          logger.debug('Camera torch OFF failed:', cameraError?.message);
          // Continue to fallback
        }
      }

      // ELITE: Fallback to expo-torch if available
      if (this.torchModule) {
        try {
          const setStateAsync = this.torchModule.setStateAsync || this.torchModule.default?.setStateAsync;
          const OFF = this.torchModule.OFF || this.torchModule.default?.OFF || 'OFF';
          
          if (setStateAsync && typeof setStateAsync === 'function') {
            const offState = typeof OFF === 'string' ? OFF : (OFF?.toString() || 'OFF');
            await setStateAsync(offState);
            logger.debug('💡 Torch turned OFF (expo-torch fallback)');
            return;
          }
        } catch (torchError) {
          // Ignore - not critical
        }
      }
    } catch (error: any) {
      logger.debug('Turn torch off failed:', error?.message);
    }
  }

  /**
   * ELITE: Flash SOS Morse Pattern: --- ••• ---
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

    // ELITE: Race condition prevention
    if (this.isFlashing) {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isFlashing = true;

    const LONG = 500;
    const SHORT = 150;
    const GAP = 150;
    const WORD_GAP = 1500;

    const pattern = async (): Promise<void> => {
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
      }
    };

    // ELITE: Loop until stopped
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
   * ELITE: Flash for specified duration
   * Uses Camera torch API first, then expo-torch, then haptic fallback
   */
  private async flash(duration: number): Promise<void> {
    if (!this.isFlashing) return;

    // ELITE: Validate duration
    if (duration <= 0 || duration > 10000) {
      logger.warn('Invalid flash duration:', duration);
      duration = Math.max(100, Math.min(10000, duration));
    }

    try {
      // ELITE: Try to turn torch on
      const torchOn = await this.turnTorchOn();

      if (torchOn) {
        // ELITE: Wait for duration (check isFlashing during wait)
        const startTime = Date.now();
        while (Date.now() - startTime < duration && this.isFlashing) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // ELITE: Turn torch off
        await this.turnTorchOff();
        
        // ELITE: Add haptic feedback for confirmation
        try {
          const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
          await impactAsync(ImpactFeedbackStyle.Light);
        } catch (hapticError) {
          // Ignore haptic errors
        }
        
        return; // Success - torch flashed
      }

      // ELITE: Fallback - Use haptic feedback
      if (!this.hasWarnedAboutTorch) {
        logger.info('ℹ️ Torch API not available, using haptic feedback');
        this.hasWarnedAboutTorch = true;
      }
      
      try {
        const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
        await impactAsync(ImpactFeedbackStyle.Medium);
        
        // ELITE: Wait for duration
        const startTime = Date.now();
        while (Date.now() - startTime < duration && this.isFlashing) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // ELITE: Additional haptic at the end
        if (duration > 200 && this.isFlashing) {
          try {
            await impactAsync(ImpactFeedbackStyle.Light);
          } catch (hapticError) {
            // Ignore
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
    }
  }

  /**
   * ELITE: Wait for specified milliseconds
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, ms);
      this.intervalId = timeoutId;
    });
  }

  /**
   * ELITE: Stop flashing
   * Ensures flashlight is properly turned off
   */
  async stop(): Promise<void> {
    this.isFlashing = false;

    // ELITE: Clear pending timeouts
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    // ELITE: Wait for pattern loop to finish
    if (this.patternLoopPromise) {
      try {
        await Promise.race([
          this.patternLoopPromise,
          new Promise(resolve => setTimeout(resolve, 500)),
        ]);
      } catch (patternError) {
        logger.debug('Pattern loop stop error (expected):', patternError);
      }
      this.patternLoopPromise = null;
    }

    // ELITE: Ensure flashlight is off
    await this.turnTorchOff();

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
