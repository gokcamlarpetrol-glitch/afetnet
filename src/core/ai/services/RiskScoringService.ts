/**
 * RISK SCORING SERVICE
 * Calculates risk scores based on user profile and location
 * AI-powered with rule-based fallback
 */

import { RiskScore, RiskLevel, RiskFactor } from '../types/ai.types';
import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';

const logger = createLogger('RiskScoringService');

class RiskScoringService {
  private isInitialized = false;
  private cache = new Map<string, { data: RiskScore; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('RiskScoringService initialized (AI-powered)');
    this.isInitialized = true;
  }

  /**
   * Kullanici profili ve konum bilgisine gore risk skoru hesapla
   * AI-powered analiz, fallback ile kural tabanli hesaplama
   */
  async calculateRiskScore(params: {
    location?: { latitude: number; longitude: number };
    buildingType?: string;
    floorNumber?: number;
    familySize?: number;
  }): Promise<RiskScore> {
    // Cache kontrolü
    const cacheKey = JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.info('Returning cached risk score');
      return cached.data;
    }

    // OpenAI ile risk analizi
    try {
      if (openAIService.isConfigured()) {
        const result = await this.calculateWithAI(params);
        
        // Cache'e kaydet
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        return result;
      } else {
        logger.warn('OpenAI not configured, using rule-based fallback');
        return this.calculateWithRules(params);
      }
    } catch (error) {
      logger.error('AI risk calculation failed, using fallback:', error);
      return this.calculateWithRules(params);
    }
  }

  /**
   * AI ile risk analizi
   */
  private async calculateWithAI(params: {
    location?: { latitude: number; longitude: number };
    buildingType?: string;
    floorNumber?: number;
    familySize?: number;
  }): Promise<RiskScore> {
    const locationStr = params.location 
      ? `Enlem: ${params.location.latitude.toFixed(4)}, Boylam: ${params.location.longitude.toFixed(4)}`
      : 'Konum bilgisi yok';
    
    const prompt = `Deprem risk analizi yap. Türkiye için geçerli, AFAD standartlarına uygun analiz:

Bilgiler:
- Konum: ${locationStr}
- Bina Tipi: ${params.buildingType || 'Belirtilmemiş'}
- Kat Numarası: ${params.floorNumber || 'Belirtilmemiş'}
- Aile Büyüklüğü: ${params.familySize || 'Belirtilmemiş'} kişi

Aşağıdaki JSON formatında döndür (sadece JSON, başka açıklama yok):
{
  "score": <0-100 arası sayı>,
  "level": "<low|medium|high|critical>",
  "factors": [
    {
      "id": "seismic_zone",
      "name": "Deprem Bölgesi",
      "weight": <0-1 arası>,
      "value": <0-100 arası>,
      "description": "Kısa açıklama"
    }
  ],
  "recommendations": ["Öneri 1", "Öneri 2", "Öneri 3"]
}

En az 3 faktör ekle: deprem bölgesi, bina durumu, hazırlık seviyesi. Öneriler AFAD standartlarına uygun, Türkçe, net ve uygulanabilir olsun.`;

    const systemPrompt = `Sen bir deprem risk analizi uzmanısın. AFAD ve Kandilli Rasathanesi standartlarına göre analiz yapıyorsun. Türkiye'nin deprem bölgelerini, bina standartlarını ve afet hazırlık gerekliliklerini biliyorsun. Yanıtların bilimsel, anlaşılır ve uygulanabilir olmalı. Sadece JSON formatında yanıt ver.`;

    const aiResponse = await openAIService.generateText(prompt, {
      systemPrompt,
      maxTokens: 800,
      temperature: 0.7,
    });

    // JSON parse et
    const parsed = this.parseAIResponse(aiResponse);
    
    return {
      level: parsed.level as RiskLevel,
      score: parsed.score,
      factors: parsed.factors,
      recommendations: parsed.recommendations,
      lastUpdated: Date.now(),
    };
  }

  /**
   * AI yanıtını parse et ve validate et
   */
  private parseAIResponse(response: string): any {
    try {
      // JSON'u bul (bazen markdown ile sarmalanmış olabilir)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON bulunamadı');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate
      if (!parsed.score || !parsed.level || !parsed.factors || !parsed.recommendations) {
        throw new Error('Eksik alanlar');
      }

      // Score normalize et
      parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

      // Level validate et
      if (!['low', 'medium', 'high', 'critical'].includes(parsed.level)) {
        parsed.level = parsed.score >= 75 ? 'high' : parsed.score >= 50 ? 'medium' : 'low';
      }

      return parsed;
    } catch (error) {
      logger.error('AI response parse error:', error);
      throw error;
    }
  }

  /**
   * Kural tabanlı fallback hesaplama
   */
  private calculateWithRules(params: {
    location?: { latitude: number; longitude: number };
    buildingType?: string;
    floorNumber?: number;
    familySize?: number;
  }): RiskScore {
    const factors: RiskFactor[] = [
      {
        id: 'seismic_zone',
        name: 'Deprem Bölgesi',
        weight: 0.4,
        value: 75,
        description: 'Yüksek riskli deprem bölgesi',
      },
      {
        id: 'building_age',
        name: 'Bina Durumu',
        weight: 0.3,
        value: params.buildingType ? 50 : 60,
        description: params.buildingType 
          ? 'Bina tipi belirtilmiş, orta risk'
          : 'Bina bilgisi yok, varsayılan risk',
      },
      {
        id: 'preparedness',
        name: 'Hazırlık Seviyesi',
        weight: 0.3,
        value: 40,
        description: 'Düşük hazırlık seviyesi',
      },
    ];

    const totalScore = factors.reduce(
      (sum, factor) => sum + factor.weight * factor.value,
      0
    );

    const level: RiskLevel = totalScore >= 75 ? 'high' : totalScore >= 50 ? 'medium' : 'low';

    return {
      level,
      score: Math.round(totalScore),
      factors,
      recommendations: [
        'Deprem çantası hazırlayın (su, yiyecek, ilk yardım)',
        'Aile toplanma noktası belirleyin',
        'Bina güçlendirmesi için uzman görüşü alın',
        'Acil durum numaralarını kaydedin (112)',
        'Deprem tatbikatı yapın',
      ],
      lastUpdated: Date.now(),
    };
  }
}

export const riskScoringService = new RiskScoringService();

