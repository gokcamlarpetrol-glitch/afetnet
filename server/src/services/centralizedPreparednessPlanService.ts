/**
 * CENTRALIZED PREPAREDNESS PLAN SERVICE
 * Creates shared preparedness plans for users with similar profiles
 * Cost optimization: One AI request per unique profile instead of per user
 * 
 * COST SAVINGS: 1 AI call per profile type vs 1000+ AI calls = 99.9% cost reduction
 */

import { pool } from '../database';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[PreparednessPlan] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[PreparednessPlan] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[PreparednessPlan] ${msg}`, ...args),
};

interface PlanParams {
  familySize?: number;
  hasPets?: boolean;
  hasChildren?: boolean;
  hasElderly?: boolean;
  hasDisabilities?: boolean;
  locationName?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  residenceType?: string;
}

interface PreparednessPlan {
  id: string;
  title: string;
  personaSummary: string;
  sections: Array<{
    id: string;
    title: string;
    priority: string;
    phase: string;
    summary: string;
    estimatedDurationMinutes: number;
    resources: string[];
    items: Array<{
      id: string;
      text: string;
      completed: boolean;
      importance: string;
      instructions: string;
      dueInHours: number;
    }>;
  }>;
  completionRate: number;
  createdAt: number;
  updatedAt: number;
}

class CentralizedPreparednessPlanService {
  private readonly PLAN_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private planCache = new Map<string, { plan: PreparednessPlan; timestamp: number }>();

  /**
   * Generate a profile key for caching
   * Similar profiles share the same plan
   */
  private getProfileKey(params: PlanParams): string {
    // Normalize family size to ranges
    const familySizeRange = params.familySize 
      ? params.familySize <= 2 ? '1-2' 
        : params.familySize <= 4 ? '3-4' 
        : '5+'
      : 'unknown';
    
    // Create a normalized key
    const keyParts = [
      `size:${familySizeRange}`,
      `children:${params.hasChildren ? 'yes' : 'no'}`,
      `elderly:${params.hasElderly ? 'yes' : 'no'}`,
      `pets:${params.hasPets ? 'yes' : 'no'}`,
      `disabilities:${params.hasDisabilities ? 'yes' : 'no'}`,
      `risk:${params.riskLevel || 'medium'}`,
      `residence:${params.residenceType || 'unknown'}`,
    ];
    
    return keyParts.join('|');
  }

  /**
   * Generate or retrieve preparedness plan for a profile
   * Returns cached plan if available, otherwise generates new one
   */
  async getOrGeneratePlan(params: PlanParams): Promise<PreparednessPlan> {
    const profileKey = this.getProfileKey(params);
    const now = Date.now();

    try {
      // Check in-memory cache
      const cached = this.planCache.get(profileKey);
      if (cached && now - cached.timestamp < this.PLAN_CACHE_TTL) {
        logger.info('Returning in-memory cached plan for profile:', profileKey);
        return cached.plan;
      }

      // Check database cache
      const dbPlan = await this.getPlanFromDatabase(profileKey);
      if (dbPlan) {
        logger.info('Returning database plan for profile:', profileKey);
        this.planCache.set(profileKey, { plan: dbPlan, timestamp: now });
        return dbPlan;
      }

      // Generate new plan
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        logger.warn('OpenAI not configured, using fallback plan.');
        return this.useFallbackPlan(params);
      }

      const plan = await this.generateAIPlan(params, openaiApiKey);
      
      // Cache the plan
      this.planCache.set(profileKey, { plan, timestamp: now });
      await this.savePlanToDatabase(profileKey, params, plan);

      logger.info('Generated new AI plan for profile:', profileKey);
      return plan;
    } catch (error) {
      logger.error('Failed to get or generate plan:', error);
      return this.useFallbackPlan(params);
    }
  }

  /**
   * Generate AI plan using OpenAI (single call for all users with same profile)
   */
  private async generateAIPlan(params: PlanParams, apiKey: string): Promise<PreparednessPlan> {
    const prompt = `Afet hazırlık planı oluştur. AFAD standartlarına uygun.

Profil: ${params.familySize || '?'} kişi, ${params.hasChildren ? 'çocuk+' : ''} ${params.hasElderly ? 'yaşlı+' : ''} ${params.hasPets ? 'evcil hayvan+' : ''} ${params.hasDisabilities ? 'engelli+' : ''} ${params.locationName || ''} ${params.riskLevel || ''} ${params.residenceType || ''}

JSON formatında döndür (sadece JSON):
{
  "title": "Plan başlığı",
  "personaSummary": "Kısa özet",
  "sections": [
    {
      "id": "id1",
      "title": "Bölüm",
      "priority": "high",
      "phase": "hazirlik",
      "summary": "Özet",
      "estimatedDurationMinutes": 60,
      "resources": ["Kaynak"],
      "items": [
        {
          "id": "item1",
          "text": "Yapılacak",
          "completed": false,
          "importance": "high",
          "instructions": "Talimat",
          "dueInHours": 24
        }
      ]
    }
  ]
}

5 bölüm: Acil Durum Çantası (hazirlik,high), İletişim Planı (hazirlik,high), Tatbikat (tatbikat,medium), Acil Durum Anı (acil_durum,high), İyileşme (iyilesme,medium). Her bölümde 4-5 madde. Kısa ve net.`;

    const systemPrompt = `Sen bir AFAD afet hazırlık uzmanısın. Türkiye'deki deprem gerçeklerine göre, aile profiline özel, uygulanabilir hazırlık planları oluşturuyorsun. Planlar AFAD standartlarına uygun, net, anlaşılır ve adım adım olmalı. Sadece JSON formatında yanıt ver.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Cost-effective model
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 3000, // Increased for complete JSON
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || '';
      
      // Parse JSON response
      const parsed = this.parseAIResponse(generatedText);
      
      return {
        id: `plan_${Date.now()}_${profileKey}`,
        title: parsed.title || 'Kişisel Afet Hazırlık Planı',
        personaSummary: parsed.personaSummary || '',
        sections: parsed.sections || [],
        completionRate: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to generate AI plan:', error);
      throw error;
    }
  }

  /**
   * Parse AI response JSON
   */
  private parseAIResponse(response: string): any {
    try {
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find JSON object
      let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonMatch = [cleanedResponse.substring(firstBrace, lastBrace + 1)];
        }
      }
      
      if (!jsonMatch || jsonMatch[0].length < 10) {
        throw new Error('JSON bulunamadı');
      }

      let jsonString = jsonMatch[0];
      
      // Fix trailing commas
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix incomplete JSON
      if (!jsonString.trim().endsWith('}')) {
        const openBraces = (jsonString.match(/\{/g) || []).length;
        const closeBraces = (jsonString.match(/\}/g) || []).length;
        const openBrackets = (jsonString.match(/\[/g) || []).length;
        const closeBrackets = (jsonString.match(/\]/g) || []).length;
        
        if (openBrackets > closeBrackets) {
          jsonString += ']'.repeat(openBrackets - closeBrackets);
        }
        if (openBraces > closeBraces) {
          jsonString += '}'.repeat(openBraces - closeBraces);
        }
      }
      
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      throw error;
    }
  }

  /**
   * Get plan from database
   */
  private async getPlanFromDatabase(profileKey: string): Promise<PreparednessPlan | null> {
    try {
      const result = await pool.query(
        `SELECT plan_data FROM preparedness_plans 
         WHERE profile_key = $1 
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC 
         LIMIT 1`,
        [profileKey]
      );

      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].plan_data);
      }

      return null;
    } catch (error) {
      logger.error('Failed to get plan from database:', error);
      return null;
    }
  }

  /**
   * Save plan to database
   */
  private async savePlanToDatabase(profileKey: string, params: PlanParams, plan: PreparednessPlan): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.PLAN_CACHE_TTL);
      
      await pool.query(
        `INSERT INTO preparedness_plans 
         (profile_key, profile_params, plan_data, created_at, updated_at, expires_at)
         VALUES ($1, $2, $3, NOW(), NOW(), $4)
         ON CONFLICT (profile_key) 
         DO UPDATE SET 
           plan_data = EXCLUDED.plan_data,
           updated_at = NOW(),
           expires_at = EXCLUDED.expires_at`,
        [
          profileKey,
          JSON.stringify(params),
          JSON.stringify(plan),
          expiresAt,
        ]
      );

      logger.info('Saved plan to database for profile:', profileKey);
    } catch (error) {
      logger.error('Failed to save plan to database:', error);
      // Don't throw - plan is still usable even if DB save fails
    }
  }

  /**
   * Use fallback plan when AI is unavailable
   */
  private useFallbackPlan(params: PlanParams): PreparednessPlan {
    return {
      id: `plan_fallback_${Date.now()}`,
      title: 'Afet Hazırlık Planı',
      personaSummary: 'Temel afet hazırlık planı',
      sections: [
        {
          id: 'section_1',
          title: 'Acil Durum Çantası',
          priority: 'high',
          phase: 'hazirlik',
          summary: 'Acil durum çantası hazırlayın',
          estimatedDurationMinutes: 60,
          resources: ['Çanta', 'Su', 'Yiyecek'],
          items: [
            {
              id: 'item_1',
              text: 'Su stoklayın (kişi başı 3 litre)',
              completed: false,
              importance: 'high',
              instructions: 'Her aile üyesi için 3 günlük su stoklayın',
              dueInHours: 24,
            },
          ],
        },
      ],
      completionRate: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

export const centralizedPreparednessPlanService = new CentralizedPreparednessPlanService();

