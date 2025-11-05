/**
 * PREPAREDNESS PLAN SERVICE
 * Generates personalized disaster preparedness plans
 * AI-powered with rule-based fallback
 */

import { PreparednessPlan, PlanSection } from '../types/ai.types';
import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';

const logger = createLogger('PreparednessPlanService');

class PreparednessPlanService {
  private isInitialized = false;
  private cache = new Map<string, { data: PreparednessPlan; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('PreparednessPlanService initialized (AI-powered)');
    this.isInitialized = true;
  }

  /**
   * Kullanici profiline gore kisisellestirilmis hazirlik plani uret
   * AI-powered plan generation, fallback ile standart plan
   */
  async generatePlan(params: {
    familySize?: number;
    hasPets?: boolean;
    hasChildren?: boolean;
    hasElderly?: boolean;
  }): Promise<PreparednessPlan> {
    // Cache kontrolü
    const cacheKey = JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.info('Returning cached preparedness plan');
      return cached.data;
    }

    // OpenAI ile plan oluştur
    try {
      if (openAIService.isConfigured()) {
        const result = await this.generateWithAI(params);
        
        // Cache'e kaydet
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        return result;
      } else {
        logger.warn('OpenAI not configured, using rule-based fallback');
        return this.generateWithRules(params);
      }
    } catch (error) {
      logger.error('AI plan generation failed, using fallback:', error);
      return this.generateWithRules(params);
    }
  }

  /**
   * AI ile kişiselleştirilmiş plan oluştur
   */
  private async generateWithAI(params: {
    familySize?: number;
    hasPets?: boolean;
    hasChildren?: boolean;
    hasElderly?: boolean;
  }): Promise<PreparednessPlan> {
    const prompt = `Afet hazırlık planı oluştur. AFAD standartlarına uygun, Türkiye için geçerli:

Aile Profili:
- Aile Büyüklüğü: ${params.familySize || 'Belirtilmemiş'} kişi
- Çocuk var mı: ${params.hasChildren ? 'Evet' : 'Hayır'}
- Yaşlı var mı: ${params.hasElderly ? 'Evet' : 'Hayır'}
- Evcil hayvan var mı: ${params.hasPets ? 'Evet' : 'Hayır'}

Aşağıdaki JSON formatında döndür (sadece JSON, başka açıklama yok):
{
  "title": "Plan başlığı",
  "sections": [
    {
      "id": "unique_id",
      "title": "Bölüm başlığı",
      "priority": "high|medium|low",
      "items": [
        {
          "id": "item_id",
          "text": "Yapılacak iş",
          "completed": false
        }
      ]
    }
  ]
}

En az 4 bölüm ekle:
1. Acil Durum Çantası (high priority)
2. İletişim Planı (high priority)
3. Ev Güvenliği (medium priority)
4. Aile özelliklerine göre özel bölüm (örn: çocuk/yaşlı bakımı)

Her bölümde 4-6 madde olsun. Maddeler net, uygulanabilir, Türkçe olsun.`;

    const systemPrompt = `Sen bir AFAD afet hazırlık uzmanısın. Türkiye'deki deprem gerçeklerine göre, aile profiline özel, uygulanabilir hazırlık planları oluşturuyorsun. Planlar AFAD standartlarına uygun, net, anlaşılır ve adım adım olmalı. Sadece JSON formatında yanıt ver.`;

    const aiResponse = await openAIService.generateText(prompt, {
      systemPrompt,
      maxTokens: 1000,
      temperature: 0.7,
    });

    // JSON parse et
    const parsed = this.parseAIResponse(aiResponse);
    
    return {
      id: 'plan_' + Date.now(),
      title: parsed.title || 'Kişisel Afet Hazırlık Planı',
      sections: parsed.sections,
      completionRate: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
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
      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        throw new Error('Sections array eksik');
      }

      // Her section'ı validate et
      parsed.sections = parsed.sections.map((section: any, idx: number) => ({
        id: section.id || `section_${idx}`,
        title: section.title || 'Başlıksız Bölüm',
        priority: ['high', 'medium', 'low'].includes(section.priority) 
          ? section.priority 
          : 'medium',
        items: Array.isArray(section.items)
          ? section.items.map((item: any, itemIdx: number) => ({
              id: item.id || `item_${idx}_${itemIdx}`,
              text: item.text || 'Yapılacak iş',
              completed: false,
            }))
          : [],
      }));

      return parsed;
    } catch (error) {
      logger.error('AI response parse error:', error);
      throw error;
    }
  }

  /**
   * Kural tabanlı fallback plan
   */
  private generateWithRules(params: {
    familySize?: number;
    hasPets?: boolean;
    hasChildren?: boolean;
    hasElderly?: boolean;
  }): PreparednessPlan {
    const sections: PlanSection[] = [
      {
        id: 'emergency_kit',
        title: 'Acil Durum Çantası',
        priority: 'high',
        items: [
          { id: '1', text: `Su (kişi başı 3 günlük, ${(params.familySize || 4) * 3} litre)`, completed: false },
          { id: '2', text: 'Konserve yiyecekler (3 günlük)', completed: false },
          { id: '3', text: 'İlk yardım çantası', completed: false },
          { id: '4', text: 'El feneri ve yedek piller', completed: false },
          { id: '5', text: 'Radyo (pilli)', completed: false },
          { id: '6', text: 'Kişisel hijyen malzemeleri', completed: false },
        ],
      },
      {
        id: 'communication',
        title: 'İletişim Planı',
        priority: 'high',
        items: [
          { id: '7', text: 'Aile toplanma noktası belirle', completed: false },
          { id: '8', text: 'Acil durum iletişim listesi oluştur', completed: false },
          { id: '9', text: 'Şehir dışı iletişim kişisi belirle', completed: false },
          { id: '10', text: 'Önemli belgelerin kopyalarını hazırla', completed: false },
        ],
      },
      {
        id: 'home_safety',
        title: 'Ev Güvenliği',
        priority: 'medium',
        items: [
          { id: '11', text: 'Ağır eşyaları sabitle', completed: false },
          { id: '12', text: 'Gaz ve elektrik vanalarını öğren', completed: false },
          { id: '13', text: 'Yangın söndürücü edinin', completed: false },
          { id: '14', text: 'Cam kırılmalarına karşı önlem al', completed: false },
        ],
      },
    ];

    // Özel durumlar için ek bölümler
    if (params.hasChildren) {
      sections.push({
        id: 'children_care',
        title: 'Çocuk Bakımı',
        priority: 'high',
        items: [
          { id: '15', text: 'Çocuk bezi ve mama stoğu (1 haftalık)', completed: false },
          { id: '16', text: 'Çocuklara deprem tatbikatı yaptır', completed: false },
          { id: '17', text: 'Çocukların ilaçları ve sağlık kayıtları', completed: false },
          { id: '18', text: 'Oyuncak ve rahatlatıcı eşyalar', completed: false },
        ],
      });
    }

    if (params.hasElderly) {
      sections.push({
        id: 'elderly_care',
        title: 'Yaşlı Bakımı',
        priority: 'high',
        items: [
          { id: '19', text: 'Düzenli kullanılan ilaçlar (1 aylık)', completed: false },
          { id: '20', text: 'Yedek gözlük/işitme cihazı', completed: false },
          { id: '21', text: 'Sağlık raporları ve reçeteler', completed: false },
          { id: '22', text: 'Yürüteç/tekerlekli sandalye kontrolü', completed: false },
        ],
      });
    }

    if (params.hasPets) {
      sections.push({
        id: 'pet_care',
        title: 'Evcil Hayvan Bakımı',
        priority: 'medium',
        items: [
          { id: '23', text: 'Evcil hayvan maması (1 haftalık)', completed: false },
          { id: '24', text: 'Su kabı ve taşıma çantası', completed: false },
          { id: '25', text: 'Veteriner kayıtları ve aşı kartı', completed: false },
          { id: '26', text: 'Tasma ve kimlik etiketi', completed: false },
        ],
      });
    }

    return {
      id: 'plan_' + Date.now(),
      title: 'Kişisel Afet Hazırlık Planı',
      sections,
      completionRate: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

export const preparednessPlanService = new PreparednessPlanService();

