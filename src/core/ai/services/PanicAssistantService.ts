/**
 * PANIC ASSISTANT SERVICE
 * Provides emergency actions during disasters
 * Currently rule-based, will use LLM in Phase 4
 */

import { PanicAssistantState, DisasterScenario, EmergencyAction } from '../types/ai.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PanicAssistantService');

class PanicAssistantService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('PanicAssistantService initialized (mock mode)');
    this.isInitialized = true;
  }

  /**
   * Afet aninda kullaniciya kisa, net aksiyonlar onerisi sun
   * Simdilik kural tabanli, ileride LLM entegre edilecek
   */
  async getEmergencyActions(scenario: DisasterScenario): Promise<EmergencyAction[]> {
    // Mock implementation - Deprem senaryosu
    if (scenario === 'earthquake') {
      return [
        {
          id: '1',
          text: 'COK - KAPAN - TUTUN',
          priority: 1,
          completed: false,
          icon: 'shield-checkmark',
        },
        {
          id: '2',
          text: 'Pencere ve aynalardan uzak dur',
          priority: 2,
          completed: false,
          icon: 'warning',
        },
        {
          id: '3',
          text: 'Sarsinti bittikten sonra disari cik',
          priority: 3,
          completed: false,
          icon: 'exit',
        },
      ];
    }

    return [];
  }
}

export const panicAssistantService = new PanicAssistantService();

