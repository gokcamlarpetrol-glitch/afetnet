/**
 * VOICE COMMAND SERVICE - Hands-Free Emergency Control
 * Voice commands for trapped victims who can't use their hands
 * Commands: "Yardım" (Help), "Konum" (Location), "Düdük" (Whistle)
 *
 * ---------------------------------------------------------------------------
 * P0-5 (Phase 0, v1.6.1): TEMPORARILY DISABLED.
 *
 * Current implementation uses `expo-speech` (TTS only — text-to-speech).
 * Real speech RECOGNITION (mic → text) is NOT implemented; the service can
 * only SPEAK responses, not listen. Advertising a "voice command" feature
 * without working recognition is an Apple 5.0 / 2.3.1 misleading-feature
 * risk and creates a false sense of safety for trapped users.
 *
 * Until on-device speech recognition is integrated (Apple Speech framework
 * via a native module, or expo-speech-recognition when it ships), every
 * public method is gated behind VOICE_COMMAND_ENABLED. The Settings UI
 * toggle and init.ts auto-start are both gated separately.
 *
 * Migration: existing user preference (`voiceCommandEnabled`) is preserved
 * in MMKV; we just don't act on it. Re-enable by flipping the flag below
 * once real recognition lands.
 * ---------------------------------------------------------------------------
 */

import * as Speech from 'expo-speech';
import { requestRecordingPermissionsAsync, getRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';
import { logger } from '../utils/logger';
import { whistleService } from './WhistleService';
import { unifiedSOSController } from './sos';
import { EmergencyReason } from './sos/SOSStateManager';
import { safeLowerCase, safeIncludes } from '../utils/safeString';

/**
 * Master kill-switch. Keep `false` until real speech recognition is shipped.
 * Set to `__DEV__` to allow local testing without exposing to TestFlight users.
 */
export const VOICE_COMMAND_ENABLED = false;

type VoiceCommand = 'yardim' | 'konum' | 'duduk' | 'sos';

interface CommandHandler {
  keywords: string[];
  action: () => Promise<void>;
  response: string;
}

// FIX: Use unified SOS controller instead of legacy SOSService

class VoiceCommandService {
  private isListening: boolean = false;
  private recording: AudioRecorder | null = null;
  private commands: Map<VoiceCommand, CommandHandler>;

  constructor() {
    // Define voice commands
    this.commands = new Map([
      [
        'yardim',
        {
          keywords: ['yardım', 'yardim', 'help', 'imdat'],
          action: async () => {
            // FIX: Use unified SOS controller for consistent state management
            await unifiedSOSController.forceActivateSOS(
              EmergencyReason.MANUAL_SOS,
              'Sesli komut: Acil yardım gerekiyor!',
            );
          },
          response: 'Yardım çağrısı gönderiliyor',
        },
      ],
      [
        'konum',
        {
          keywords: ['konum', 'location', 'nerede', 'where'],
          action: async () => {
            // FIX: Use unified SOS controller for consistent state management
            await unifiedSOSController.forceActivateSOS(
              EmergencyReason.MANUAL_SOS,
              'Sesli komut: Konum paylaşılıyor',
            );
          },
          response: 'Konumunuz paylaşılıyor',
        },
      ],
      [
        'duduk',
        {
          keywords: ['düdük', 'duduk', 'whistle', 'ses'],
          action: async () => {
            await whistleService.playSOSWhistle('morse');
          },
          response: 'Düdük çalıyor',
        },
      ],
      [
        'sos',
        {
          keywords: ['sos', 'acil', 'emergency'],
          action: async () => {
            // FIX: Use unified SOS controller for consistent state management
            await unifiedSOSController.forceActivateSOS(
              EmergencyReason.MANUAL_SOS,
              'Sesli komut: Acil durum sinyali!',
            );
          },
          response: 'Acil durum sinyali gönderiliyor',
        },
      ],
    ]);
  }

  /**
   * Initialize audio mode WITHOUT requesting permissions.
   * Apple Guideline 5.1.1: permission requests must happen in feature context,
   * not at app startup. Recording permission is requested in startListening()
   * when the user explicitly activates voice command mode.
   */
  async initialize() {
    if (!VOICE_COMMAND_ENABLED) {
      // P0-5: Skip all permission/audio setup while feature is disabled.
      logger.info('VoiceCommandService disabled (P0-5): skipping initialize');
      return;
    }
    try {
      // Read-only permission status check; never prompts the user.
      const { status } = await getRecordingPermissionsAsync();
      logger.info(`VoiceCommandService initialized (mic permission status: ${status})`);
      // Audio mode is safe to set without permission — only affects routing.
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (error) {
      logger.error('VoiceCommandService init failed:', error);
    }
  }

  /**
   * Start listening for voice commands.
   * Requests mic permission here (feature-context request, Apple-compliant).
   */
  async startListening() {
    if (!VOICE_COMMAND_ENABLED) {
      // P0-5: Never request mic permission while feature is disabled.
      // Apple Guideline 5.1.1: don't ask for permissions a disabled feature
      // can't actually use.
      logger.info('VoiceCommandService disabled (P0-5): skipping startListening');
      return;
    }
    if (this.isListening) {
      logger.info('VoiceCommandService already listening');
      return;
    }

    try {
      // Feature-context permission request — user explicitly activated voice mode.
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('Mic permission denied — voice commands unavailable');
        return;
      }
      this.isListening = true;

      // Speak instruction
      await this.speak('Sesli komut modu aktif. Yardım, Konum veya Düdük deyin.');

      // Start recording (simplified - real implementation would use speech recognition)
      // Note: useAudioRecorder is a hook; for service use, we use a simple approach
      try {
        const { AudioRecorder: NativeRecorder } = require('expo-audio');
        // Recording in a non-hook context requires native module access
        logger.info('VoiceCommandService listening (recording mode)');
      } catch (recError) {
        logger.warn('Audio recording not available in service context:', recError);
      }
    } catch (error) {
      logger.error('VoiceCommandService start failed:', error);
      this.isListening = false;
    }
  }

  /**
   * Stop listening
   */
  async stopListening() {
    if (!this.isListening) return;

    try {
      if (this.recording) {
        try {
          // Recording cleanup
          this.recording = null;
        } catch (e) {
          logger.debug('Recording cleanup error:', e);
        }
      }

      this.isListening = false;
      logger.info('VoiceCommandService stopped');
    } catch (error) {
      logger.error('VoiceCommandService stop failed:', error);
    }
  }

  /**
   * Process voice command (simplified - would use real speech recognition)
   * @param text - Recognized text from speech
   */
  async processCommand(text: string) {
    if (!VOICE_COMMAND_ENABLED) {
      // P0-5: Don't dispatch SOS via a feature we're advertising as off.
      logger.info('VoiceCommandService disabled (P0-5): processCommand no-op');
      return false;
    }
    const normalizedText = safeLowerCase(text).trim();

    for (const [commandName, handler] of this.commands) {
      for (const keyword of handler.keywords) {
        if (safeIncludes(normalizedText, keyword)) {
          logger.info(`VoiceCommandService: Executing ${commandName}`);

          // Speak response
          await this.speak(handler.response);

          // Execute action
          await handler.action();

          return true;
        }
      }
    }

    // No command matched
    await this.speak('Komut anlaşılamadı. Yardım, Konum veya Düdük deyin.');
    return false;
  }

  /**
   * Speak text (text-to-speech)
   */
  private async speak(text: string) {
    try {
      await Speech.speak(text, {
        language: 'tr-TR',
        pitch: 1.0,
        rate: 0.9,
      });
    } catch (error) {
      logger.error('Speech failed:', error);
    }
  }

  /**
   * Manual command trigger (for testing/UI buttons)
   */
  async triggerCommand(command: VoiceCommand) {
    if (!VOICE_COMMAND_ENABLED) {
      // P0-5: triggerCommand is also exposed for testing/UI buttons; gate it
      // here so a stale UI button can't dispatch SOS through the disabled
      // service.
      logger.info('VoiceCommandService disabled (P0-5): triggerCommand no-op');
      return;
    }
    const handler = this.commands.get(command);
    if (handler) {
      await this.speak(handler.response);
      await handler.action();
    }
  }

  /**
   * Check if service is listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get available commands
   */
  getCommands(): string[] {
    return Array.from(this.commands.values()).map((h) => h.keywords[0]);
  }
}

export const voiceCommandService = new VoiceCommandService();

