/**
 * PREPAREDNESS PLAN SERVICE
 * Generates personalized disaster preparedness plans
 * AI-powered with rule-based fallback
 */

import {
  PreparednessPlan,
  PlanSection,
  PlanItem,
  PlanSubTask,
  PlanResource,
  PlanTimeline,
  TimelinePhase,
  TimelineMilestone,
  PlanMilestone,
  EmergencyContact,
  PlanCustomization,
} from '../types/ai.types';
import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';
import { getFirestoreInstanceAsync } from '../../services/firebase/FirebaseInstanceManager';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getErrorMessage } from '../../utils/errorUtils';

const logger = createLogger('PreparednessPlanService');

export class PreparednessPlanService {
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
    logger.info('[PreparednessPlan] generatePlan called with params:', params);

    const cacheKey = JSON.stringify(params);

    // ELITE: Check Firestore first (Persistent Cloud Storage)
    try {
      const firestorePlan = await this.loadPlan(params);
      if (firestorePlan) {
        logger.info('✅ Loaded plan from Firestore');
        this.cache.set(cacheKey, { data: firestorePlan, timestamp: Date.now() });
        return firestorePlan;
      }
    } catch (e) {
      logger.warn('Failed to load from Firestore, checking local cache...', e);
    }

    // Fallback: Local cache kontrolü (öncelik ver)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.info('✅ Returning cached preparedness plan (Local Memory)');
      // Validate cached plan
      if (cached.data && cached.data.sections && cached.data.sections.length > 0) {
        return cached.data;
      } else {
        logger.warn('Cached plan is invalid, regenerating...');
        this.cache.delete(cacheKey);
      }
    }

    // ELITE: Attempt AI Generation (Backend API)
    // We try to use the AI power first. If it fails (timeout, empty, invalid), we fallback to rules.
    try {
      // Only skip if explicitly disabled via flag or critical error mode
      // Note: OpenAI might take 5-10s. For better UX, we could race or show loading.
      // But since this is a background service call usually, we wait.

      // ELITE: Race AI against a timeout (e.g., 15s)
      const aiPromise = this.generateWithAI(params);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));

      const aiPlan = await Promise.race([aiPromise, timeoutPromise]);

      if (aiPlan && this.validatePlan(aiPlan)) {
        logger.info('✅ Generated plan via OpenAI (Backend API)');

        // Cache result
        this.cache.set(cacheKey, { data: aiPlan, timestamp: Date.now() });
        // Save to Firestore asynchronously
        this.savePlan(aiPlan, params).catch(err => logger.warn('Failed to save AI plan to Firestore', err));
        return aiPlan;
      } else {
        logger.warn('AI Plan generation returned null or timeout - Falling back to Rules');
      }
    } catch (e) {
      logger.warn('AI Plan generation failed - Falling back to Rules', e);
    }

    // ELITE: Fallback to Rule-based plan (most reliable, always works)
    logger.info('[PreparednessPlan] Using rule-based plan (Fallback)');

    let rulePlan: PreparednessPlan;
    try {
      rulePlan = this.generateWithRules(params);
    } catch (ruleError: unknown) {
      const errorMessage = getErrorMessage(ruleError);
      const errorInfo = ruleError instanceof Error ? {
        error: errorMessage,
        errorType: ruleError.name,
        stack: ruleError.stack,
      } : { error: String(ruleError) };
      logger.error('❌ Rule-based plan generation threw error:', errorInfo);
      throw new Error('Failed to generate preparedness plan: ' + errorMessage);
    }

    // ELITE: Comprehensive validation
    if (!rulePlan) {
      logger.error('❌ Rule-based plan generation returned null/undefined!');
      throw new Error('Failed to generate preparedness plan: Plan is null');
    }

    if (!rulePlan.sections || !Array.isArray(rulePlan.sections)) {
      logger.error('❌ Rule-based plan has invalid sections:', {
        sections: rulePlan.sections,
        sectionsType: typeof rulePlan.sections,
        planKeys: Object.keys(rulePlan),
      });
      throw new Error('Failed to generate preparedness plan: Invalid sections array');
    }

    if (rulePlan.sections.length === 0) {
      logger.error('❌ Rule-based plan has no sections!', {
        planId: rulePlan.id,
        planTitle: rulePlan.title,
        planKeys: Object.keys(rulePlan),
      });
      throw new Error('Failed to generate preparedness plan: No sections');
    }

    // Validate each section has items
    const sectionsWithItems = rulePlan.sections.filter(s => s.items && Array.isArray(s.items) && s.items.length > 0);
    if (sectionsWithItems.length === 0) {
      logger.error('❌ Rule-based plan has no items in any section!', {
        sections: rulePlan.sections.map(s => ({
          id: s.id,
          title: s.title,
          items: s.items?.length || 0,
        })),
      });
      throw new Error('Failed to generate preparedness plan: No items in sections');
    }

    // Calculate total items if missing
    if (!rulePlan.totalItems || rulePlan.totalItems === 0) {
      const calculatedTotal = rulePlan.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
      rulePlan.totalItems = calculatedTotal;
      logger.warn('Plan totalItems was missing, calculated:', calculatedTotal);
    }

    logger.info(`✅ [PreparednessPlan] Generated rule-based plan with ${rulePlan.sections.length} sections and ${rulePlan.totalItems || 0} items`);

    // Cache'e kaydet
    this.cache.set(cacheKey, { data: rulePlan, timestamp: Date.now() });

    // Save to Firestore asynchronously
    this.savePlan(rulePlan, params).catch(err => logger.warn('Failed to save Rule plan to Firestore', err));

    return rulePlan;
  }

  /**
   * Save plan to Firestore
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async savePlan(plan: PreparednessPlan, params: any): Promise<void> {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) {
        logger.warn('Firestore is not available, cannot save plan');
        return;
      }

      // ELITE: Deep sanitize function - remove all undefined values recursively
      // Firestore does not support undefined values
      const deepSanitize = (obj: unknown): unknown => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) {
          return obj.map(item => deepSanitize(item));
        }
        if (typeof obj === 'object') {
          const sanitized: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            if (value !== undefined) {
              sanitized[key] = deepSanitize(value);
            }
          }
          return sanitized;
        }
        return obj;
      };

      // Sanitize both plan and params
      const sanitizedPlan = deepSanitize(plan) as PreparednessPlan;
      const sanitizedParams = deepSanitize(params);

      await setDoc(doc(db, 'preparedness_plans', plan.id), {
        ...sanitizedPlan,
        params: sanitizedParams,
        updatedAt: Date.now(),
      }, { merge: true });

      logger.info(`✅ Plan saved to Firestore: ${plan.id}`);
    } catch (error) {
      // PRODUCTION: Non-critical error - local plan works, Firestore sync is optional
      // Permission errors are expected until Firebase rules are configured for production
      // User experience is not affected - plan is cached locally
      logger.debug('Firestore save skipped (expected in dev):', error);
      // Don't throw - let the app continue with local plan
    }
  }

  /**
   * Load plan from Firestore
   * We need a strategy to find the *correct* plan.
   * For now, we'll try to find a plan that matches the parameters OR the last created one.
   * Without Auth, querying is hard.
   * ELITE SOLUTION: We will rely on the `preparednessStore` to keep track of the ID of the current plan.
   * But `generatePlan` is called with params. 
   * Let's defer strict loading logic to `generatePlan` which checks cache. 
   * If we really want persistent state across RELOADS, the Store should persist the plan ID.
   *
   * For this "API" fix, we simply provide the capability.
   * The Store will call generate, get a plan, and persist it locally (zustand persist).
   * But if the User clears local data, they might lose it unless they are logged in.
   * 
   * Let's implement a 'loadPlanById' for the Store to use.
   */
  async loadPlanById(planId: string): Promise<PreparednessPlan | null> {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return null;

      const docRef = doc(db, 'preparedness_plans', planId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as PreparednessPlan;
      }
      return null;
    } catch (error) {
      logger.warn('Error loading plan from Firestore:', error);
      return null;
    }
  }

  /**
   * Helper to attempt loading a plan if we had a way to identify it from params (unlikely without auth).
   * So we return null here, expecting the Client (Store) to manage the ID.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadPlan(params: any): Promise<PreparednessPlan | null> {
    // Without a user ID, we can't deterministically find the "user's" plan from just params.
    // So we skip this unless we had a device ID or user ID.
    // For now, return null to rely on generation/local cache.
    // IMPROVEMENT: If we had a User Context, we would query `users/{uid}/plan`.
    return null;
  }

  /**
   * Validate a plan structure
   */
  private validatePlan(plan: PreparednessPlan): boolean {
    if (!plan || !plan.sections || !Array.isArray(plan.sections) || plan.sections.length === 0) return false;
    // Check if sections have items
    const hasItems = plan.sections.some(s => s.items && s.items.length > 0);
    return hasItems;
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
    // ELITE: Cost & Speed optimization - reduced maxTokens from 2000 to 1200
    // Rule-based plan is already comprehensive, AI is just enrichment
    // Smaller maxTokens = faster responses, less timeout risk
    const aiResponse = await openAIService.generateText(prompt, {
      systemPrompt,
      maxTokens: 1200, // PRODUCTION: Optimized for speed - prevents timeout
      temperature: 0.7,
      serviceName: 'PreparednessPlanService', // ELITE: For cost tracking
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

    // Section'ları enrich et (completion rate, sub-tasks, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedSections = parsed.sections.map((section: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completedItems = section.items?.filter((item: any) => item.completed).length || 0;
      const totalItems = section.items?.length || 0;
      const sectionCompletionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      return {
        ...section,
        completionRate: sectionCompletionRate,
        category: this.getSectionCategory(section.id),
        icon: this.getSectionIcon(section.id),
        color: this.getSectionColor(section.id),
        estimatedCost: this.getSectionCost(section.id),
        difficulty: this.getSectionDifficulty(section.id),
        frequency: section.phase === 'tatbikat' ? 'monthly' : 'once' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (section.items || []).map((item: any) => this.enrichPlanItem(item, params)),
      };
    });

    // Toplam istatistikler
    const allItems = enrichedSections.flatMap((s) => s.items);
    const totalItems = allItems.length;
    const completedItems = allItems.filter((item) => item.completed).length;
    const criticalItemsRemaining = allItems.filter(
      (item) => !item.completed && item.importance === 'critical',
    ).length;
    const estimatedTotalDuration = enrichedSections.reduce(
      (sum, s) => sum + (s.estimatedDurationMinutes || 0),
      0,
    );

    // Sonraki yapılacaklar
    const nextDueItems = allItems
      .filter((item) => !item.completed && item.dueDate)
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
      .slice(0, 5);

    // Timeline ve milestones
    const timeline = this.buildTimeline(enrichedSections, allItems);
    const milestones = this.buildMilestones(enrichedSections, allItems);
    const emergencyContacts = this.buildEmergencyContacts(params);

    // Customization
    const customizations: PlanCustomization = {
      familySize: params.familySize || 4,
      hasChildren: params.hasChildren || false,
      hasElderly: params.hasElderly || false,
      hasPets: params.hasPets || false,
      hasDisabilities: params.hasDisabilities || false,
      locationName: params.locationName,
      riskLevel: params.riskLevel,
      residenceType: params.residenceType,
      preferences: {
        language: 'tr',
        reminderFrequency: 'weekly',
        notificationEnabled: true,
      },
    };

    return {
      id: 'plan_' + Date.now(),
      title: parsed.title || 'Kişisel Afet Hazırlık Planı',
      sections: enrichedSections,
      completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      personaSummary: parsed.personaSummary || `${params.locationName || 'Bulunduğunuz bölge'} için ${params.riskLevel || 'orta'} risk profiline sahip ${params.familySize || 4} kişilik aile hazır olma planı. ${totalItems} görev, ${criticalItemsRemaining} kritik görev kaldı.`,
      totalItems,
      completedItems,
      criticalItemsRemaining,
      estimatedTotalDurationMinutes: estimatedTotalDuration,
      nextDueItems,
      timeline,
      milestones,
      emergencyContacts,
      customizations,
    };
  }

  /**
   * AI yanıtını parse et ve validate et
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // ELITE: Use debug level - expected when AI response is truncated
        logger.debug('AI JSON response incomplete (expected, using rule-based fallback)', { responseLength: response.length });
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError: unknown) {
        // ELITE: If parsing fails, try to extract and fix common issues
        const parseErrMsg = getErrorMessage(parseError);
        logger.warn('Initial JSON parse failed, attempting fixes:', parseErrMsg);

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
            // ELITE: Use debug level - expected when AI response is truncated
            logger.debug('AI sections parse incomplete (expected, using fallback):', sectionsParseError);
            throw parseError; // Re-throw original error
          }
        } else {
          // No sections found - use debug level (expected for truncated responses)
          logger.debug('AI JSON incomplete, will use rule-based fallback:', {
            jsonLength: jsonString.length,
          });
          throw parseError;
        }
      }

      // Validate
      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        // ELITE: Use debug level - expected for truncated AI responses
        logger.debug('AI sections array incomplete (expected, using fallback)');
        throw new Error('Sections array eksik');
      }

      if (parsed.sections.length === 0) {
        logger.warn('AI response returned empty sections array, using fallback');
        throw new Error('Empty sections array');
      }

      // Her section'ı validate et
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // ELITE: Use debug level for expected AI parsing failures (not user-facing errors)
      logger.debug('AI response parse error (expected, using fallback):', error);
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
    // ELITE: Sections array - completionRate and category will be added in enrichedSections
    const sections: Omit<PlanSection, 'completionRate' | 'category'>[] = [
      {
        id: 'emergency_kit',
        title: 'Acil Durum Çantası',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Deprem sonrası en az 72 saat boyunca aileyi destekleyecek temel ihtiyaçlar hazır olmalı.',
        estimatedDurationMinutes: 180,
        resources: ['AFAD Deprem Çantası Rehberi', 'Yerel eczaneler', 'Marketler'],
        items: [
          {
            id: 'kit_water',
            text: `Su (kişi başı 3 günlük, ${(params.familySize || 4) * 3} litre)`,
            completed: false,
            importance: 'critical',
            instructions: 'Kapalı şişelerde su stoklayın, 6 ayda bir yenileyin. Her aile üyesi için günlük 3 litre su hesaplayın.',
            dueDate: Date.now() + 24 * 60 * 60 * 1000,
          },
          {
            id: 'kit_food',
            text: 'Konserve yiyecekler ve hazır gıdalar (3 günlük)',
            completed: false,
            importance: 'high',
            instructions: 'Konserve açacağı ve düşük pişirme gerektiren gıdaları tercih edin. Enerji barları, kuruyemiş ve konserve et/balık ekleyin.',
            dueDate: Date.now() + 48 * 60 * 60 * 1000,
          },
          {
            id: 'kit_first_aid',
            text: 'İlk yardım çantası ve ilaçlar',
            completed: false,
            importance: 'critical',
            instructions: 'Düzenli kullanılan ilaçları 1 haftalık stoklayın. İlk yardım çantası içeriğini AFAD standartlarına göre hazırlayın.',
          },
          {
            id: 'kit_power',
            text: 'El feneri, powerbank ve yedek piller',
            completed: false,
            importance: 'high',
            instructions: 'Powerbankleri ayda bir şarj edin. Her cihaz için yedek pil bulundurun.',
          },
          {
            id: 'kit_documents',
            text: 'Önemli belgelerin su geçirmez kopyaları',
            completed: false,
            importance: 'medium',
            instructions: 'Kimlik, tapu, sigorta, sağlık kayıtlarını dijital ve basılı saklayın. Su geçirmez poşet içinde saklayın.',
          },
          {
            id: 'kit_clothing',
            text: 'Yedek kıyafet ve battaniye',
            completed: false,
            importance: 'high',
            instructions: 'Her aile üyesi için yedek iç çamaşırı, çorap ve mevsimlik kıyafet. Isı yalıtımlı battaniye.',
          },
          {
            id: 'kit_hygiene',
            text: 'Hijyen malzemeleri',
            completed: false,
            importance: 'high',
            instructions: 'Islak mendil, tuvalet kağıdı, diş fırçası, sabun, dezenfektan, kadın hijyen ürünleri.',
          },
          {
            id: 'kit_tools',
            text: 'Çok amaçlı aletler',
            completed: false,
            importance: 'medium',
            instructions: 'Çakı, pense, bant, ip, çöp poşeti, düdük, pusula.',
          },
          {
            id: 'kit_cash',
            text: 'Nakit para ve bozukluk',
            completed: false,
            importance: 'high',
            instructions: 'En az 1000 TL nakit para ve küçük banknotlar. ATM\'ler çalışmayabilir.',
          },
          {
            id: 'kit_radio',
            text: 'Pilli radyo ve yedek piller',
            completed: false,
            importance: 'medium',
            instructions: 'Haberleri takip etmek için pilli veya kranklı radyo.',
          },
        ],
      },
      {
        id: 'communication',
        title: 'İletişim Planı',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Aile bireyleri deprem sonrası nerede buluşacağını ve kimlerle iletişim kuracağını bilmelidir.',
        estimatedDurationMinutes: 120,
        resources: ['AFAD Aile Afet Planı Formu', 'AFAD Deprem Dede Uygulaması'],
        items: [
          {
            id: 'comm_meeting',
            text: 'Aile toplanma noktası belirle',
            completed: false,
            importance: 'critical',
            instructions: `${params.locationName || 'Mahallenizde'} en güvenli toplanma alanını seçin ve herkesle paylaşın. AFAD toplanma alanlarını kontrol edin.`,
            dueDate: Date.now() + 24 * 60 * 60 * 1000,
          },
          {
            id: 'comm_list',
            text: 'Acil durum iletişim listesi oluştur',
            completed: false,
            importance: 'high',
            instructions: 'Telefon, WhatsApp, SMS ve alternatif iletişim kanallarını ekleyin. Her aile üyesinin telefonunu kaydedin.',
          },
          {
            id: 'comm_out_of_city',
            text: 'Şehir dışı iletişim kişisi belirle',
            completed: false,
            importance: 'high',
            instructions: 'Aile dışından güvenilir bir kişiyi acil irtibat noktası olarak görevlendirin. Bu kişi tüm aile üyelerinin durumunu takip edecek.',
          },
          {
            id: 'comm_drill',
            text: 'Aileyle deprem tatbikatı yap',
            completed: false,
            importance: 'medium',
            instructions: 'Ayda bir çök-kapan-tutun ve tahliye pratiği yapın. Toplanma noktasına kadar yürüyüş rotasını test edin.',
          },
          {
            id: 'comm_alternative',
            text: 'Alternatif iletişim yöntemleri belirle',
            completed: false,
            importance: 'medium',
            instructions: 'SMS, sosyal medya, e-posta ve fiziksel mesajlaşma yöntemlerini planlayın.',
          },
          {
            id: 'comm_emergency_numbers',
            text: 'Acil durum numaralarını kaydet',
            completed: false,
            importance: 'critical',
            instructions: '112, 122 (AFAD), 110 (Polis), 155 (Jandarma), belediye hattı ve komşu telefonlarını kaydedin.',
          },
          {
            id: 'comm_phone_charge',
            text: 'Telefon şarj planı oluştur',
            completed: false,
            importance: 'high',
            instructions: 'Powerbank, araba şarjı, güneş paneli gibi alternatif şarj yöntemlerini hazırlayın.',
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
        estimatedDurationMinutes: 240,
        resources: ['AFAD Bina Güvenlik Kontrol Listesi', 'Yerel itfaiye'],
        items: [
          {
            id: 'home_anchor',
            text: 'Ağır eşyaları duvara sabitle',
            completed: false,
            importance: 'high',
            instructions: 'Dolap, kitaplık, televizyon, buzdolabı, çamaşır makinesi gibi eşyaları L demirleriyle sabitleyin.',
          },
          {
            id: 'home_valves',
            text: 'Gaz ve elektrik vanalarını öğren',
            completed: false,
            importance: 'critical',
            instructions: 'Kapama anahtarlarını etiketleyin ve aile bireylerine gösterin. Her ay kontrol edin.',
          },
          {
            id: 'home_extinguisher',
            text: 'Yangın söndürücü ve duman alarmı temin et',
            completed: false,
            importance: 'high',
            instructions: 'Söndürücüyü yılda bir kontrol edin, duman alarmlarının pillerini değiştirin. Her katta alarm bulundurun.',
          },
          {
            id: 'home_safezone',
            text: 'Yaşam üçgeni bölgelerini belirle',
            completed: false,
            importance: 'medium',
            instructions: 'Dayanıklı mobilya yanları ve koltuk altları gibi güvenli alanları işaretleyin. Her odada en az bir güvenli alan.',
          },
          {
            id: 'home_glass',
            text: 'Cam eşyaları güvenli hale getir',
            completed: false,
            importance: 'medium',
            instructions: 'Cam eşyaları alt raflara taşıyın veya sabitleyin. Büyük camları film ile güçlendirin.',
          },
          {
            id: 'home_exits',
            text: 'Acil çıkış yollarını kontrol et',
            completed: false,
            importance: 'critical',
            instructions: 'Tüm acil çıkış yollarının açık olduğundan emin olun. Merdiven ve koridorları engelsiz tutun.',
          },
          {
            id: 'home_furniture',
            text: 'Mobilya düzenlemesi yap',
            completed: false,
            importance: 'medium',
            instructions: 'Yatakları pencere ve camdan uzak yerleştirin. Ağır eşyaları üst raflara koymayın.',
          },
          {
            id: 'home_utilities',
            text: 'Elektrik ve su tesisatını kontrol et',
            completed: false,
            importance: 'high',
            instructions: 'Eski veya hasarlı kabloları değiştirin. Su vanalarının çalıştığından emin olun.',
          },
        ],
      },
      {
        id: 'documentation',
        title: 'Belge ve Kayıt Yönetimi',
        priority: 'medium',
        phase: 'hazirlik',
        summary: 'Önemli belgelerin güvenli saklanması ve dijital kopyalarının hazırlanması.',
        estimatedDurationMinutes: 120,
        resources: ['Noter', 'Dijital depolama'],
        items: [
          {
            id: 'doc_identity',
            text: 'Kimlik belgelerinin kopyaları',
            completed: false,
            importance: 'critical',
            instructions: 'Kimlik kartı, pasaport, ehliyet kopyalarını su geçirmez poşette saklayın.',
          },
          {
            id: 'doc_property',
            text: 'Tapu ve sigorta belgeleri',
            completed: false,
            importance: 'high',
            instructions: 'Tapu, DASK, konut sigortası poliçelerinin kopyalarını hazırlayın.',
          },
          {
            id: 'doc_health',
            text: 'Sağlık kayıtları ve reçeteler',
            completed: false,
            importance: 'high',
            instructions: 'Kronik hastalık raporları, alerji bilgileri, reçeteler ve aşı kartlarını saklayın.',
          },
          {
            id: 'doc_financial',
            text: 'Finansal belgeler',
            completed: false,
            importance: 'medium',
            instructions: 'Banka hesap bilgileri, kredi kartı numaraları, sigorta poliçeleri.',
          },
          {
            id: 'doc_digital',
            text: 'Dijital kopyalar oluştur',
            completed: false,
            importance: 'high',
            instructions: 'Tüm belgelerin dijital kopyalarını bulut depolamada saklayın.',
          },
        ],
      },
      {
        id: 'financial_preparation',
        title: 'Finansal Hazırlık',
        priority: 'medium',
        phase: 'hazirlik',
        summary: 'Acil durumda finansal ihtiyaçları karşılamak için hazırlık.',
        estimatedDurationMinutes: 90,
        resources: ['Banka', 'Sigorta şirketleri'],
        items: [
          {
            id: 'finance_cash',
            text: 'Acil durum nakit fonu',
            completed: false,
            importance: 'high',
            instructions: 'En az 1-2 aylık giderleri karşılayacak nakit para hazırlayın.',
          },
          {
            id: 'finance_insurance',
            text: 'Sigorta poliçelerini gözden geçir',
            completed: false,
            importance: 'high',
            instructions: 'DASK, konut sigortası, hayat sigortası poliçelerini kontrol edin ve güncelleyin.',
          },
          {
            id: 'finance_bank',
            text: 'Banka bilgilerini kaydet',
            completed: false,
            importance: 'medium',
            instructions: 'Hesap numaraları, şube bilgileri ve online bankacılık erişim bilgilerini güvenli yerde saklayın.',
          },
          {
            id: 'finance_emergency',
            text: 'Acil durum kredi limiti',
            completed: false,
            importance: 'low',
            instructions: 'Kredi kartı limitlerini kontrol edin ve acil durumda kullanılabilir olduğundan emin olun.',
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

    // ELITE: Yeni ileri seviye bölümler
    sections.push({
      id: 'psychological_preparation',
      title: 'Psikolojik Hazırlık ve Stres Yönetimi',
      priority: 'high',
      phase: 'hazirlik',
      summary: 'Deprem öncesi, sırası ve sonrasında psikolojik sağlığı korumak için hazırlık yapın.',
      estimatedDurationMinutes: 90,
      resources: ['AFAD Psikososyal Destek Rehberi', 'Kızılay Psikolojik Destek Hattı', 'Türk Psikologlar Derneği'],
      items: [
        {
          id: 'psycho_education',
          text: 'Deprem psikolojisi ve stres yönetimi eğitimi',
          completed: false,
          importance: 'high',
          instructions: 'Deprem öncesi kaygı, sırasında panik, sonrasında travma belirtilerini öğrenin. Nefes teknikleri ve gevşeme egzersizleri öğrenin.',
          dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'psycho_family_talk',
          text: 'Aile ile açık iletişim kurma planı',
          completed: false,
          importance: 'high',
          instructions: 'Çocuklar ve yaşlılarla deprem hakkında yaşlarına uygun konuşmalar yapın. Korkuları dinleyin ve güven verin.',
        },
        {
          id: 'psycho_support_network',
          text: 'Psikolojik destek ağı oluştur',
          completed: false,
          importance: 'medium',
          instructions: 'Psikolog, psikiyatrist, danışman iletişim bilgilerini kaydedin. Komşularla karşılıklı destek anlaşması yapın.',
        },
        {
          id: 'psycho_comfort_items',
          text: 'Rahatlama ve sakinleştirme malzemeleri',
          completed: false,
          importance: 'medium',
          instructions: 'Müzik çalar, kitaplar, oyunlar, meditasyon uygulamaları gibi stres azaltıcı öğeler hazırlayın.',
        },
        {
          id: 'psycho_routine',
          text: 'Rutin koruma planı',
          completed: false,
          importance: 'medium',
          instructions: 'Deprem sonrası bile mümkün olduğunca normal rutinleri koruyun. Çocuklar için oyun ve aktivite zamanları planlayın.',
        },
      ],
    });

    sections.push({
      id: 'vehicle_preparation',
      title: 'Araç Hazırlığı ve Mobilite',
      priority: 'medium',
      phase: 'hazirlik',
      summary: 'Araç içinde acil durum malzemeleri ve tahliye için hazırlık yapın.',
      estimatedDurationMinutes: 120,
      resources: ['AFAD Araç Acil Durum Çantası Rehberi', 'Otomobil Kulüpleri'],
      items: [
        {
          id: 'vehicle_kit',
          text: 'Araç acil durum çantası hazırla',
          completed: false,
          importance: 'high',
          instructions: 'Araçta su, yiyecek, battaniye, ilk yardım çantası, yedek yakıt bidonu, çekme halatı, takoz bulundurun.',
        },
        {
          id: 'vehicle_maintenance',
          text: 'Araç bakım ve yakıt kontrolü',
          completed: false,
          importance: 'high',
          instructions: 'Yakıt seviyesini yarıdan fazla tutun. Lastik, akü, fren kontrolü yapın. Yedek anahtar hazırlayın.',
        },
        {
          id: 'vehicle_documents',
          text: 'Araç belgelerinin kopyaları',
          completed: false,
          importance: 'medium',
          instructions: 'Ruhsat, sigorta, ehliyet kopyalarını araçta saklayın. Sigorta poliçesi bilgilerini kaydedin.',
        },
        {
          id: 'vehicle_evacuation_route',
          text: 'Tahliye rotaları belirle',
          completed: false,
          importance: 'high',
          instructions: 'Alternatif çıkış yolları planlayın. Köprü ve viyadüklerden kaçının. Yüksek alanlara çıkış rotaları belirleyin.',
        },
        {
          id: 'vehicle_communication',
          text: 'Araç içi iletişim cihazları',
          completed: false,
          importance: 'medium',
          instructions: 'Araç şarj cihazı, powerbank, CB radyo veya walkie-talkie bulundurun.',
        },
      ],
    });

    sections.push({
      id: 'workplace_preparation',
      title: 'İşyeri Hazırlığı',
      priority: 'medium',
      phase: 'hazirlik',
      summary: 'İşyerinde deprem hazırlığı ve tahliye planı oluşturun.',
      estimatedDurationMinutes: 180,
      resources: ['İş Sağlığı ve Güvenliği Müdürlüğü', 'AFAD İşyeri Hazırlık Rehberi'],
      items: [
        {
          id: 'workplace_kit',
          text: 'İşyeri acil durum çantası',
          completed: false,
          importance: 'high',
          instructions: 'Masa çekmecesinde su, enerji barı, ilk yardım malzemeleri, el feneri, düdük bulundurun.',
        },
        {
          id: 'workplace_evacuation',
          text: 'İşyeri tahliye planını öğren',
          completed: false,
          importance: 'critical',
          instructions: 'Acil çıkış yolları, toplanma noktaları, yangın merdivenleri konumlarını öğrenin ve pratik yapın.',
        },
        {
          id: 'workplace_safe_zones',
          text: 'İşyerinde güvenli alanları belirle',
          completed: false,
          importance: 'high',
          instructions: 'Masa altları, sağlam mobilya yanları, kolon yanları gibi güvenli alanları işaretleyin.',
        },
        {
          id: 'workplace_communication',
          text: 'İşyeri acil iletişim listesi',
          completed: false,
          importance: 'high',
          instructions: 'İş arkadaşları, yöneticiler, güvenlik görevlileri iletişim bilgilerini kaydedin.',
        },
        {
          id: 'workplace_family_coordination',
          text: 'İşyeri-aile koordinasyon planı',
          completed: false,
          importance: 'high',
          instructions: 'Deprem sonrası işyerinden eve nasıl ulaşacağınızı planlayın. Alternatif rotalar belirleyin.',
        },
      ],
    });

    sections.push({
      id: 'neighbor_coordination',
      title: 'Komşu Koordinasyonu ve Topluluk Dayanışması',
      priority: 'medium',
      phase: 'hazirlik',
      summary: 'Komşularla karşılıklı destek ağı ve koordinasyon planı oluşturun.',
      estimatedDurationMinutes: 120,
      resources: ['Mahalle Muhtarlığı', 'AFAD Topluluk Hazırlık Rehberi'],
      items: [
        {
          id: 'neighbor_meeting',
          text: 'Komşularla hazırlık toplantısı düzenle',
          completed: false,
          importance: 'high',
          instructions: 'Mahalle sakinleriyle bir araya gelin. Yaşlı, engelli, yalnız yaşayan komşuları belirleyin.',
        },
        {
          id: 'neighbor_contact_list',
          text: 'Komşu iletişim listesi oluştur',
          completed: false,
          importance: 'high',
          instructions: 'Komşuların telefon numaraları, adresleri, özel ihtiyaçları (ilaç, tıbbi cihaz) bilgilerini kaydedin.',
        },
        {
          id: 'neighbor_mutual_aid',
          text: 'Karşılıklı yardım anlaşması',
          completed: false,
          importance: 'medium',
          instructions: 'İlaç paylaşımı, çocuk bakımı, yaşlı yardımı, araç paylaşımı gibi konularda anlaşma yapın.',
        },
        {
          id: 'neighbor_resource_sharing',
          text: 'Kaynak paylaşım planı',
          completed: false,
          importance: 'medium',
          instructions: 'Su, yiyecek, ilaç, yakıt, jeneratör gibi kaynakların paylaşımını planlayın.',
        },
        {
          id: 'neighbor_communication_channel',
          text: 'Komşu iletişim kanalı kur',
          completed: false,
          importance: 'high',
          instructions: 'WhatsApp grubu, SMS zinciri veya fiziksel mesajlaşma sistemi kurun.',
        },
      ],
    });

    sections.push({
      id: 'water_food_safety',
      title: 'Su ve Gıda Güvenliği',
      priority: 'high',
      phase: 'hazirlik',
      summary: 'Deprem sonrası su ve gıda güvenliği için detaylı hazırlık yapın.',
      estimatedDurationMinutes: 180,
      resources: ['AFAD Su ve Gıda Güvenliği Rehberi', 'Türk Kızılayı'],
      items: [
        {
          id: 'water_storage_advanced',
          text: 'Gelişmiş su stoklama sistemi',
          completed: false,
          importance: 'critical',
          instructions: 'Her aile üyesi için günlük 4 litre su (içme + temizlik). Su filtreleri, dezenfektan tabletleri hazırlayın.',
        },
        {
          id: 'water_purification',
          text: 'Su arıtma ve dezenfeksiyon yöntemleri',
          completed: false,
          importance: 'high',
          instructions: 'Kaynatma, klor tabletleri, filtre sistemleri öğrenin. Acil durumda musluk suyunu nasıl güvenli hale getireceğinizi bilin.',
        },
        {
          id: 'food_storage_advanced',
          text: 'Uzun süreli gıda stoklama',
          completed: false,
          importance: 'high',
          instructions: 'Konserve, kurutulmuş gıdalar, tahıllar, baklagiller stoklayın. Son kullanma tarihlerini takip edin.',
        },
        {
          id: 'food_preparation',
          text: 'Pişirme ve hazırlama planı',
          completed: false,
          importance: 'medium',
          instructions: 'Portatif ocak, yakıt, konserve açacağı, tabak, çatal hazırlayın. Gaz ve elektrik olmadan pişirme yöntemleri öğrenin.',
        },
        {
          id: 'food_safety',
          text: 'Gıda güvenliği kuralları',
          completed: false,
          importance: 'high',
          instructions: 'Buzdolabı açılmadan önce ne kadar süre dayanacağını öğrenin. Bozulmuş gıdaları nasıl tespit edeceğinizi bilin.',
        },
      ],
    });

    sections.push({
      id: 'alternative_shelter',
      title: 'Alternatif Barınma Planı',
      priority: 'medium',
      phase: 'hazirlik',
      summary: 'Ev güvenli değilse alternatif barınma seçenekleri planlayın.',
      estimatedDurationMinutes: 90,
      resources: ['AFAD Geçici Barınma Merkezleri', 'Belediye Acil Barınma Planı'],
      items: [
        {
          id: 'shelter_research',
          text: 'Geçici barınma merkezlerini araştır',
          completed: false,
          importance: 'high',
          instructions: 'AFAD ve belediye geçici barınma merkezlerinin konumlarını öğrenin. Hangi merkeze gideceğinizi belirleyin.',
        },
        {
          id: 'shelter_alternatives',
          text: 'Alternatif barınma seçenekleri',
          completed: false,
          importance: 'medium',
          instructions: 'Araç, çadır, komşu evi, akraba evi gibi alternatifleri değerlendirin. Her seçenek için rota planlayın.',
        },
        {
          id: 'shelter_supplies',
          text: 'Barınma için gerekli malzemeler',
          completed: false,
          importance: 'high',
          instructions: 'Çadır, uyku tulumu, mat, battaniye, portatif tuvalet gibi malzemeler hazırlayın.',
        },
        {
          id: 'shelter_documents',
          text: 'Barınma için gerekli belgeler',
          completed: false,
          importance: 'high',
          instructions: 'Kimlik, ikamet belgesi, aile bireyleri bilgileri gibi belgeleri hazır tutun.',
        },
      ],
    });

    sections.push({
      id: 'communication_tech',
      title: 'İletişim Teknolojileri ve Alternatif Yöntemler',
      priority: 'high',
      phase: 'hazirlik',
      summary: 'Klasik iletişim yöntemleri başarısız olursa alternatif teknolojiler hazırlayın.',
      estimatedDurationMinutes: 120,
      resources: ['AFAD İletişim Rehberi', 'Amatör Telsizcilik Derneği'],
      items: [
        {
          id: 'comm_satellite',
          text: 'Uydu telefonu veya cihazı',
          completed: false,
          importance: 'medium',
          instructions: 'Uydu telefonu veya uydu mesajlaşma cihazı (Garmin inReach, SPOT) değerlendirin.',
        },
        {
          id: 'comm_radio',
          text: 'Amatör telsiz ve CB radyo',
          completed: false,
          importance: 'medium',
          instructions: 'Amatör telsiz lisansı alın veya CB radyo kullanın. Acil durum frekanslarını öğrenin.',
        },
        {
          id: 'comm_mesh',
          text: 'Mesh ağ teknolojileri',
          completed: false,
          importance: 'low',
          instructions: 'WiFi mesh veya Bluetooth mesh uygulamaları (FireChat, Bridgefy) deneyin.',
        },
        {
          id: 'comm_offline',
          text: 'Offline iletişim yöntemleri',
          completed: false,
          importance: 'high',
          instructions: 'Fiziksel mesajlaşma, işaretler, duman, ayna gibi offline yöntemleri öğrenin.',
        },
        {
          id: 'comm_backup',
          text: 'Yedek iletişim cihazları',
          completed: false,
          importance: 'high',
          instructions: 'Yedek telefon, powerbank, şarj cihazları, piller hazırlayın.',
        },
      ],
    });

    // Özel durumlar için ek bölümler (genişletilmiş)
    if (params.hasChildren) {
      sections.push({
        id: 'children_care',
        title: 'Çocuk Bakımı ve Güvenliği',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Çocukların deprem anında sakin kalması ve ihtiyaçlarının karşılanması için kapsamlı hazırlık yapın.',
        estimatedDurationMinutes: 180,
        resources: ['AFAD Çocuk Güvenliği Rehberi', 'UNICEF Çocuk Psikolojisi Rehberi'],
        items: [
          {
            id: 'child_supplies',
            text: 'Çocuk bezi ve mama stoğu (1 haftalık)',
            completed: false,
            importance: 'critical',
            instructions: 'Rutin tüketimi takip ederek stokları güncelleyin. Bebek maması, biberon, emzik, bebek bezi, ıslak mendil hazırlayın.',
            dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
          },
          {
            id: 'child_drill',
            text: 'Çocuklara deprem tatbikatı yaptır',
            completed: false,
            importance: 'high',
            instructions: 'Eğlenceli senaryolar ile korkuyu azaltın. Çök-kapan-tutun pozisyonunu oyunlaştırın. Yaşlarına uygun açıklamalar yapın.',
          },
          {
            id: 'child_med',
            text: 'Çocukların ilaçları ve sağlık kayıtları',
            completed: false,
            importance: 'critical',
            instructions: 'Alerji ve kronik durum bilgilerini çantada bulundurun. Çocuk ilaçları, ateş düşürücü, vitaminler hazırlayın.',
          },
          {
            id: 'child_comfort',
            text: 'Oyuncak ve rahatlatıcı eşyalar',
            completed: false,
            importance: 'medium',
            instructions: 'Stres anında sakinleştirici objeler hazırlayın. Sevdiği oyuncak, kitap, battaniye, fotoğraf albümü ekleyin.',
          },
          {
            id: 'child_school_coordination',
            text: 'Okul ile koordinasyon planı',
            completed: false,
            importance: 'high',
            instructions: 'Okulun acil durum planını öğrenin. Çocuğu okuldan kimin alacağını belirleyin. Alternatif toplanma noktaları planlayın.',
          },
          {
            id: 'child_identification',
            text: 'Çocuk kimlik bilgileri',
            completed: false,
            importance: 'critical',
            instructions: 'Çocuğun kimlik bilgileri, fotoğrafı, parmak izi, tıbbi bilgileri acil durum çantasında bulundurun.',
          },
        ],
      });
    }

    if (params.hasElderly) {
      sections.push({
        id: 'elderly_care',
        title: 'Yaşlı Bakımı ve Güvenliği',
        priority: 'high',
        phase: 'hazirlik',
        summary: 'Yaşlı bireylerin ilaç, hareket, tahliye ve özel ihtiyaçlarına göre kapsamlı plan yapın.',
        estimatedDurationMinutes: 180,
        resources: ['AFAD Yaşlı Bakımı Rehberi', 'Türk Geriatri Derneği', 'Yerel Sağlık Müdürlüğü'],
        items: [
          {
            id: 'elderly_med',
            text: 'Düzenli kullanılan ilaçlar (1 aylık)',
            completed: false,
            importance: 'critical',
            instructions: 'Tüm reçeteli ilaçları 1 aylık stoklayın. İlaç listesi, dozaj bilgileri, yan etkileri kaydedin. İlaçları soğuk zincirde saklayın.',
            dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
          },
          {
            id: 'elderly_device',
            text: 'Yedek gözlük/işitme cihazı ve yardımcı cihazlar',
            completed: false,
            importance: 'critical',
            instructions: 'Yedek gözlük, işitme cihazı, yürüteç, baston, tekerlekli sandalye hazırlayın. Pilleri kontrol edin.',
          },
          {
            id: 'elderly_docs',
            text: 'Sağlık raporları ve reçeteler',
            completed: false,
            importance: 'critical',
            instructions: 'Kronik hastalık raporları, reçeteler, aşı kartı, tahlil sonuçları, doktor iletişim bilgileri hazırlayın.',
          },
          {
            id: 'elderly_mobility',
            text: 'Yürüteç/tekerlekli sandalye kontrolü ve tahliye planı',
            completed: false,
            importance: 'high',
            instructions: 'Mobilite cihazlarını kontrol edin. Tahliye sırasında nasıl taşınacağını planlayın. Komşularla yardım anlaşması yapın.',
          },
          {
            id: 'elderly_nutrition',
            text: 'Özel beslenme ihtiyaçları',
            completed: false,
            importance: 'high',
            instructions: 'Diyabet, hipertansiyon, böbrek hastalığı gibi özel diyet ihtiyaçlarını planlayın. Uygun gıdaları stoklayın.',
          },
          {
            id: 'elderly_comfort',
            text: 'Konfor ve sıcaklık kontrolü',
            completed: false,
            importance: 'medium',
            instructions: 'Battaniye, sıcak tutucu giysiler, portatif ısıtıcı hazırlayın. Hipotermi riskine karşı önlem alın.',
          },
          {
            id: 'elderly_communication',
            text: 'Basit iletişim yöntemleri',
            completed: false,
            importance: 'medium',
            instructions: 'Büyük yazılı notlar, işaret kartları, düdük gibi basit iletişim araçları hazırlayın.',
          },
        ],
      });
    }

    if (params.hasPets) {
      sections.push({
        id: 'pet_care',
        title: 'Evcil Hayvan Bakımı ve Güvenliği',
        priority: 'medium',
        phase: 'hazirlik',
        summary: 'Evcil dostların güvenliği için yiyecek, su, tahliye ve sağlık planlarını düzenleyin.',
        estimatedDurationMinutes: 120,
        resources: ['AFAD Evcil Hayvan Hazırlık Rehberi', 'Veteriner Hekimler Birliği', 'Hayvan Barınakları'],
        items: [
          {
            id: 'pet_food',
            text: 'Evcil hayvan maması ve su (1 haftalık)',
            completed: false,
            importance: 'high',
            instructions: 'Kuru mama, konserve mama, su stoklayın. Özel diyet ihtiyaçlarını göz önünde bulundurun.',
          },
          {
            id: 'pet_carrier',
            text: 'Taşıma çantası ve su kabı',
            completed: false,
            importance: 'high',
            instructions: 'Hayvanın boyutuna uygun taşıma çantası, su kabı, mama kabı hazırlayın. Çanta içine tanıdık oyuncak ekleyin.',
          },
          {
            id: 'pet_records',
            text: 'Veteriner kayıtları ve aşı kartı',
            completed: false,
            importance: 'high',
            instructions: 'Aşı kartı, veteriner iletişim bilgileri, sağlık kayıtları, ilaç listesi hazırlayın.',
          },
          {
            id: 'pet_tag',
            text: 'Tasma, kimlik etiketi ve mikroçip kontrolü',
            completed: false,
            importance: 'critical',
            instructions: 'Kimlik etiketi, tasma, mikroçip bilgilerini kontrol edin. Acil durumda kaybolma riskine karşı önlem alın.',
          },
          {
            id: 'pet_medication',
            text: 'Evcil hayvan ilaçları ve ilk yardım',
            completed: false,
            importance: 'high',
            instructions: 'Düzenli kullanılan ilaçları stoklayın. Evcil hayvan ilk yardım çantası hazırlayın.',
          },
          {
            id: 'pet_evacuation',
            text: 'Evcil hayvan tahliye planı',
            completed: false,
            importance: 'high',
            instructions: 'Hangi barınaklara kabul edildiğini öğrenin. Alternatif barınma seçenekleri planlayın.',
          },
          {
            id: 'pet_comfort',
            text: 'Stres azaltıcı öğeler',
            completed: false,
            importance: 'medium',
            instructions: 'Tanıdık oyuncak, battaniye, yatak hazırlayın. Stres anında sakinleştirici öğeler bulundurun.',
          },
        ],
      });
    }

    // ELITE: Tüm section'ları detaylandır ve completion rate hesapla
    // CRITICAL: Ensure items array is preserved and not lost during enrichment
    const enrichedSections: PlanSection[] = sections.map((section) => {
      // CRITICAL: Validate section has items before processing
      if (!section.items || !Array.isArray(section.items) || section.items.length === 0) {
        logger.warn(`⚠️ Section ${section.id} has no items, skipping enrichment`);
        return null;
      }

      const completedItems = section.items.filter((item) => item.completed).length;
      const totalItems = section.items.length;
      const sectionCompletionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // CRITICAL: Map items and ensure they are preserved
      const enrichedItems = section.items.map((item) => this.enrichPlanItem(item, params));

      // CRITICAL: Validate enriched items are not empty
      if (!enrichedItems || enrichedItems.length === 0) {
        logger.error(`❌ Section ${section.id} items were lost during enrichment!`, {
          originalItems: section.items.length,
          enrichedItems: enrichedItems?.length || 0,
        });
        // Return original items if enrichment failed
        return {
          ...section,
          completionRate: sectionCompletionRate,
          category: this.getSectionCategory(section.id),
          icon: this.getSectionIcon(section.id),
          color: this.getSectionColor(section.id),
          estimatedCost: this.getSectionCost(section.id),
          difficulty: this.getSectionDifficulty(section.id),
          frequency: section.phase === 'tatbikat' ? 'monthly' : 'once' as const,
          items: section.items, // Use original items if enrichment failed
        } as PlanSection;
      }

      return {
        ...section,
        completionRate: sectionCompletionRate,
        category: this.getSectionCategory(section.id),
        icon: this.getSectionIcon(section.id),
        color: this.getSectionColor(section.id),
        estimatedCost: this.getSectionCost(section.id),
        difficulty: this.getSectionDifficulty(section.id),
        frequency: section.phase === 'tatbikat' ? 'monthly' : 'once' as const,
        items: enrichedItems, // CRITICAL: Use enriched items
      } as PlanSection;
    }).filter((section): section is PlanSection => section !== null); // Filter out null sections

    // ELITE: Toplam istatistikler - CRITICAL: Validate items exist
    const allItems = enrichedSections.flatMap((s) => {
      if (!s.items || !Array.isArray(s.items)) {
        logger.warn(`⚠️ Section ${s.id} has invalid items array`);
        return [];
      }
      return s.items;
    });
    const totalItems = allItems.length;

    // CRITICAL: Log total items for debugging
    if (__DEV__) {
      logger.info(`📊 Preparedness plan statistics: ${enrichedSections.length} sections, ${totalItems} total items`);
    }

    const completedItems = allItems.filter((item) => item.completed).length;
    const criticalItemsRemaining = allItems.filter(
      (item) => !item.completed && item.importance === 'critical',
    ).length;
    const estimatedTotalDuration = enrichedSections.reduce(
      (sum, s) => sum + (s.estimatedDurationMinutes || 0),
      0,
    );

    // Sonraki yapılacaklar (due date'e göre sıralı)
    const nextDueItems = allItems
      .filter((item) => !item.completed && item.dueDate)
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
      .slice(0, 5);

    // Timeline oluştur
    const timeline = this.buildTimeline(enrichedSections, allItems);

    // Milestone'lar oluştur
    const milestones = this.buildMilestones(enrichedSections, allItems);

    // Acil durum iletişim listesi
    const emergencyContacts = this.buildEmergencyContacts(params);

    // Customization bilgileri
    const customizations: PlanCustomization = {
      familySize: params.familySize || 4,
      hasChildren: params.hasChildren || false,
      hasElderly: params.hasElderly || false,
      hasPets: params.hasPets || false,
      hasDisabilities: params.hasDisabilities || false,
      locationName: params.locationName,
      riskLevel: params.riskLevel,
      residenceType: params.residenceType,
      preferences: {
        language: 'tr',
        reminderFrequency: 'weekly',
        notificationEnabled: true,
      },
    };

    // ELITE: Validate enriched sections before creating plan
    if (!enrichedSections || enrichedSections.length === 0) {
      logger.error('❌ Enriched sections is empty!', {
        originalSections: sections.length,
        enrichedSections: enrichedSections?.length || 0,
      });
      throw new Error('Failed to enrich plan sections');
    }

    // Validate sections have items
    const validSections = enrichedSections.filter(s => s.items && Array.isArray(s.items) && s.items.length > 0);
    if (validSections.length === 0) {
      logger.error('❌ No sections with items after enrichment!', {
        enrichedSections: enrichedSections.map(s => ({
          id: s.id,
          title: s.title,
          items: s.items?.length || 0,
        })),
      });
      throw new Error('Failed to create plan: No sections with items');
    }

    // Use valid sections (filter out empty ones)
    const finalSections = validSections.length < enrichedSections.length ? validSections : enrichedSections;

    // Recalculate totals with final sections
    const finalAllItems = finalSections.flatMap((s) => s.items);
    const finalTotalItems = finalAllItems.length;
    const finalCompletedItems = finalAllItems.filter((item) => item.completed).length;
    const finalCriticalItemsRemaining = finalAllItems.filter(
      (item) => !item.completed && item.importance === 'critical',
    ).length;
    const finalEstimatedTotalDuration = finalSections.reduce(
      (sum, s) => sum + (s.estimatedDurationMinutes || 0),
      0,
    );

    const finalNextDueItems = finalAllItems
      .filter((item) => !item.completed && item.dueDate)
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
      .slice(0, 5);

    const finalTimeline = this.buildTimeline(finalSections, finalAllItems);
    const finalMilestones = this.buildMilestones(finalSections, finalAllItems);

    const plan: PreparednessPlan = {
      id: 'plan_' + Date.now(),
      title: 'Kapsamlı Afet Hazırlık Planı',
      sections: finalSections, // ELITE: Use finalSections (validated sections with items)
      completionRate: finalTotalItems > 0 ? Math.round((finalCompletedItems / finalTotalItems) * 100) : 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      personaSummary: `${params.locationName || 'Bulunduğunuz bölge'} için ${params.riskLevel || 'orta'} risk profiline sahip ${params.familySize || 4} kişilik aile hazır olma planı. ${finalTotalItems} görev, ${finalCriticalItemsRemaining} kritik görev kaldı.`,
      totalItems: finalTotalItems, // ELITE: Use finalTotalItems (calculated from finalSections)
      completedItems: finalCompletedItems,
      criticalItemsRemaining: finalCriticalItemsRemaining,
      estimatedTotalDurationMinutes: finalEstimatedTotalDuration,
      nextDueItems: finalNextDueItems,
      timeline: finalTimeline,
      milestones: finalMilestones,
      emergencyContacts,
      customizations,
    };

    // ELITE: Final validation before returning
    if (!plan.sections || plan.sections.length === 0) {
      logger.error('❌ Final plan has no sections!', {
        planId: plan.id,
        planTitle: plan.title,
      });
      throw new Error('Failed to create plan: No sections in final plan');
    }

    if (!plan.totalItems || plan.totalItems === 0) {
      logger.error('❌ Final plan has no items!', {
        sections: plan.sections.length,
        sectionItems: plan.sections.map(s => s.items?.length || 0),
      });
      throw new Error('Failed to create plan: No items in final plan');
    }

    if (__DEV__) {
      logger.info('✅ Preparedness plan generated:', {
        sections: finalSections.length,
        totalItems: finalTotalItems,
        completedItems: finalCompletedItems,
        criticalItemsRemaining: finalCriticalItemsRemaining,
        planTitle: plan.title,
      });
    }

    return plan;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private enrichPlanItem(item: PlanItem, params: any): PlanItem {
    const enriched: PlanItem = {
      ...item,
      subTasks: this.getSubTasksForItem(item.id, params),
      checklist: this.getChecklistForItem(item.id),
      estimatedDurationMinutes: this.getEstimatedDuration(item.id),
      estimatedCost: this.getEstimatedCost(item.id, params),
      location: this.getLocationForItem(item.id),
      category: this.getItemCategory(item.id),
      tags: this.getTagsForItem(item.id),
      resources: this.getResourcesForItem(item.id),
      difficulty: this.getDifficultyForItem(item.id),
      verificationMethod: 'manual' as const,
      progress: item.completed ? 100 : 0,
    };
    return enriched;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getSubTasksForItem(itemId: string, params: any): PlanSubTask[] {
    const subTasksMap: Record<string, PlanSubTask[]> = {
      kit_water: [
        { id: 'water_buy', text: 'Su şişeleri satın al', completed: false, estimatedDurationMinutes: 30 },
        { id: 'water_store', text: 'Serin ve karanlık yerde sakla', completed: false, estimatedDurationMinutes: 15 },
        { id: 'water_label', text: 'Son kullanma tarihlerini etiketle', completed: false, estimatedDurationMinutes: 10 },
        { id: 'water_rotate', text: '6 ayda bir suyu yenile', completed: false, estimatedDurationMinutes: 20 },
      ],
      kit_food: [
        { id: 'food_list', text: 'Konserve ve hazır gıda listesi oluştur', completed: false, estimatedDurationMinutes: 20 },
        { id: 'food_buy', text: 'Marketten satın al', completed: false, estimatedDurationMinutes: 60 },
        { id: 'food_organize', text: 'Çantaya yerleştir ve tarihleri kontrol et', completed: false, estimatedDurationMinutes: 30 },
        { id: 'food_check', text: 'Aylık tarih kontrolü yap', completed: false, estimatedDurationMinutes: 15 },
      ],
      kit_first_aid: [
        { id: 'firstaid_list', text: 'İlk yardım malzemeleri listesi oluştur', completed: false, estimatedDurationMinutes: 20 },
        { id: 'firstaid_buy', text: 'Eczaneden satın al', completed: false, estimatedDurationMinutes: 45 },
        { id: 'firstaid_organize', text: 'Çantaya yerleştir ve organize et', completed: false, estimatedDurationMinutes: 30 },
        { id: 'firstaid_training', text: 'Temel ilk yardım eğitimi al', completed: false, estimatedDurationMinutes: 180 },
      ],
      home_anchor: [
        { id: 'anchor_identify', text: 'Sabitlenecek eşyaları belirle', completed: false, estimatedDurationMinutes: 15 },
        { id: 'anchor_buy', text: 'L demirleri ve vidaları satın al', completed: false, estimatedDurationMinutes: 30 },
        { id: 'anchor_install', text: 'Eşyaları duvara sabitle', completed: false, estimatedDurationMinutes: 120 },
        { id: 'anchor_check', text: 'Aylık kontrol ve bakım yap', completed: false, estimatedDurationMinutes: 15 },
      ],
      comm_meeting: [
        { id: 'meeting_research', text: 'AFAD toplanma alanlarını araştır', completed: false, estimatedDurationMinutes: 30 },
        { id: 'meeting_visit', text: 'Toplanma alanını ziyaret et', completed: false, estimatedDurationMinutes: 60 },
        { id: 'meeting_share', text: 'Aile üyeleriyle koordinatları paylaş', completed: false, estimatedDurationMinutes: 15 },
        { id: 'meeting_practice', text: 'Toplanma noktasına yürüyüş pratiği yap', completed: false, estimatedDurationMinutes: 30 },
      ],
      psycho_education: [
        { id: 'psycho_research', text: 'Deprem psikolojisi kaynaklarını araştır', completed: false, estimatedDurationMinutes: 30 },
        { id: 'psycho_learn', text: 'Stres yönetimi tekniklerini öğren', completed: false, estimatedDurationMinutes: 60 },
        { id: 'psycho_practice', text: 'Nefes teknikleri pratiği yap', completed: false, estimatedDurationMinutes: 20 },
      ],
      vehicle_kit: [
        { id: 'vehicle_list', text: 'Araç çantası malzemeleri listesi', completed: false, estimatedDurationMinutes: 20 },
        { id: 'vehicle_buy', text: 'Malzemeleri satın al', completed: false, estimatedDurationMinutes: 60 },
        { id: 'vehicle_organize', text: 'Araçta organize et', completed: false, estimatedDurationMinutes: 30 },
        { id: 'vehicle_check', text: 'Aylık kontrol ve yenileme', completed: false, estimatedDurationMinutes: 15 },
      ],
      workplace_evacuation: [
        { id: 'workplace_map', text: 'Tahliye haritasını incele', completed: false, estimatedDurationMinutes: 15 },
        { id: 'workplace_walk', text: 'Tahliye rotasını yürü', completed: false, estimatedDurationMinutes: 30 },
        { id: 'workplace_practice', text: 'Tatbikata katıl', completed: false, estimatedDurationMinutes: 60 },
      ],
      water_storage_advanced: [
        { id: 'water_calculate', text: 'Aile başına su ihtiyacını hesapla', completed: false, estimatedDurationMinutes: 15 },
        { id: 'water_buy_advanced', text: 'Su filtreleri ve dezenfektan satın al', completed: false, estimatedDurationMinutes: 45 },
        { id: 'water_storage_system', text: 'Su depolama sistemi kur', completed: false, estimatedDurationMinutes: 120 },
        { id: 'water_rotation', text: 'Rotasyon sistemini kur', completed: false, estimatedDurationMinutes: 30 },
      ],
      neighbor_meeting: [
        { id: 'neighbor_list', text: 'Komşu listesi oluştur', completed: false, estimatedDurationMinutes: 20 },
        { id: 'neighbor_invite', text: 'Toplantı davetiyesi gönder', completed: false, estimatedDurationMinutes: 30 },
        { id: 'neighbor_organize', text: 'Toplantıyı organize et', completed: false, estimatedDurationMinutes: 60 },
        { id: 'neighbor_followup', text: 'Takip toplantıları planla', completed: false, estimatedDurationMinutes: 15 },
      ],
      child_school_coordination: [
        { id: 'school_contact', text: 'Okul yönetimi ile iletişim kur', completed: false, estimatedDurationMinutes: 30 },
        { id: 'school_plan', text: 'Okul acil durum planını öğren', completed: false, estimatedDurationMinutes: 45 },
        { id: 'school_practice', text: 'Okul tatbikatına katıl', completed: false, estimatedDurationMinutes: 60 },
        { id: 'school_alternative', text: 'Alternatif toplanma noktaları belirle', completed: false, estimatedDurationMinutes: 30 },
      ],
    };
    return subTasksMap[itemId] || [];
  }

  private getChecklistForItem(itemId: string): string[] {
    const checklistMap: Record<string, string[]> = {
      kit_first_aid: [
        'Yara bandı ve gazlı bez',
        'Antiseptik solüsyon',
        'Ağrı kesici ilaçlar',
        'Makas ve cımbız',
        'Termometre',
        'Elastik bandaj',
        'Steril eldiven',
        'Yanık kremi',
        'Göz yıkama solüsyonu',
        'İlk yardım kitabı',
      ],
      kit_documents: [
        'Kimlik kartı kopyası',
        'Pasaport kopyası',
        'Tapu fotokopisi',
        'Sigorta poliçeleri',
        'Sağlık kayıtları',
        'Banka kartı bilgileri',
        'Ehliyet kopyası',
        'Aşı kartı',
        'Doğum belgesi',
        'Evlilik cüzdanı',
      ],
      home_valves: [
        'Ana gaz vanası konumu',
        'Elektrik sigortası kutusu',
        'Su vanası konumu',
        'Vana kapatma yönü',
        'Acil durumda kapatma talimatı',
        'Vana anahtarı konumu',
        'Aile üyelerine gösterim',
      ],
      kit_water: [
        'Su şişeleri (kişi başı 3 litre x 3 gün)',
        'Su depolama kabı',
        'Su filtreleri',
        'Dezenfektan tabletleri',
        'Su etiketleme sistemi',
        'Rotasyon takvimi',
      ],
      kit_food: [
        'Konserve yiyecekler',
        'Enerji barları',
        'Kuruyemiş',
        'Konserve açacağı',
        'Tabak ve çatal',
        'Son kullanma tarihi kontrolü',
      ],
      vehicle_kit: [
        'Su ve yiyecek',
        'Battaniye',
        'İlk yardım çantası',
        'Yedek yakıt bidonu',
        'Çekme halatı',
        'Takoz',
        'Yedek lastik kontrolü',
      ],
      workplace_kit: [
        'Su',
        'Enerji barı',
        'İlk yardım malzemeleri',
        'El feneri',
        'Düdük',
        'Yedek piller',
      ],
      water_storage_advanced: [
        'Su stoklama kapları',
        'Su filtreleri',
        'Dezenfektan tabletleri',
        'Rotasyon sistemi',
        'Su kalitesi test kiti',
        'Depolama alanı hazırlığı',
      ],
      psycho_education: [
        'Stres yönetimi kaynakları',
        'Nefes teknikleri rehberi',
        'Gevşeme egzersizleri',
        'Psikolojik destek iletişim bilgileri',
        'Aile iletişim planı',
      ],
      neighbor_meeting: [
        'Komşu listesi',
        'Toplantı gündemi',
        'Yardım anlaşması taslağı',
        'İletişim kanalı kurulumu',
        'Takip planı',
      ],
      child_school_coordination: [
        'Okul acil durum planı',
        'Toplanma noktaları',
        'İletişim bilgileri',
        'Alternatif rotalar',
        'Çocuk kimlik bilgileri',
      ],
    };
    return checklistMap[itemId] || [];
  }

  private getEstimatedDuration(itemId: string): number {
    const durationMap: Record<string, number> = {
      kit_water: 60,
      kit_food: 90,
      kit_first_aid: 45,
      kit_power: 30,
      kit_documents: 120,
      comm_meeting: 60,
      comm_list: 30,
      comm_out_of_city: 20,
      comm_drill: 30,
      home_anchor: 180,
      home_valves: 15,
      home_extinguisher: 60,
      home_safezone: 45,
      response_duck: 30,
      response_evac: 60,
      response_bag: 15,
    };
    return durationMap[itemId] || 30;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getEstimatedCost(itemId: string, params: any): number {
    const familySize = params.familySize || 4;
    const costMap: Record<string, number> = {
      kit_water: familySize * 3 * 5, // 3 litre x 5 TL
      kit_food: familySize * 3 * 50, // 3 günlük x 50 TL
      kit_first_aid: 200,
      kit_power: 500,
      kit_documents: 50,
      home_anchor: 300,
      home_extinguisher: 400,
    };
    return costMap[itemId] || 0;
  }

  private getLocationForItem(itemId: string): string {
    const locationMap: Record<string, string> = {
      kit_water: 'Market',
      kit_food: 'Market',
      kit_first_aid: 'Eczane',
      kit_power: 'Elektronik mağaza',
      home_anchor: 'Ev',
      home_valves: 'Ev',
      comm_meeting: 'Mahalle',
    };
    return locationMap[itemId] || 'Ev';
  }

  private getItemCategory(itemId: string): string {
    if (itemId.startsWith('kit_')) return 'Malzeme';
    if (itemId.startsWith('comm_')) return 'İletişim';
    if (itemId.startsWith('home_')) return 'Güvenlik';
    if (itemId.startsWith('drill_')) return 'Eğitim';
    if (itemId.startsWith('response_')) return 'Acil Durum';
    if (itemId.startsWith('recovery_')) return 'İyileşme';
    return 'Genel';
  }

  private getTagsForItem(itemId: string): string[] {
    const tagsMap: Record<string, string[]> = {
      kit_water: ['kritik', 'su', 'stok'],
      kit_food: ['gıda', 'stok', 'konserve'],
      kit_first_aid: ['sağlık', 'kritik', 'ilaç'],
      home_anchor: ['güvenlik', 'sabitlik'],
      comm_meeting: ['iletişim', 'toplanma'],
    };
    return tagsMap[itemId] || [];
  }

  private getResourcesForItem(itemId: string): PlanResource[] {
    const resourcesMap: Record<string, PlanResource[]> = {
      kit_water: [
        {
          id: 'afad_water',
          type: 'website',
          title: 'AFAD Su Stoklama Rehberi',
          url: 'https://www.afad.gov.tr',
          description: 'AFAD resmi su stoklama önerileri',
        },
        {
          id: 'who_water',
          type: 'website',
          title: 'WHO Su Güvenliği Rehberi',
          url: 'https://www.who.int',
          description: 'Dünya Sağlık Örgütü su güvenliği önerileri',
        },
      ],
      comm_meeting: [
        {
          id: 'afad_assembly',
          type: 'app',
          title: 'AFAD Deprem Dede',
          description: 'Toplanma alanlarını bulmak için uygulama',
        },
        {
          id: 'afad_map',
          type: 'website',
          title: 'AFAD Toplanma Alanları Haritası',
          url: 'https://www.afad.gov.tr',
          description: 'Resmi toplanma alanları haritası',
        },
      ],
      home_valves: [
        {
          id: 'gas_valve_guide',
          type: 'video',
          title: 'Gaz Vana Kapatma Videosu',
          description: 'Güvenli gaz vanası kapatma talimatları',
        },
        {
          id: 'afad_safety',
          type: 'website',
          title: 'AFAD Ev Güvenliği Rehberi',
          url: 'https://www.afad.gov.tr',
          description: 'Ev güvenliği kontrol listesi',
        },
      ],
      kit_first_aid: [
        {
          id: 'kizilay_firstaid',
          type: 'website',
          title: 'Kızılay İlk Yardım Rehberi',
          url: 'https://www.kizilay.org.tr',
          description: 'Temel ilk yardım bilgileri',
        },
        {
          id: 'firstaid_course',
          type: 'website',
          title: 'İlk Yardım Kursları',
          url: 'https://www.kizilay.org.tr',
          description: 'Sertifikalı ilk yardım kursları',
        },
      ],
      psycho_education: [
        {
          id: 'afad_psycho',
          type: 'website',
          title: 'AFAD Psikososyal Destek',
          url: 'https://www.afad.gov.tr',
          description: 'Psikolojik destek rehberi',
        },
        {
          id: 'kizilay_psycho',
          type: 'website',
          title: 'Kızılay Psikolojik Destek Hattı',
          url: 'https://www.kizilay.org.tr',
          description: '7/24 psikolojik destek hattı',
        },
      ],
      vehicle_kit: [
        {
          id: 'afad_vehicle',
          type: 'website',
          title: 'AFAD Araç Hazırlık Rehberi',
          url: 'https://www.afad.gov.tr',
          description: 'Araç acil durum çantası rehberi',
        },
      ],
      workplace_evacuation: [
        {
          id: 'isg_evacuation',
          type: 'website',
          title: 'İSG Tahliye Planı Rehberi',
          url: 'https://www.csgb.gov.tr',
          description: 'İş sağlığı ve güvenliği tahliye planı',
        },
      ],
      water_storage_advanced: [
        {
          id: 'afad_water_advanced',
          type: 'website',
          title: 'AFAD Gelişmiş Su Stoklama',
          url: 'https://www.afad.gov.tr',
          description: 'Detaylı su stoklama rehberi',
        },
        {
          id: 'water_purification',
          type: 'video',
          title: 'Su Arıtma Yöntemleri',
          description: 'Acil durumda su arıtma teknikleri',
        },
      ],
      neighbor_meeting: [
        {
          id: 'afad_community',
          type: 'website',
          title: 'AFAD Topluluk Hazırlık',
          url: 'https://www.afad.gov.tr',
          description: 'Topluluk dayanışması rehberi',
        },
      ],
      child_school_coordination: [
        {
          id: 'meb_emergency',
          type: 'website',
          title: 'MEB Acil Durum Planı',
          url: 'https://www.meb.gov.tr',
          description: 'Okul acil durum planları',
        },
        {
          id: 'unicef_children',
          type: 'website',
          title: 'UNICEF Çocuk Güvenliği',
          url: 'https://www.unicef.org.tr',
          description: 'Çocuk güvenliği rehberi',
        },
      ],
    };
    return resourcesMap[itemId] || [];
  }

  private getDifficultyForItem(itemId: string): 'easy' | 'moderate' | 'challenging' {
    const difficultyMap: Record<string, 'easy' | 'moderate' | 'challenging'> = {
      kit_water: 'easy',
      kit_food: 'easy',
      kit_first_aid: 'easy',
      home_anchor: 'moderate',
      home_valves: 'easy',
      comm_meeting: 'easy',
      comm_drill: 'moderate',
    };
    return difficultyMap[itemId] || 'moderate';
  }

  private getSectionCategory(sectionId: string): PlanSection['category'] {
    const categoryMap: Record<string, PlanSection['category']> = {
      emergency_kit: 'supplies',
      communication: 'communication',
      drill_program: 'training',
      home_safety: 'safety',
      response_phase: 'safety',
      recovery_phase: 'recovery',
      children_care: 'special_needs',
      elderly_care: 'special_needs',
      pet_care: 'special_needs',
    };
    return categoryMap[sectionId] || 'safety';
  }

  private getSectionIcon(sectionId: string): string {
    const iconMap: Record<string, string> = {
      emergency_kit: 'bag',
      communication: 'call',
      drill_program: 'school',
      home_safety: 'home',
      response_phase: 'alert-circle',
      recovery_phase: 'medical',
      children_care: 'people',
      elderly_care: 'person',
      pet_care: 'paw',
    };
    return iconMap[sectionId] || 'checkmark-circle';
  }

  private getSectionColor(sectionId: string): string {
    const colorMap: Record<string, string> = {
      emergency_kit: '#3b82f6',
      communication: '#10b981',
      drill_program: '#f59e0b',
      home_safety: '#ef4444',
      response_phase: '#dc2626',
      recovery_phase: '#8b5cf6',
    };
    return colorMap[sectionId] || '#6b7280';
  }

  private getSectionCost(sectionId: string): 'free' | 'low' | 'medium' | 'high' {
    const costMap: Record<string, 'free' | 'low' | 'medium' | 'high'> = {
      emergency_kit: 'medium',
      communication: 'free',
      drill_program: 'free',
      home_safety: 'low',
      response_phase: 'free',
      recovery_phase: 'free',
    };
    return costMap[sectionId] || 'free';
  }

  private getSectionDifficulty(sectionId: string): 'easy' | 'moderate' | 'challenging' {
    const difficultyMap: Record<string, 'easy' | 'moderate' | 'challenging'> = {
      emergency_kit: 'easy',
      communication: 'easy',
      drill_program: 'moderate',
      home_safety: 'moderate',
      response_phase: 'easy',
      recovery_phase: 'easy',
    };
    return difficultyMap[sectionId] || 'moderate';
  }

  private buildTimeline(sections: PlanSection[], allItems: PlanItem[]): PlanTimeline {
    const now = Date.now();
    const phases: TimelinePhase[] = [
      {
        id: 'phase_1',
        name: 'Acil Hazırlık (İlk Hafta)',
        startDate: now,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        items: allItems
          .filter((item) => item.importance === 'critical' && item.dueDate && item.dueDate <= now + 7 * 24 * 60 * 60 * 1000)
          .map((item) => item.id),
        status: 'not_started',
      },
      {
        id: 'phase_2',
        name: 'Temel Hazırlık (İlk Ay)',
        startDate: now + 7 * 24 * 60 * 60 * 1000,
        endDate: now + 30 * 24 * 60 * 60 * 1000,
        items: allItems
          .filter((item) => item.importance === 'high' && item.dueDate && item.dueDate <= now + 30 * 24 * 60 * 60 * 1000)
          .map((item) => item.id),
        status: 'not_started',
      },
      {
        id: 'phase_3',
        name: 'Sürekli İyileştirme',
        startDate: now + 30 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.importance === 'medium' || item.importance === 'low').map((item) => item.id),
        status: 'not_started',
      },
    ];

    const milestones: TimelineMilestone[] = [
      {
        id: 'milestone_1',
        name: 'Acil Durum Çantası Hazır',
        targetDate: now + 7 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.id.startsWith('kit_')).map((item) => item.id),
        completed: false,
      },
      {
        id: 'milestone_2',
        name: 'İletişim Planı Tamamlandı',
        targetDate: now + 14 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.id.startsWith('comm_')).map((item) => item.id),
        completed: false,
      },
      {
        id: 'milestone_3',
        name: 'Ev Güvenliği Kontrolleri',
        targetDate: now + 30 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.id.startsWith('home_')).map((item) => item.id),
        completed: false,
      },
    ];

    const criticalPath = allItems
      .filter((item) => item.importance === 'critical')
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
      .map((item) => item.id);

    return { phases, milestones, criticalPath };
  }

  private buildMilestones(sections: PlanSection[], allItems: PlanItem[]): PlanMilestone[] {
    const now = Date.now();
    return [
      {
        id: 'milestone_emergency_kit',
        title: 'Acil Durum Çantası Tamamlandı',
        description: 'Tüm acil durum çantası maddeleri hazır ve kontrol edildi',
        targetDate: now + 7 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.id.startsWith('kit_')).map((item) => item.id),
        completed: false,
        reward: 'Acil durum çantası hazır rozeti',
      },
      {
        id: 'milestone_communication',
        title: 'İletişim Planı Hazır',
        description: 'Aile iletişim planı ve toplanma noktaları belirlendi',
        targetDate: now + 14 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.id.startsWith('comm_')).map((item) => item.id),
        completed: false,
        reward: 'İletişim planı tamamlandı rozeti',
      },
      {
        id: 'milestone_home_safety',
        title: 'Ev Güvenliği Kontrolleri',
        description: 'Tüm ev güvenlik önlemleri alındı',
        targetDate: now + 30 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.id.startsWith('home_')).map((item) => item.id),
        completed: false,
        reward: 'Ev güvenliği rozeti',
      },
      {
        id: 'milestone_first_drill',
        title: 'İlk Tatbikat Tamamlandı',
        description: 'Aile ile ilk deprem tatbikatı başarıyla gerçekleştirildi',
        targetDate: now + 21 * 24 * 60 * 60 * 1000,
        items: allItems.filter((item) => item.id.startsWith('drill_')).map((item) => item.id),
        completed: false,
        reward: 'Tatbikat rozeti',
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildEmergencyContacts(params: any): EmergencyContact[] {
    return [
      {
        id: 'contact_112',
        name: '112 Acil Çağrı',
        relationship: 'Acil Servis',
        phone: '112',
        isOutOfCity: false,
        priority: 'primary',
        notes: 'Acil durum çağrı merkezi',
      },
      {
        id: 'contact_afad',
        name: 'AFAD',
        relationship: 'Afet Yönetimi',
        phone: '122',
        isOutOfCity: false,
        priority: 'primary',
        notes: 'Afet ve Acil Durum Yönetimi Başkanlığı',
      },
      {
        id: 'contact_out_of_city',
        name: 'Şehir Dışı İletişim Kişisi',
        relationship: 'Aile Dışı İletişim',
        phone: 'Belirlenecek',
        isOutOfCity: true,
        priority: 'secondary',
        notes: 'Şehir dışından güvenilir iletişim kişisi',
      },
    ];
  }
}

export const preparednessPlanService = new PreparednessPlanService();

