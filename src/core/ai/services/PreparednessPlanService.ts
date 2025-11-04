/**
 * PREPAREDNESS PLAN SERVICE
 * Generates personalized disaster preparedness plans
 * Currently mock, will use OpenAI GPT-4 in Phase 4
 */

import { PreparednessPlan, PlanSection } from '../types/ai.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PreparednessPlanService');

class PreparednessPlanService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('PreparednessPlanService initialized (mock mode)');
    this.isInitialized = true;
  }

  /**
   * Kullanici profiline gore kisisellestirilmis hazirlik plani uret
   * Simdilik mock, ileride OpenAI GPT-4 ile uretilecek
   */
  async generatePlan(params: {
    familySize?: number;
    hasPets?: boolean;
    hasChildren?: boolean;
    hasElderly?: boolean;
  }): Promise<PreparednessPlan> {
    // Mock implementation
    const mockSections: PlanSection[] = [
      {
        id: 'emergency_kit',
        title: 'Acil Durum Cantasi',
        priority: 'high',
        items: [
          { id: '1', text: 'Su (kisi basi 3 gun)', completed: false },
          { id: '2', text: 'Konserve yiyecekler', completed: false },
          { id: '3', text: 'Ilk yardim cantasi', completed: false },
          { id: '4', text: 'El feneri ve piller', completed: false },
        ],
      },
      {
        id: 'communication',
        title: 'Iletisim Plani',
        priority: 'high',
        items: [
          { id: '5', text: 'Aile toplanma noktasi belirle', completed: false },
          { id: '6', text: 'Acil durum iletisim listesi olustur', completed: false },
        ],
      },
      {
        id: 'home_safety',
        title: 'Ev Guvenligi',
        priority: 'medium',
        items: [
          { id: '7', text: 'Agir esyalari sabitle', completed: false },
          { id: '8', text: 'Gaz ve elektrik vanalarini ogren', completed: false },
        ],
      },
    ];

    return {
      id: 'plan_' + Date.now(),
      title: 'Kisisel Afet Hazirlik Plani',
      sections: mockSections,
      completionRate: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

export const preparednessPlanService = new PreparednessPlanService();

