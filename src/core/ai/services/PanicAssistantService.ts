/**
 * PANIC ASSISTANT SERVICE
 * Provides emergency actions during disasters
 * AI-powered with rule-based fallback
 */

import { PanicAssistantState, DisasterScenario, EmergencyAction } from '../types/ai.types';
import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';

const logger = createLogger('PanicAssistantService');

interface EmergencyContext {
  magnitude?: number;
  location?: string;
  userLocation?: { latitude: number; longitude: number };
  distance?: number;
}

class PanicAssistantService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('PanicAssistantService initialized (AI-powered)');
    this.isInitialized = true;
  }

  /**
   * Afet aninda kullaniciya kisa, net aksiyonlar onerisi sun
   * AI-powered real-time guidance, fallback ile standart aksiyonlar
   */
  async getEmergencyActions(
    scenario: DisasterScenario,
    context?: EmergencyContext
  ): Promise<EmergencyAction[]> {
    // OpenAI ile dinamik aksiyonlar
    try {
      if (openAIService.isConfigured() && context) {
        return await this.getActionsWithAI(scenario, context);
      } else {
        logger.warn('OpenAI not configured or no context, using rule-based fallback');
        return this.getActionsWithRules(scenario, context);
      }
    } catch (error) {
      logger.error('AI action generation failed, using fallback:', error);
      return this.getActionsWithRules(scenario, context);
    }
  }

  /**
   * AI ile duruma özel aksiyonlar oluştur
   */
  private async getActionsWithAI(
    scenario: DisasterScenario,
    context: EmergencyContext
  ): Promise<EmergencyAction[]> {
    const scenarioText = scenario === 'earthquake' ? 'Deprem' : 
                        scenario === 'fire' ? 'Yangın' : 
                        scenario === 'flood' ? 'Sel' : 'Afet';

    const contextInfo = context.magnitude 
      ? `\n- Deprem Büyüklüğü: ${context.magnitude}
- Konum: ${context.location || 'Bilinmiyor'}
${context.distance ? `- Mesafe: ${Math.round(context.distance)} km` : ''}`
      : '';

    const prompt = `Acil durum aksiyonları oluştur (${scenarioText}):${contextInfo}

Aşağıdaki JSON formatında döndür (sadece JSON, başka açıklama yok):
{
  "actions": [
    {
      "id": "1",
      "text": "Kısa, net aksiyon talimatı",
      "priority": 1,
      "icon": "shield-checkmark"
    }
  ]
}

5-7 aksiyon döndür:
- Öncelik sırasına göre (1 en önemli)
- Kısa, net, anlaşılır (max 50 karakter)
- Hayat kurtarıcı, AFAD/UMKE standartlarına uygun
- Icon: shield-checkmark, warning, exit, medical, call, location, people

${context.magnitude && context.magnitude >= 5.0 ? 'ÖNEMLİ: Büyük deprem, kritik aksiyonlar ekle!' : ''}`;

    const systemPrompt = `Sen bir AFAD ve UMKE acil durum uzmanısın. Afet anında insanlara hayat kurtarıcı, kısa, net talimatlar veriyorsun. Talimatlar AFAD standartlarına uygun, Türkçe, anlaşılır ve hemen uygulanabilir olmalı. Panik yaratmadan, sakin ve etkili yönlendirme yap. Sadece JSON formatında yanıt ver.`;

    const aiResponse = await openAIService.generateText(prompt, {
      systemPrompt,
      maxTokens: 600,
      temperature: 0.5, // Daha tutarlı sonuçlar için düşük temperature
    });

    // JSON parse et
    const parsed = this.parseAIResponse(aiResponse);
    
    return parsed.actions.map((action: any) => ({
      ...action,
      completed: false,
    }));
  }

  /**
   * AI yanıtını parse et ve validate et
   */
  private parseAIResponse(response: string): any {
    try {
      // JSON'u bul
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON bulunamadı');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate
      if (!parsed.actions || !Array.isArray(parsed.actions)) {
        throw new Error('Actions array eksik');
      }

      // Her aksiyonu validate et
      parsed.actions = parsed.actions.map((action: any, idx: number) => ({
        id: action.id || String(idx + 1),
        text: action.text || 'Aksiyon',
        priority: typeof action.priority === 'number' ? action.priority : idx + 1,
        icon: this.validateIcon(action.icon),
      }));

      // Priority'ye göre sırala
      parsed.actions.sort((a: any, b: any) => a.priority - b.priority);

      return parsed;
    } catch (error) {
      logger.error('AI response parse error:', error);
      throw error;
    }
  }

  /**
   * Icon validasyonu
   */
  private validateIcon(icon: string): string {
    const validIcons = [
      'shield-checkmark', 'warning', 'exit', 'medical', 
      'call', 'location', 'people', 'alert-circle',
      'home', 'water', 'flashlight'
    ];
    
    return validIcons.includes(icon) ? icon : 'shield-checkmark';
  }

  /**
   * Kural tabanlı fallback aksiyonlar
   */
  private getActionsWithRules(
    scenario: DisasterScenario,
    context?: EmergencyContext
  ): EmergencyAction[] {
    if (scenario === 'earthquake') {
      const baseActions: EmergencyAction[] = [
        {
          id: '1',
          text: 'ÇÖK - KAPAN - TUTUN',
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
          text: 'Başını ve boynunu koru',
          priority: 3,
          completed: false,
          icon: 'medical',
        },
        {
          id: '4',
          text: 'Sarsıntı bitene kadar bekle',
          priority: 4,
          completed: false,
          icon: 'alert-circle',
        },
        {
          id: '5',
          text: 'Sarsıntı bittikten sonra dışarı çık',
          priority: 5,
          completed: false,
          icon: 'exit',
        },
        {
          id: '6',
          text: 'Toplanma alanına git',
          priority: 6,
          completed: false,
          icon: 'location',
        },
      ];

      // Büyük deprem için ek aksiyonlar
      if (context?.magnitude && context.magnitude >= 5.0) {
        baseActions.push({
          id: '7',
          text: '112\'yi ara, yardım iste',
          priority: 7,
          completed: false,
          icon: 'call',
        });
      }

      return baseActions;
    }

    // Diğer senaryolar için varsayılan
    return [
      {
        id: '1',
        text: 'Sakin kal, panik yapma',
        priority: 1,
        completed: false,
        icon: 'shield-checkmark',
      },
      {
        id: '2',
        text: 'Güvenli alana git',
        priority: 2,
        completed: false,
        icon: 'exit',
      },
      {
        id: '3',
        text: '112\'yi ara',
        priority: 3,
        completed: false,
        icon: 'call',
      },
    ];
  }
}

export const panicAssistantService = new PanicAssistantService();

