/**
 * WHISTLE SERVICE - Emergency Whistle for Trapped Victims
 * 4000Hz high-frequency whistle sound - most audible under rubble
 * 3 modes: SOS Morse, Continuous, Vibration+Sound
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { logger } from '../utils/logger';

type WhistleMode = 'morse' | 'continuous' | 'vibration';

class WhistleService {
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private currentMode: WhistleMode = 'morse';
  private timeoutIds: Set<NodeJS.Timeout> = new Set();

  /**
   * Initialize audio system
   */
  async initialize() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      // Use haptic feedback instead of audio (more reliable, no audio file needed)
      logger.info('WhistleService initialized (haptic mode)');
    } catch (error) {
      logger.error('WhistleService init failed:', error);
    }
  }

  /**
   * Play SOS Whistle
   * @param mode - 'morse' | 'continuous' | 'vibration'
   */
  async playSOSWhistle(mode: WhistleMode = 'morse') {
    if (this.isPlaying) {
      await this.stop();
    }

    this.currentMode = mode;
    this.isPlaying = true;

    try {
      // Try to load whistle audio if available
      // If not available, fallback to haptic feedback
      await this.playWhistleAudio(mode);
    } catch (error) {
      logger.error('WhistleService play failed, using haptic fallback:', error);
      await this.playSystemBeep(mode);
    }
  }

  /**
   * SOS Morse Pattern: --- ••• ---
   * Long: 300ms, Short: 100ms, Gap: 100ms
   */
  private async playMorsePattern() {
    const LONG = 300;
    const SHORT = 100;
    const GAP = 100;
    const WORD_GAP = 1000;

    const pattern = async () => {
      // --- (SOS: S)
      await this.beep(LONG);
      await this.wait(GAP);
      await this.beep(LONG);
      await this.wait(GAP);
      await this.beep(LONG);
      await this.wait(GAP * 3);

      // ••• (SOS: O)
      await this.beep(SHORT);
      await this.wait(GAP);
      await this.beep(SHORT);
      await this.wait(GAP);
      await this.beep(SHORT);
      await this.wait(GAP * 3);

      // --- (SOS: S)
      await this.beep(LONG);
      await this.wait(GAP);
      await this.beep(LONG);
      await this.wait(GAP);
      await this.beep(LONG);
      await this.wait(WORD_GAP);
    };

    // Loop until stopped
    while (this.isPlaying) {
      await pattern();
    }
  }

  /**
   * Continuous Pattern: 5s sound, 2s pause
   */
  private async playContinuousPattern() {
    while (this.isPlaying) {
      await this.beep(5000);
      await this.wait(2000);
    }
  }

  /**
   * Vibration + Sound Pattern
   */
  private async playVibrationPattern() {
    while (this.isPlaying) {
      // Sound + Haptic
      await Promise.all([
        this.beep(300),
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
      ]);
      await this.wait(100);

      await Promise.all([
        this.beep(300),
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
      ]);
      await this.wait(100);

      await Promise.all([
        this.beep(300),
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
      ]);
      await this.wait(1000);
    }
  }

  /**
   * Play a beep for specified duration
   */
  private async beep(duration: number) {
    if (!this.isPlaying) return;

    try {
      if (this.sound) {
        // Reset position and play
        await this.sound.setPositionAsync(0);
        await this.sound.playAsync();
        
        // Wait for duration
        await this.wait(duration);
        
        // Stop sound
        await this.sound.stopAsync();
        await this.sound.setPositionAsync(0);
      }
    } catch (error) {
      logger.error('Beep failed:', error);
      // Continue - don't break the pattern
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
   * Play whistle audio using Audio API
   * Uses real whistle.wav file from assets
   */
  private async playWhistleAudio(mode: WhistleMode) {
    try {
      // ELITE: Load real whistle sound from assets
      const { sound } = await Audio.Sound.createAsync(
        require('../../../assets/sounds/whistle.wav'),
        {
          shouldPlay: false,
          isLooping: false,
          volume: 1.0,
        },
      );
      
      this.sound = sound;
      
      // CRITICAL: Start pattern based on mode - don't await to allow stop() to work
      // Patterns will check isPlaying flag and stop when needed
      if (mode === 'morse') {
        this.playMorsePattern().catch((error) => {
          if (this.isPlaying) {
            logger.error('Morse pattern error:', error);
          }
        });
      } else if (mode === 'continuous') {
        this.playContinuousPattern().catch((error) => {
          if (this.isPlaying) {
            logger.error('Continuous pattern error:', error);
          }
        });
      } else if (mode === 'vibration') {
        this.playVibrationPattern().catch((error) => {
          if (this.isPlaying) {
            logger.error('Vibration pattern error:', error);
          }
        });
      }
    } catch (error) {
      logger.error('Whistle audio load failed:', error);
      // Rethrow to trigger haptic fallback
      throw error;
    }
  }

  /**
   * Fallback: Use system beep (iOS/Android native)
   */
  private async playSystemBeep(mode: WhistleMode) {
    // Use Haptics as fallback
    if (mode === 'morse') {
      while (this.isPlaying) {
        // --- ••• ---
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await this.wait(300);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await this.wait(300);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await this.wait(500);

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await this.wait(100);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await this.wait(100);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await this.wait(500);

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await this.wait(300);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await this.wait(300);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await this.wait(1000);
      }
    } else {
      while (this.isPlaying) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await this.wait(500);
      }
    }
  }

  /**
   * Stop whistle
   */
  async stop() {
    // CRITICAL: Set flag first to stop all loops
    this.isPlaying = false;

    // Clear all timeouts immediately
    this.clearAllTimeouts();

    // Stop and unload sound
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.setPositionAsync(0);
        await this.sound.unloadAsync();
      } catch (error) {
        logger.error('WhistleService stop failed:', error);
      }
      this.sound = null;
    }

    // CRITICAL: Wait a bit to ensure loops have checked isPlaying flag
    await new Promise(resolve => setTimeout(resolve, 100));

    logger.info('WhistleService stopped');
  }

  /**
   * Check if whistle is currently playing
   */
  isActive(): boolean {
    return this.isPlaying;
  }
}

export const whistleService = new WhistleService();

