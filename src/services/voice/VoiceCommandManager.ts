import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface VoiceCommand {
  id: string;
  command: string;
  action: string;
  parameters?: any;
  timestamp: number;
  confidence: number;
  executed: boolean;
}

class VoiceCommandManager extends SimpleEventEmitter {
  private voiceCommands = new Map<string, VoiceCommand>();
  private isListening = false;

  constructor() {
    super();
    logger.debug('🎤 Voice Command Manager initialized');
  }

  // CRITICAL: Start Voice Recognition
  async startVoiceRecognition(): Promise<boolean> {
    try {
      if (this.isListening) return true;

      logger.debug('🎤 Starting voice recognition...');

      this.isListening = true;

      this.emit('voiceRecognitionStarted');
      emergencyLogger.logSystem('info', 'Voice recognition started');

      logger.debug('✅ Voice recognition started');
      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to start voice recognition', { error: String(error) });
      logger.error('❌ Failed to start voice recognition:', error);
      return false;
    }
  }

  // CRITICAL: Stop Voice Recognition
  async stopVoiceRecognition(): Promise<void> {
    try {
      if (!this.isListening) return;

      logger.debug('🛑 Stopping voice recognition...');

      this.isListening = false;

      this.emit('voiceRecognitionStopped');
      emergencyLogger.logSystem('info', 'Voice recognition stopped');

      logger.debug('✅ Voice recognition stopped');

    } catch (error) {
      emergencyLogger.logSystem('error', 'Error stopping voice recognition', { error: String(error) });
      logger.error('❌ Error stopping voice recognition:', error);
    }
  }

  // CRITICAL: Get Voice Status
  getVoiceStatus(): {
    isListening: boolean;
    commandsCount: number;
  } {
    return {
      isListening: this.isListening,
      commandsCount: this.voiceCommands.size
    };
  }
}

export const voiceCommandManager = new VoiceCommandManager();
export default VoiceCommandManager;