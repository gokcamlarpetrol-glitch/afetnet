/**
 * VOICE COMMAND SERVICE - Hands-Free Emergency Control
 * Voice commands for trapped victims who can't use their hands
 * Commands: "Yardım" (Help), "Konum" (Location), "Düdük" (Whistle)
 */

import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { logger } from '../utils/logger';
import { whistleService } from './WhistleService';
import { getSOSService } from './SOSService';

type VoiceCommand = 'yardim' | 'konum' | 'duduk' | 'sos';

interface CommandHandler {
  keywords: string[];
  action: () => Promise<void>;
  response: string;
}

const sosService = getSOSService();

class VoiceCommandService {
  private isListening: boolean = false;
  private recording: Audio.Recording | null = null;
  private commands: Map<VoiceCommand, CommandHandler>;

  constructor() {
    // Define voice commands
    this.commands = new Map([
      [
        'yardim',
        {
          keywords: ['yardım', 'yardim', 'help', 'imdat'],
          action: async () => {
            const Location = await import('expo-location');
            let location: { latitude: number; longitude: number; accuracy: number } | null = null;
            try {
              const { status } = await Location.default.requestForegroundPermissionsAsync();
              if (status === 'granted') {
                const pos = await Location.default.getCurrentPositionAsync();
                location = {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy || 10,
                };
              }
            } catch (error) {
              // ELITE: Log voice command errors but don't crash the app
              if (__DEV__) {
                logger.debug('Voice command processing failed (non-critical):', error);
              }
            }
            await sosService.sendSOSSignal(location, 'Acil yardım gerekiyor!');
          },
          response: 'Yardım çağrısı gönderiliyor',
        },
      ],
      [
        'konum',
        {
          keywords: ['konum', 'location', 'nerede', 'where'],
          action: async () => {
            const Location = await import('expo-location');
            const { status } = await Location.default.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.default.getCurrentPositionAsync();
              await sosService.sendSOSSignal({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || 10,
              }, 'Konum paylaşılıyor');
            }
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
            const Location = await import('expo-location');
            let location: { latitude: number; longitude: number; accuracy: number } | null = null;
            try {
              const { status } = await Location.default.requestForegroundPermissionsAsync();
              if (status === 'granted') {
                const pos = await Location.default.getCurrentPositionAsync();
                location = {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy || 10,
                };
              }
            } catch (error) {
              // ELITE: Log voice command errors but don't crash the app
              if (__DEV__) {
                logger.debug('Voice command processing failed (non-critical):', error);
              }
            }
            await sosService.sendSOSSignal(location, 'Acil yardım gerekiyor!');
          },
          response: 'Acil durum sinyali gönderiliyor',
        },
      ],
    ]);
  }

  /**
   * Initialize audio permissions
   */
  async initialize() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      logger.info('VoiceCommandService initialized');
    } catch (error) {
      logger.error('VoiceCommandService init failed:', error);
    }
  }

  /**
   * Start listening for voice commands
   */
  async startListening() {
    if (this.isListening) {
      logger.info('VoiceCommandService already listening');
      return;
    }

    try {
      this.isListening = true;
      
      // Speak instruction
      await this.speak('Sesli komut modu aktif. Yardım, Konum veya Düdük deyin.');
      
      // Start recording (simplified - real implementation would use speech recognition)
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await this.recording.startAsync();
      
      logger.info('VoiceCommandService listening');
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
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
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
    const normalizedText = text.toLowerCase().trim();
    
    for (const [commandName, handler] of this.commands) {
      for (const keyword of handler.keywords) {
        if (normalizedText.includes(keyword)) {
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

