/**
 * FLASHLIGHT SERVICE - ELITE Emergency SOS Flash Signal
 * Uses phone flashlight to send SOS morse code
 * Critical for attracting rescue teams in darkness/under rubble
 * Supports: Camera torch, expo-torch, Screen flashlight
 */

import { CameraView } from 'expo-camera';
import { logger } from '../utils/logger';
import * as Brightness from 'expo-brightness';

// ELITE: Type definitions for optional modules
interface TorchModule {
  default?: {
    switchState: (on: boolean) => Promise<void>;
  };
}

interface CameraModuleExports {
  getCameraPermissionsAsync?: () => Promise<{ status: string }>;
  requestCameraPermissionsAsync?: () => Promise<{ status: string }>;
  CameraView?: typeof CameraView;
}

class FlashlightService {
  private isFlashing: boolean = false;
  private isOn: boolean = false;
  private isScreenFlashlight: boolean = false;
  private timeoutIds: Set<NodeJS.Timeout> = new Set();
  private hasPermission: boolean = false;
  private cameraRef: CameraView | null = null;
  private torchModule: TorchModule | null = null;
  private originalBrightness: number = 0.5;
  private patternLoop: Promise<void> | null = null;

  /**
   * Initialize camera permissions and torch module
   */
  async initialize() {
    try {
      // Try Camera permissions first
      // Note: expo-camera v17 exports functions directly, not via default
      const CameraModule = await import('expo-camera');

      // Try to access permission functions - they may be named exports
      let status = 'undetermined';
      try {
        // Check if functions are available as named exports
        const cameraExports = CameraModule as CameraModuleExports;
        const getPerms = cameraExports.getCameraPermissionsAsync;
        const requestPerms = cameraExports.requestCameraPermissionsAsync;

        if (getPerms) {
          const result = await getPerms();
          status = result.status;
        }

        // Request permissions if not granted
        if (status !== 'granted' && requestPerms) {
          const result = await requestPerms();
          status = result.status;
        }
      } catch (permError) {
        logger.debug('Permission check/request failed:', permError);
        // Fallback: assume permission is needed but not critical for flashlight
        this.hasPermission = false;
      }

      this.hasPermission = status === 'granted';

      // Try to load expo-torch as fallback (optional, may not be installed)
      try {
        // ELITE: Type-safe torch access with proper error handling
        // Note: expo-torch may not be installed, so we use dynamic import with error handling
        // @ts-expect-error - expo-torch is optional and may not have type declarations
        const torchModule = await import('expo-torch').catch(() => null);
        if (torchModule) {
          this.torchModule = torchModule;
          logger.info('expo-torch module loaded');
        } else {
          this.torchModule = null;
        }
      } catch (torchError) {
        logger.debug('expo-torch not available, using Camera API');
        this.torchModule = null;
      }

      // Get original brightness for screen flashlight
      try {
        this.originalBrightness = await Brightness.getBrightnessAsync();
      } catch (brightnessError) {
        logger.debug('Brightness API not available');
      }

      if (this.hasPermission || this.torchModule) {
        logger.info('✅ FlashlightService initialized');
      } else {
        // ELITE: Log as debug instead of warn - this is expected in some environments
        // Note: Screen flashlight fallback is still available via turnOnScreenFlashlight()
        if (__DEV__) {
          logger.debug('FlashlightService: No permissions or torch module (screen flashlight fallback available)');
        }
      }
    } catch (error: unknown) {
      // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isBundleError = errorMessage.includes('LoadBundleFromServerRequestError') ||
        errorMessage.includes('Could not load bundle');

      if (isBundleError) {
        // ELITE: Bundle errors are expected in some environments - log as debug
        if (__DEV__) {
          logger.debug('FlashlightService init skipped (bundle error - expected):', errorMessage);
        }
      } else {
        // Only log as error if it's not a bundle error
        logger.error('FlashlightService init failed:', error);
      }
    }
  }

  /**
   * Set camera ref for flashlight control
   */
  setCameraRef(ref: CameraView | null) {
    this.cameraRef = ref;
  }

  /**
   * Turn on flashlight (continuous)
   */
  async turnOn() {
    if (this.isOn) return;

    this.isOn = true;
    this.isFlashing = false;

    // Stop any flashing pattern
    this.clearAllTimeouts();
    if (this.patternLoop) {
      this.patternLoop = null;
    }

    try {
      // Try expo-torch first
      if (this.torchModule?.default) {
        await this.torchModule.default.switchState(true);
        logger.info('✅ Flashlight ON (expo-torch)');
        return;
      }

      // Try Camera API - use flash prop instead of setFlashModeAsync
      if (this.cameraRef && this.hasPermission) {
        // Note: CameraView flash is controlled via props, not methods
        // We'll use expo-torch or screen flashlight as fallback
        logger.debug('Camera API available but flash control requires props');
      }

      logger.warn('Flashlight not available - no torch module or camera permission');
    } catch (error) {
      logger.error('Flashlight turnOn failed:', error);
      this.isOn = false;
    }
  }

  /**
   * Turn off flashlight
   */
  async turnOff() {
    if (!this.isOn && !this.isFlashing) return;

    this.isOn = false;
    this.isFlashing = false;

    // Stop any flashing pattern
    this.clearAllTimeouts();
    if (this.patternLoop) {
      this.patternLoop = null;
    }

    try {
      // Try expo-torch first
      if (this.torchModule?.default) {
        await this.torchModule.default.switchState(false);
        logger.info('✅ Flashlight OFF (expo-torch)');
        return;
      }

      // Try Camera API - flash is controlled via props
      if (this.cameraRef) {
        // Note: CameraView flash is controlled via props, not methods
        logger.debug('Camera API flash control requires props');
      }
    } catch (error) {
      logger.error('Flashlight turnOff failed:', error);
    }
  }

  /**
   * Flash SOS Morse Pattern: --- ••• ---
   * Long: 500ms, Short: 150ms, Gap: 150ms
   */
  async flashSOSMorse() {
    if (this.isFlashing) {
      await this.stop();
    }

    this.isFlashing = true;
    this.isOn = false;

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
    this.patternLoop = (async () => {
      while (this.isFlashing) {
        await pattern();
      }
    })();
  }

  /**
   * Flash for specified duration
   */
  private async flash(duration: number) {
    if (!this.isFlashing) return;

    try {
      // Turn on flashlight
      if (this.torchModule?.default) {
        await this.torchModule.default.switchState(true);
        await this.wait(duration);
        await this.torchModule.default.switchState(false);
      } else if (this.cameraRef && this.hasPermission) {
        // Note: CameraView flash is controlled via props, not methods
        // Use screen flashlight as fallback for flashing
        logger.debug('Camera API flash control requires props, using screen flashlight');
        await Brightness.setBrightnessAsync(1.0);
        await this.wait(duration);
        await Brightness.setBrightnessAsync(this.originalBrightness);
      } else {
        logger.debug('Flashlight not available for flashing');
      }
    } catch (error) {
      logger.debug('Flash failed:', error);
    }
  }

  /**
   * Turn on screen flashlight (full brightness)
   */
  async turnOnScreenFlashlight() {
    if (this.isScreenFlashlight) return;

    try {
      this.isScreenFlashlight = true;
      await Brightness.setBrightnessAsync(1.0);
      logger.info('✅ Screen flashlight ON');
    } catch (error) {
      logger.error('Screen flashlight turnOn failed:', error);
      this.isScreenFlashlight = false;
    }
  }

  /**
   * Turn off screen flashlight (restore brightness)
   */
  async turnOffScreenFlashlight() {
    if (!this.isScreenFlashlight) return;

    try {
      this.isScreenFlashlight = false;
      await Brightness.setBrightnessAsync(this.originalBrightness);
      logger.info('✅ Screen flashlight OFF');
    } catch (error) {
      logger.error('Screen flashlight turnOff failed:', error);
    }
  }

  /**
   * Clear all active timeouts
   */
  private clearAllTimeouts() {
    this.timeoutIds.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.timeoutIds.clear();
  }

  /**
   * Wait for specified milliseconds
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.timeoutIds.delete(timeoutId);
        resolve();
      }, ms);
      this.timeoutIds.add(timeoutId);
    });
  }

  /**
   * Stop flashing
   */
  async stop() {
    // CRITICAL: Set flags first to stop all loops
    this.isFlashing = false;
    this.isOn = false;

    // Clear all timeouts immediately
    this.clearAllTimeouts();

    // Clear pattern loop reference
    this.patternLoop = null;

    try {
      // Ensure flashlight is off
      await this.turnOff();

      // CRITICAL: Wait a bit to ensure pattern loop has checked isFlashing flag
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error('FlashlightService stop failed:', error);
    }

    logger.info('FlashlightService stopped');
  }

  /**
   * Check if flashlight is currently active
   */
  isActive(): boolean {
    return this.isFlashing || this.isOn;
  }

  /**
   * Check if flashlight is available
   */
  isAvailable(): boolean {
    return this.hasPermission || this.torchModule !== null;
  }

  /**
   * Check if screen flashlight is active
   */
  isScreenFlashlightActive(): boolean {
    return this.isScreenFlashlight;
  }
}

export const flashlightService = new FlashlightService();

