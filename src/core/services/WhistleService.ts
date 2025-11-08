/**
 * WHISTLE SERVICE - Emergency Whistle for Trapped Victims
 * 4000Hz high-frequency whistle sound - most audible under rubble
 * 3 modes: SOS Morse, Continuous, Vibration+Sound
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { createLogger } from '../utils/logger';

const logger = createLogger('WhistleService');

type WhistleMode = 'morse' | 'continuous' | 'vibration';

class WhistleService {
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private currentMode: WhistleMode = 'morse';
  private intervalId: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private isLoadingSound: boolean = false;
  private soundLoadAttempted: boolean = false;
  private patternLoopPromise: Promise<void> | null = null;

  /**
   * Initialize audio system
   * ELITE: Idempotent initialization with error handling
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('WhistleService already initialized');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      this.isInitialized = true;
      logger.info('✅ WhistleService initialized successfully');
    } catch (error) {
      logger.error('❌ WhistleService init failed:', error);
      // Don't throw - service can still work with haptic feedback
      this.isInitialized = false;
    }
  }

  /**
   * Play SOS Whistle
   * ELITE: Race condition prevention, proper error handling
   * @param mode - 'morse' | 'continuous' | 'vibration'
   */
  async playSOSWhistle(mode: WhistleMode = 'morse'): Promise<void> {
    // ELITE: Ensure initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    // ELITE: Race condition prevention - stop any existing playback first
    if (this.isPlaying) {
      await this.stop();
      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // ELITE: Validate mode
    if (!['morse', 'continuous', 'vibration'].includes(mode)) {
      logger.warn('Invalid whistle mode, using morse:', mode);
      mode = 'morse';
    }

    // ELITE: Reset state before starting
    this.currentMode = mode;
    this.isPlaying = true;

    try {
      // ELITE: Try to load and play whistle audio
      // loadWhistleSound() will reload if sound was unloaded
      await this.playWhistleAudio(mode);
    } catch (error) {
      logger.warn('⚠️ WhistleService audio play failed, using haptic fallback:', error);
      // ELITE: Fallback to haptic feedback (always works)
      // Only use fallback if we're still supposed to be playing
      if (this.isPlaying) {
        await this.playSystemBeep(mode);
      }
    }
  }

  /**
   * SOS Morse Pattern: --- ••• ---
   * ELITE: Long: 300ms, Short: 100ms, Gap: 100ms
   * Race condition safe - checks isPlaying frequently
   */
  private async playMorsePattern(): Promise<void> {
    const LONG = 300;
    const SHORT = 100;
    const GAP = 100;
    const WORD_GAP = 1000;

    const pattern = async (): Promise<void> => {
      // ELITE: Check isPlaying before each operation
      if (!this.isPlaying) return;

      // --- (SOS: S)
      await this.beep(LONG);
      if (!this.isPlaying) return;
      await this.wait(GAP);
      if (!this.isPlaying) return;
      await this.beep(LONG);
      if (!this.isPlaying) return;
      await this.wait(GAP);
      if (!this.isPlaying) return;
      await this.beep(LONG);
      if (!this.isPlaying) return;
      await this.wait(GAP * 3);
      if (!this.isPlaying) return;

      // ••• (SOS: O)
      await this.beep(SHORT);
      if (!this.isPlaying) return;
      await this.wait(GAP);
      if (!this.isPlaying) return;
      await this.beep(SHORT);
      if (!this.isPlaying) return;
      await this.wait(GAP);
      if (!this.isPlaying) return;
      await this.beep(SHORT);
      if (!this.isPlaying) return;
      await this.wait(GAP * 3);
      if (!this.isPlaying) return;

      // --- (SOS: S)
      await this.beep(LONG);
      if (!this.isPlaying) return;
      await this.wait(GAP);
      if (!this.isPlaying) return;
      await this.beep(LONG);
      if (!this.isPlaying) return;
      await this.wait(GAP);
      if (!this.isPlaying) return;
      await this.beep(LONG);
      if (!this.isPlaying) return;
      await this.wait(WORD_GAP);
    };

    // ELITE: Loop until stopped with proper error handling
    try {
      while (this.isPlaying) {
        await pattern();
      }
    } catch (error) {
      logger.error('❌ Morse pattern error:', error);
      // Ensure we stop playing on error
      this.isPlaying = false;
      throw error;
    }
  }

  /**
   * Continuous Pattern: 5s sound, 2s pause
   * ELITE: Race condition safe
   */
  private async playContinuousPattern(): Promise<void> {
    try {
      while (this.isPlaying) {
        await this.beep(5000);
        if (!this.isPlaying) break;
        await this.wait(2000);
        if (!this.isPlaying) break;
      }
    } catch (error) {
      logger.error('❌ Continuous pattern error:', error);
      this.isPlaying = false;
      throw error;
    }
  }

  /**
   * Vibration + Sound Pattern
   * ELITE: Race condition safe
   */
  private async playVibrationPattern(): Promise<void> {
    try {
      while (this.isPlaying) {
        // ELITE: Sound + Haptic with error handling
        try {
          await Promise.all([
            this.beep(300),
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
              // Ignore haptic errors
            }),
          ]);
        } catch (error) {
          logger.debug('Vibration pattern beep failed:', error);
        }
        
        if (!this.isPlaying) break;
        await this.wait(100);
        if (!this.isPlaying) break;

        try {
          await Promise.all([
            this.beep(300),
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
              // Ignore haptic errors
            }),
          ]);
        } catch (error) {
          logger.debug('Vibration pattern beep failed:', error);
        }
        
        if (!this.isPlaying) break;
        await this.wait(100);
        if (!this.isPlaying) break;

        try {
          await Promise.all([
            this.beep(300),
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
              // Ignore haptic errors
            }),
          ]);
        } catch (error) {
          logger.debug('Vibration pattern beep failed:', error);
        }
        
        if (!this.isPlaying) break;
        await this.wait(1000);
        if (!this.isPlaying) break;
      }
    } catch (error) {
      logger.error('❌ Vibration pattern error:', error);
      this.isPlaying = false;
      throw error;
    }
  }

  /**
   * Play a beep for specified duration
   * ELITE: Uses loaded audio file if available, otherwise haptic feedback
   * React Native compatible - uses expo-av Audio API
   */
  private async beep(duration: number): Promise<void> {
    // ELITE: Early return if not playing
    if (!this.isPlaying) {
      return;
    }

    // ELITE: Validate duration
    if (duration <= 0 || duration > 10000) {
      logger.warn('Invalid beep duration:', duration);
      duration = Math.max(100, Math.min(10000, duration));
    }

    try {
      // ELITE: Try to play audio file if loaded and valid
      if (this.sound) {
        try {
          // ELITE: Check sound status before playing
          const status = await this.sound.getStatusAsync();
          if (!status.isLoaded) {
            throw new Error('Sound not loaded');
          }

          // ELITE: Play the whistle sound with proper error handling
          await this.sound.setPositionAsync(0); // Reset to start
          await this.sound.setVolumeAsync(0.8); // 80% volume
          await this.sound.playAsync();
          
          // ELITE: Wait for the duration (check isPlaying during wait)
          const startTime = Date.now();
          while (Date.now() - startTime < duration && this.isPlaying) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // ELITE: Stop the sound if still playing
          if (this.isPlaying) {
            try {
              await this.sound.stopAsync();
            } catch (stopError) {
              logger.debug('Sound stop failed (may already be stopped):', stopError);
            }
          }
          
          // ELITE: Add haptic feedback for tactile confirmation
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (hapticError) {
            logger.debug('Haptic feedback failed:', hapticError);
          }
          
          return; // Success - audio played
        } catch (audioError) {
          logger.warn('⚠️ Audio playback failed, using haptic:', audioError);
          // ELITE: Mark sound as invalid for future attempts
          if (audioError instanceof Error && audioError.message.includes('not loaded')) {
            this.sound = null;
          }
          // Fall through to haptic fallback
        }
      }
      
      // ELITE: Fallback - Use haptic feedback (always works)
      // This provides tactile feedback even without audio
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // ELITE: Wait for the duration (check isPlaying during wait)
        const startTime = Date.now();
        while (Date.now() - startTime < duration && this.isPlaying) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // ELITE: Additional haptic at the end for better feedback
        if (duration > 200 && this.isPlaying) {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (hapticError) {
            // Ignore - not critical
          }
        }
      } catch (hapticError) {
        logger.error('❌ Haptic feedback failed:', hapticError);
        // Last resort: just wait
        const startTime = Date.now();
        while (Date.now() - startTime < duration && this.isPlaying) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      logger.error('❌ Beep failed:', error);
      // ELITE: Last resort fallback
      try {
        const startTime = Date.now();
        while (Date.now() - startTime < duration && this.isPlaying) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (fallbackError) {
        logger.error('❌ Fallback wait also failed:', fallbackError);
      }
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
   * Load whistle audio file (lazy loading with caching)
   * ELITE: Only loads once, caches result, prevents race conditions
   * Hermes engine compatible - handles require() errors gracefully
   * Can reload if sound was unloaded (after stop)
   */
  private async loadWhistleSound(): Promise<boolean> {
    // ELITE: Prevent concurrent loading attempts
    if (this.isLoadingSound) {
      // Wait for ongoing load to complete
      while (this.isLoadingSound) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return this.sound !== null;
    }

    // ELITE: If sound is already loaded, return success
    if (this.sound) {
      try {
        const status = await this.sound.getStatusAsync();
        if (status.isLoaded) {
          return true;
        }
      } catch (error) {
        // Sound exists but not loaded - need to reload
        this.sound = null;
      }
    }

    // ELITE: If sound was unloaded (after stop), allow reload
    // Reset flag if sound is null but was previously attempted
    if (this.soundLoadAttempted && !this.sound) {
      // Allow one retry after stop
      this.soundLoadAttempted = false;
    }

    // ELITE: Return cached result if already attempted and sound exists
    if (this.soundLoadAttempted && this.sound) {
      return true;
    }

    this.isLoadingSound = true;
    this.soundLoadAttempted = true;

    try {
      // ELITE: Try to load whistle audio file from multiple locations
      // Priority: WAV in sounds/ > MP3 in sounds/ > MP3 in root
      // Each require() is wrapped in try-catch to handle Hermes engine issues
      
      const loadAttempts = [
        {
          getPath: () => {
            try {
              return require('../../../assets/sounds/whistle.wav');
            } catch (e) {
              return null;
            }
          },
          name: 'assets/sounds/whistle.wav',
        },
        {
          getPath: () => {
            try {
              return require('../../../assets/sounds/whistle.mp3');
            } catch (e) {
              return null;
            }
          },
          name: 'assets/sounds/whistle.mp3',
        },
        {
          getPath: () => {
            try {
              return require('../../../assets/whistle.mp3');
            } catch (e) {
              return null;
            }
          },
          name: 'assets/whistle.mp3',
        },
      ];

      for (const attempt of loadAttempts) {
        try {
          // ELITE: Get path safely (require may fail in Hermes)
          const path = attempt.getPath();
          if (!path) {
            logger.debug(`⚠️ Cannot require ${attempt.name} (Hermes engine issue), skipping...`);
            continue;
          }

          // ELITE: Try to load the audio file
          const { sound } = await Audio.Sound.createAsync(
            path,
            { shouldPlay: false, volume: 0.8 }
          );
          
          // ELITE: Unload previous sound if exists
          if (this.sound) {
            try {
              await this.sound.unloadAsync();
            } catch (unloadError) {
              logger.debug('Previous sound unload failed:', unloadError);
            }
          }
          
          this.sound = sound;
          logger.info(`✅ Whistle audio file loaded successfully: ${attempt.name}`);
          this.isLoadingSound = false;
          return true;
        } catch (loadError: any) {
          // ELITE: Log detailed error but continue to next attempt
          const errorMsg = loadError?.message || String(loadError);
          const errorDetails = loadError?.jsEngine ? ` (${loadError.jsEngine})` : '';
          logger.debug(`⚠️ Failed to load ${attempt.name}${errorDetails}: ${errorMsg}`);
          continue;
        }
      }

      // ELITE: All load attempts failed - this is OK, we'll use haptic feedback
      logger.info('ℹ️ Whistle audio file not available, using haptic feedback (this is normal)');
      this.sound = null;
      this.isLoadingSound = false;
      return false;
    } catch (error: any) {
      // ELITE: Catch any unexpected errors
      const errorMsg = error?.message || String(error);
      const errorDetails = error?.jsEngine ? ` (${error.jsEngine})` : '';
      logger.warn(`⚠️ Whistle audio file loading encountered an issue${errorDetails}: ${errorMsg}`);
      logger.info('ℹ️ Falling back to haptic feedback (this is normal)');
      this.sound = null;
      this.isLoadingSound = false;
      return false;
    }
  }

  /**
   * Play whistle audio using Audio API
   * ELITE: Lazy loading, proper error handling, race condition prevention
   */
  private async playWhistleAudio(mode: WhistleMode): Promise<void> {
    // ELITE: Load sound file if not already loaded
    await this.loadWhistleSound();
    
    // ELITE: Start playing pattern based on mode
    // Pattern loops will check isPlaying and use sound if available
    if (mode === 'morse') {
      this.patternLoopPromise = this.playMorsePattern();
      await this.patternLoopPromise;
    } else if (mode === 'continuous') {
      this.patternLoopPromise = this.playContinuousPattern();
      await this.patternLoopPromise;
    } else {
      this.patternLoopPromise = this.playVibrationPattern();
      await this.patternLoopPromise;
    }
    
    this.patternLoopPromise = null;
  }

  /**
   * Fallback: Use system beep (iOS/Android native)
   * ELITE: Haptic feedback fallback with proper error handling
   */
  private async playSystemBeep(mode: WhistleMode): Promise<void> {
    // ELITE: Use Haptics as fallback with error handling
    try {
      if (mode === 'morse') {
        while (this.isPlaying) {
          // --- ••• ---
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(300);
          if (!this.isPlaying) break;
          
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(300);
          if (!this.isPlaying) break;
          
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(500);
          if (!this.isPlaying) break;

          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(100);
          if (!this.isPlaying) break;
          
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(100);
          if (!this.isPlaying) break;
          
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(500);
          if (!this.isPlaying) break;

          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(300);
          if (!this.isPlaying) break;
          
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(300);
          if (!this.isPlaying) break;
          
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(1000);
          if (!this.isPlaying) break;
        }
      } else {
        while (this.isPlaying) {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            logger.debug('Haptic feedback failed:', error);
          }
          if (!this.isPlaying) break;
          await this.wait(500);
          if (!this.isPlaying) break;
        }
      }
    } catch (error) {
      logger.error('❌ System beep pattern error:', error);
      this.isPlaying = false;
      throw error;
    }
  }

  /**
   * Stop whistle
   * ELITE: Properly cleans up all audio resources, prevents memory leaks
   * Resets state to allow restart
   */
  async stop(): Promise<void> {
    // ELITE: Set flag first to stop pattern loops
    this.isPlaying = false;

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

    // ELITE: Stop and unload Audio.Sound if active
    if (this.sound) {
      try {
        const status = await this.sound.getStatusAsync();
        if (status.isLoaded) {
          // Only stop if actually playing
          if (status.isPlaying) {
            await this.sound.stopAsync();
          }
          // Always unload to free memory
          await this.sound.unloadAsync();
        }
      } catch (error) {
        logger.error('❌ WhistleService stop failed:', error);
        // ELITE: Force cleanup even if stop fails
        try {
          await this.sound.unloadAsync();
        } catch (unloadError) {
          logger.debug('Force unload failed:', unloadError);
        }
      }
      this.sound = null;
    }

    // ELITE: Reset loading flags to allow restart
    // This ensures sound can be reloaded when restarting
    this.isLoadingSound = false;
    // Note: We keep soundLoadAttempted = true to avoid repeated failed attempts
    // But we reset sound to null so it can be reloaded if needed

    logger.info('✅ WhistleService stopped');
  }

  /**
   * Check if whistle is currently playing
   */
  isActive(): boolean {
    return this.isPlaying;
  }
}

export const whistleService = new WhistleService();

