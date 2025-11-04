/**
 * AI FEATURE TOGGLE SERVICE
 * Manages AI features on/off state
 * Uses AsyncStorage for persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AIFeatureToggle');

const FEATURE_FLAG_KEY = 'afetnet_ai_features_enabled';

class AIFeatureToggle {
  private isEnabled = false;

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FEATURE_FLAG_KEY);
      this.isEnabled = stored === 'true';
      logger.info(`AI features ${this.isEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to load AI feature flag:', error);
      this.isEnabled = false;
    }
  }

  async enable(): Promise<void> {
    this.isEnabled = true;
    await AsyncStorage.setItem(FEATURE_FLAG_KEY, 'true');
    logger.info('AI features enabled');
  }

  async disable(): Promise<void> {
    this.isEnabled = false;
    await AsyncStorage.setItem(FEATURE_FLAG_KEY, 'false');
    logger.info('AI features disabled');
  }

  isFeatureEnabled(): boolean {
    return this.isEnabled;
  }
}

export const aiFeatureToggle = new AIFeatureToggle();

