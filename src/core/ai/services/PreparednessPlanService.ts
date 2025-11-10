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
  private hasWarnedAboutOpenAI = false; // ELITE: Prevent spam warnings

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
    hasDisabilities?: boolean;
    locationName?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    residenceType?: string;
  }): Promise<PreparednessPlan> {
    // ELITE: Try centralized backend API first (cost optimization)
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://afetnet-backend.onrender.com';
      logger.info(`[PreparednessPlan] Attempting centralized backend API: ${backendUrl}/api/preparedness/generate`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await fetch(`${backendUrl}/api/preparedness/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.plan) {
            logger.info('✅ [PreparednessPlan] Got centralized plan from backend');
            // Cache locally
            const cacheKey = JSON.stringify(params);
            this.cache.set(cacheKey, { data: data.plan, timestamp: Date.now() });
            return data.plan;
          }
        } else {
          logger.warn(`Backend API returned error status ${response.status}, falling back to local generation`);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (!fetchError.name?.includes('AbortError')) {
          logger.warn('Backend API request failed, falling back to local generation:', fetchError?.message);
        }
      }
    } catch (error) {
      logger.warn('Backend API attempt failed, using local generation:', error);
    }

    // Fallback: Local cache kontrolü
    const cacheKey = JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.info('Returning cached preparedness plan');
      return cached.data;
    }

    // Fallback: OpenAI ile plan oluştur (local)
    try {
      if (openAIService.isConfigured()) {
        const result = await this.generateWithAI(params);
        
        // Cache'e kaydet
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        return result;
      } else {
        // ELITE: Only warn once to prevent spam
        if (!this.hasWarnedAboutOpenAI) {
          logger.debug('OpenAI not configured, using rule-based fallback (this is OK)');
          this.hasWarnedAboutOpenAI = true;
        }
        return this.generateWithRules(params);
      }
    } catch (error: any) {
      // ELITE: Better error handling - log but don't crash
      logger.warn('AI plan generation failed, using rule-based fallback:', {
        error: error?.message || error,
        errorType: error?.name || typeof error,
      });
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
    hasDisabilities?: boolean;
    locationName?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    residenceType?: string;
  }): Promise<PreparednessPlan> {
    // ELITE: More concise prompt to reduce token usage and prevent truncation
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

    // ELITE: Increase maxTokens significantly to ensure complete JSON response
    // Preparedness plan JSON can be large (5+ sections with multiple items each)
    const aiResponse = await openAIService.generateText(prompt, {
      systemPrompt,
      maxTokens: 3000, // Increased from 2000 to ensure complete JSON for large plans
      temperature: 0.7,
    });

    // ELITE: Validate response before parsing
    if (!aiResponse || aiResponse.trim().length < 50) {
      logger.warn('AI response too short or empty, using fallback');
      throw new Error('AI response incomplete');
    }

    // ELITE: Check if response looks truncated (ends abruptly)
    const trimmedResponse = aiResponse.trim();
    const lastChar = trimmedResponse[trimmedResponse.length - 1];
    if (lastChar !== '}' && lastChar !== ']' && !trimmedResponse.includes('}')) {
      logger.warn('AI response appears truncated (does not end with }), using fallback');
      throw new Error('AI response appears truncated');
    }

    // JSON parse et
    const parsed = this.parseAIResponse(aiResponse);
    
    return {
      id: 'plan_' + Date.now(),
      title: parsed.title || 'Kişisel Afet Hazırlık Planı',
      sections: parsed.sections,
      completionRate: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      personaSummary: parsed.personaSummary,
    };
  }

  /**
   * AI yanıtını parse et ve validate et
   */
  private parseAIResponse(response: string): any {
    try {
      // ELITE: Clean response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks (```json ... ```)
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      
      // ELITE: Find JSON object - try multiple patterns
      let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      
      // If no match, try to find JSON after "{" or before "}"
      if (!jsonMatch) {
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonMatch = [cleanedResponse.substring(firstBrace, lastBrace + 1)];
        }
      }
      
      if (!jsonMatch || jsonMatch[0].length < 10) {
        logger.error('JSON bulunamadı veya çok kısa:', { responseLength: response.length, cleanedLength: cleanedResponse.length });
        throw new Error('JSON bulunamadı veya geçersiz');
      }

      // ELITE: Try to fix common JSON issues before parsing
      let jsonString = jsonMatch[0];
      
      // Remove trailing commas before closing braces/brackets
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      // ELITE: Check if JSON string is complete (ends with })
      // If truncated, try to fix it
      if (!jsonString.trim().endsWith('}')) {
        logger.warn('JSON string appears incomplete (does not end with }), attempting fix');
        
        // Try to close incomplete JSON
        let fixedJson = jsonString.trim();
        
        // Count open/close braces
        const openBraces = (fixedJson.match(/\{/g) || []).length;
        const closeBraces = (fixedJson.match(/\}/g) || []).length;
        const openBrackets = (fixedJson.match(/\[/g) || []).length;
        const closeBrackets = (fixedJson.match(/\]/g) || []).length;
        
        // Close missing brackets first
        if (openBrackets > closeBrackets) {
          fixedJson += ']'.repeat(openBrackets - closeBrackets);
        }
        
        // Close missing braces
        if (openBraces > closeBraces) {
          fixedJson += '}'.repeat(openBraces - closeBraces);
        }
        
        jsonString = fixedJson;
      }

      // Try parsing
      let parsed: any;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError: any) {
        // ELITE: If parsing fails, try to extract and fix common issues
        logger.warn('Initial JSON parse failed, attempting fixes:', parseError?.message || parseError);
        
        // Try to find and extract just the sections array if full JSON fails
        const sectionsMatch = jsonString.match(/"sections"\s*:\s*\[[\s\S]*\]/);
        if (sectionsMatch) {
          try {
            // Try to parse sections array
            const sectionsStr = sectionsMatch[0].replace(/"sections"\s*:\s*/, '');
            const sections = JSON.parse(sectionsStr);
            
            // Create a minimal valid JSON structure
            const titleMatch = jsonString.match(/"title"\s*:\s*"([^"]+)"/);
            const personaMatch = jsonString.match(/"personaSummary"\s*:\s*"([^"]+)"/);
            
            parsed = {
              title: titleMatch ? titleMatch[1] : 'Kişisel Afet Hazırlık Planı',
              personaSummary: personaMatch ? personaMatch[1] : '',
              sections: Array.isArray(sections) ? sections : [],
            };
            
            logger.info('✅ Successfully extracted sections from partial JSON');
          } catch (sectionsParseError) {
            logger.error('Failed to parse sections array:', sectionsParseError);
            throw parseError; // Re-throw original error
          }
        } else {
          // No sections found - throw original error
          logger.error('JSON parse failed and no sections found:', {
            error: parseError?.message,
            jsonLength: jsonString.length,
            jsonPreview: jsonString.substring(0, 200),
          });
          throw parseError;
        }
      }

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
        phase: ['hazirlik', 'tatbikat', 'acil_durum', 'iyilesme'].includes(section.phase)
          ? section.phase
          : 'hazirlik',
        summary: section.summary || '',
        estimatedDurationMinutes: Number.isFinite(section.estimatedDurationMinutes)
          ? Number(section.estimatedDurationMinutes)
          : undefined,
        resources: Array.isArray(section.resources)
          ? section.resources.filter((resource: unknown): resource is string => typeof resource === 'string')
          : [],
        items: Array.isArray(section.items)
          ? section.items.map((item: any, itemIdx: number) => ({
              id: item.id || `item_${idx}_${itemIdx}`,
              text: item.text || 'Yapılacak iş',
              completed: false,
              importance: ['critical', 'high', 'medium', 'low'].includes(item.importance)
                ? item.importance
                : 'medium',
              instructions: item.instructions || undefined,
              dueDate: typeof item.dueInHours === 'number'
                ? Date.now() + item.dueInHours * 60 * 60 * 1000
                : undefined,
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
    hasDisabilities?: boolean;
    locationName?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    residenceType?: string;
  }): PreparednessPlan {
    const sections: PlanSection[] = [
      {
        id: 'emergency_kit',
        title: 'Acil Durum Çantası',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Deprem sonrası en az 72 saat boyunca aileyi destekleyecek temel ihtiyaçlar hazır olmalı.',
        estimatedDurationMinutes: 90,
        resources: ['AFAD Deprem Çantası Rehberi', 'Yerel eczaneler'],
        items: [
          {
            id: 'kit_water',
            text: `Su (kişi başı 3 günlük, ${(params.familySize || 4) * 3} litre)` ,
            completed: false,
            importance: 'critical',
            instructions: 'Kapalı şişelerde su stoklayın, 6 ayda bir yenileyin.',
            dueDate: Date.now() + 24 * 60 * 60 * 1000,
          },
          {
            id: 'kit_food',
            text: 'Konserve yiyecekler ve hazır gıdalar (3 günlük)',
            completed: false,
            importance: 'high',
            instructions: 'Konserve açacağı ve düşük pişirme gerektiren gıdaları tercih edin.',
            dueDate: Date.now() + 48 * 60 * 60 * 1000,
          },
          {
            id: 'kit_first_aid',
            text: 'İlk yardım çantası ve ilaçlar',
            completed: false,
            importance: 'critical',
            instructions: 'Düzenli kullanılan ilaçları 1 haftalık stoklayın.',
          },
          {
            id: 'kit_power',
            text: 'El feneri, powerbank ve yedek piller',
            completed: false,
            importance: 'high',
            instructions: 'Powerbankleri ayda bir şarj edin.',
          },
          {
            id: 'kit_documents',
            text: 'Önemli belgelerin su geçirmez kopyaları',
            completed: false,
            importance: 'medium',
            instructions: 'Kimlik, tapu, sigorta, sağlık kayıtlarını dijital ve basılı saklayın.',
          },
        ],
      },
      {
        id: 'communication',
        title: 'İletişim Planı',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Aile bireyleri deprem sonrası nerede buluşacağını ve kimlerle iletişim kuracağını bilmelidir.',
        estimatedDurationMinutes: 60,
        resources: ['AFAD Aile Afet Planı Formu'],
        items: [
          {
            id: 'comm_meeting',
            text: 'Aile toplanma noktası belirle',
            completed: false,
            importance: 'critical',
            instructions: `${params.locationName || 'Mahallenizde'} en güvenli toplanma alanını seçin ve herkesle paylaşın.`,
            dueDate: Date.now() + 24 * 60 * 60 * 1000,
          },
          {
            id: 'comm_list',
            text: 'Acil durum iletişim listesi oluştur',
            completed: false,
            importance: 'high',
            instructions: 'Telefon, WhatsApp, SMS ve alternatif iletişim kanallarını ekleyin.',
          },
          {
            id: 'comm_out_of_city',
            text: 'Şehir dışı iletişim kişisi belirle',
            completed: false,
            importance: 'high',
            instructions: 'Aile dışından güvenilir bir kişiyi acil irtibat noktası olarak görevlendirin.',
          },
          {
            id: 'comm_drill',
            text: 'Aileyle deprem tatbikatı yap',
            completed: false,
            importance: 'medium',
            instructions: 'Ayda bir çök-kapan-tutun ve tahliye pratiği yapın.',
          },
        ],
      },
      {
        id: 'drill_program',
        title: 'Tatbikat ve Eğitim Planı',
        priority: 'medium',
        phase: 'tatbikat',
        summary: 'Düzenli tatbikatlarla refleksleri güçlendirin, görev dağılımını netleştirin.',
        estimatedDurationMinutes: 120,
        resources: ['AFAD Deprem Dede', 'Okul Tatbikat Rehberi'],
        items: [
          {
            id: 'drill_schedule',
            text: 'Aylık deprem tatbikat takvimi oluştur',
            completed: false,
            importance: 'high',
            instructions: 'Her ay aynı gün tatbikat yaparak süre ve aksiyonları ölçün.',
          },
          {
            id: 'drill_roles',
            text: 'Aile içi görev dağılımı yap',
            completed: false,
            importance: 'medium',
            instructions: 'Elektrik, gaz, çocuk/pet güvenliği için sorumlu kişileri belirleyin.',
          },
          {
            id: 'drill_school',
            text: 'Çocukların okul tatbikat tarihlerini takip et',
            completed: params.hasChildren ? false : true,
            importance: params.hasChildren ? 'high' : 'low',
            instructions: 'Okul yönetiminden tatbikat notlarını alın ve evde tekrar edin.',
          },
        ],
      },
      {
        id: 'home_safety',
        title: 'Ev Güvenliği',
        priority: 'medium',
        phase: 'hazirlik',
        summary: 'Bina içindeki riskleri azaltarak yaralanma olasılığını düşürün.',
        estimatedDurationMinutes: 150,
        resources: ['AFAD Bina Güvenlik Kontrol Listesi'],
        items: [
          {
            id: 'home_anchor',
            text: 'Ağır eşyaları duvara sabitle',
            completed: false,
            importance: 'high',
            instructions: 'Dolap, kitaplık, televizyon gibi eşyaları L demirleriyle sabitleyin.',
          },
          {
            id: 'home_valves',
            text: 'Gaz ve elektrik vanalarını öğren',
            completed: false,
            importance: 'critical',
            instructions: 'Kapama anahtarlarını etiketleyin ve aile bireylerine gösterin.',
          },
          {
            id: 'home_extinguisher',
            text: 'Yangın söndürücü ve duman alarmı temin et',
            completed: false,
            importance: 'high',
            instructions: 'Söndürücüyü yılda bir kontrol edin, duman alarmlarının pillerini değiştirin.',
          },
          {
            id: 'home_safezone',
            text: 'Yaşam üçgeni bölgelerini belirle',
            completed: false,
            importance: 'medium',
            instructions: 'Dayanıklı mobilya yanları ve koltuk altları gibi güvenli alanları işaretleyin.',
          },
        ],
      },
      {
        id: 'response_phase',
        title: 'Deprem Ani Koordinasyonu',
        priority: 'high',
        phase: 'acil_durum',
        summary: 'Sarsıntı anı ve hemen sonrasında hangi adımların uygulanacağını netleştirin.',
        estimatedDurationMinutes: 45,
        resources: ['AfetNet Afet Anı Rehberi'],
        items: [
          {
            id: 'response_duck',
            text: 'Çök-Kapan-Tutun pozisyonunu uygulama',
            completed: false,
            importance: 'critical',
            instructions: 'Her odada güvenli alan belirleyin ve pratik yapın.',
          },
          {
            id: 'response_evac',
            text: 'Tahliye planını gözden geçir',
            completed: false,
            importance: 'high',
            instructions: 'Merdiven, acil çıkış ve alternatif rota kontrolleri yapın.',
          },
          {
            id: 'response_bag',
            text: 'Acil çantaların konumunu sabitle',
            completed: false,
            importance: 'high',
            instructions: 'Kapıya yakın ulaşılabilir noktada saklayın.',
          },
        ],
      },
      {
        id: 'recovery_phase',
        title: 'İyileşme ve Kontroller',
        priority: 'medium',
        phase: 'iyilesme',
        summary: 'Deprem sonrası sağlık, psikolojik destek ve sigorta işlemlerini planlayın.',
        estimatedDurationMinutes: 120,
        resources: ['AFAD Psikososyal Destek Hattı', 'Sigorta şirketi iletişim bilgileri'],
        items: [
          {
            id: 'recovery_firstaid',
            text: 'İlk yardım ve psikolojik destek hatlarını kaydet',
            completed: false,
            importance: 'high',
            instructions: 'AFAD 112, 184 ve yerel belediye hatlarını listeleyin.',
          },
          {
            id: 'recovery_insurance',
            text: 'DASK ve konut sigortası poliçelerini kontrol et',
            completed: false,
            importance: 'medium',
            instructions: 'Poliçe numalarını ve iletişim kişilerini hazır tutun.',
          },
          {
            id: 'recovery_neighbors',
            text: 'Komşularla karşılıklı destek ağı oluştur',
            completed: false,
            importance: 'medium',
            instructions: 'Yaşlı veya yardıma ihtiyacı olan komşularla iletişim kurun.',
          },
        ],
      },
    ];

    // Özel durumlar için ek bölümler
    if (params.hasChildren) {
      sections.push({
        id: 'children_care',
        title: 'Çocuk Bakımı',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Çocukların deprem anında sakin kalması ve ihtiyaçlarının karşılanması için hazırlık yapın.',
        items: [
          { id: 'child_supplies', text: 'Çocuk bezi ve mama stoğu (1 haftalık)', completed: false, importance: 'critical', instructions: 'Rutin tüketimi takip ederek stokları güncelleyin.' },
          { id: 'child_drill', text: 'Çocuklara deprem tatbikatı yaptır', completed: false, importance: 'high', instructions: 'Eğlenceli senaryolar ile korkuyu azaltın.' },
          { id: 'child_med', text: 'Çocukların ilaçları ve sağlık kayıtları', completed: false, importance: 'high', instructions: 'Alerji ve kronik durum bilgilerini çantada bulundurun.' },
          { id: 'child_comfort', text: 'Oyuncak ve rahatlatıcı eşyalar', completed: false, importance: 'medium', instructions: 'Stres anında sakinleştirici objeler hazırlayın.' },
        ],
      });
    }

    if (params.hasElderly) {
      sections.push({
        id: 'elderly_care',
        title: 'Yaşlı Bakımı',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Yaşlı bireylerin ilaç, hareket ve tahliye ihtiyaçlarına göre plan yapın.',
        items: [
          { id: 'elderly_med', text: 'Düzenli kullanılan ilaçlar (1 aylık)', completed: false, importance: 'critical' },
          { id: 'elderly_device', text: 'Yedek gözlük/işitme cihazı', completed: false, importance: 'high' },
          { id: 'elderly_docs', text: 'Sağlık raporları ve reçeteler', completed: false, importance: 'high' },
          { id: 'elderly_mobility', text: 'Yürüteç/tekerlekli sandalye kontrolü', completed: false, importance: 'medium' },
        ],
      });
    }

    if (params.hasPets) {
      sections.push({
        id: 'pet_care',
        title: 'Evcil Hayvan Bakımı',
        priority: 'medium',
        phase: 'hazirlik',
        summary: 'Evcil dostların güvenliği için yiyecek, su ve tahliye planlarını düzenleyin.',
        items: [
          { id: 'pet_food', text: 'Evcil hayvan maması (1 haftalık)', completed: false, importance: 'high' },
          { id: 'pet_carrier', text: 'Su kabı ve taşıma çantası', completed: false, importance: 'medium' },
          { id: 'pet_records', text: 'Veteriner kayıtları ve aşı kartı', completed: false, importance: 'medium' },
          { id: 'pet_tag', text: 'Tasma ve kimlik etiketi', completed: false, importance: 'medium' },
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
      personaSummary: `${params.locationName || 'Bulunduğunuz bölge'} için ${params.riskLevel || 'orta'} risk profiline sahip aile hazır olma planı.`,
    };
  }
}

export const preparednessPlanService = new PreparednessPlanService();

