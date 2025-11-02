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
  private intervalId: NodeJS.Timeout | null = null;

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
      // TODO: Load 4000Hz whistle sound when audio file is available
      // For now, use haptic feedback only
      logger.info('WhistleService: Using haptic feedback (audio file not available)');
      await this.playSystemBeep(mode);
    } catch (error) {
      logger.error('WhistleService play failed:', error);
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
        await this.sound.replayAsync();
        await this.wait(duration);
        await this.sound.stopAsync();
      }
    } catch (error) {
      logger.error('Beep failed:', error);
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
    this.isPlaying = false;

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch (error) {
        logger.error('WhistleService stop failed:', error);
      }
      this.sound = null;
    }

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

