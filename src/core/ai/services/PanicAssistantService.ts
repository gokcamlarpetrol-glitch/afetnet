/**
 * PANIC ASSISTANT SERVICE
 * Provides emergency actions during disasters
 * AI-powered with rule-based fallback
 */

import {
  PanicAssistantState,
  DisasterScenario,
  EmergencyAction,
  DisasterScenarioContext,
  ActionStep,
  VisualGuide,
  AudioInstruction,
} from '../types/ai.types';
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
    context?: EmergencyContext,
  ): Promise<EmergencyAction[]> {
    // OpenAI ile dinamik aksiyonlar
    try {
      if (openAIService.isConfigured() && context) {
        const aiActions = await this.getActionsWithAI(scenario, context);
        // AI aksiyonlarını detaylandır
        return this.enrichActions(aiActions, scenario, context);
      } else {
        logger.warn('OpenAI not configured or no context, using comprehensive rule-based fallback');
        return this.getActionsWithRules(scenario, context);
      }
    } catch (error) {
      logger.error('AI action generation failed, using comprehensive fallback:', error);
      return this.getActionsWithRules(scenario, context);
    }
  }

  /**
   * AI aksiyonlarını detaylandır ve zenginleştir
   */
  private enrichActions(
    actions: EmergencyAction[],
    scenario: DisasterScenario,
    context?: EmergencyContext,
  ): EmergencyAction[] {
    return actions.map((action) => {
      const enriched: EmergencyAction = {
        ...action,
        stepByStepGuide: this.getStepByStepGuide(action.id, scenario),
        visualGuide: this.getVisualGuide(action.id, scenario),
        audioInstructions: this.getAudioInstructions(action.id),
        warningLevel: this.getWarningLevel(action.id, context),
        timeCritical: this.isTimeCritical(action.id),
        dependsOn: this.getDependencies(action.id),
        location: this.getLocation(action.id),
        toolsNeeded: this.getToolsNeeded(action.id),
        safetyNotes: this.getSafetyNotes(action.id),
        commonMistakes: this.getCommonMistakes(action.id),
        successCriteria: this.getSuccessCriteria(action.id),
        estimatedRiskReduction: this.getRiskReduction(action.id),
        progress: action.completed ? 100 : 0,
      };
      return enriched;
    });
  }

  /**
   * AI ile duruma özel aksiyonlar oluştur
   */
  private async getActionsWithAI(
    scenario: DisasterScenario,
    context: EmergencyContext,
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
      "text": "Kısa, net aksiyon talimatı (max 50 karakter)",
      "priority": 1,
      "icon": "shield-checkmark",
      "phase": "before|during|after|check",
      "details": "Detaylı açıklama (2-3 cümle)",
      "checklist": ["Adım 1", "Adım 2", "Adım 3"],
      "expectedDurationMinutes": 2,
      "stepByStepGuide": [
        {
          "id": "step_1",
          "order": 1,
          "text": "Adım açıklaması",
          "critical": true,
          "estimatedSeconds": 5
        }
      ],
      "warningLevel": "info|warning|critical|emergency",
      "timeCritical": true,
      "location": "Nerede yapılacak",
      "toolsNeeded": ["Araç 1", "Araç 2"],
      "safetyNotes": ["Not 1", "Not 2"],
      "commonMistakes": ["Hata 1", "Hata 2"],
      "successCriteria": ["Kriter 1", "Kriter 2"],
      "estimatedRiskReduction": 80
    }
  ]
}

8-12 aksiyon döndür:
- Öncelik sırasına göre (1 en önemli)
- Kısa, net, anlaşılır (max 50 karakter)
- Hayat kurtarıcı, AFAD/UMKE standartlarına uygun
- Icon: shield-checkmark, warning, exit, medical, call, location, people, alert-circle, home, water, flashlight, bag, radio
- Phase: before (öncesi), during (sarsıntı anı), after (sonrası), check (kontroller)
- Details: 2-3 cümleyle kritik açıklama
- Checklist: 3-5 adım (opsiyonel)
- stepByStepGuide: Kritik aksiyonlar için adım adım rehber (3-5 adım)
- warningLevel: Kritiklik seviyesi (emergency > critical > warning > info)
- timeCritical: Dakikalar içinde yapılması gerekenler için true
- location: Nerede yapılacak (opsiyonel)
- toolsNeeded: Gerekli araçlar (opsiyonel)
- safetyNotes: Güvenlik notları (2-4 madde)
- commonMistakes: Yaygın hatalar (2-3 madde)
- successCriteria: Başarı kriterleri (2-4 madde)
- estimatedRiskReduction: Risk azaltma yüzdesi (0-100)

${context.magnitude && context.magnitude >= 5.0 ? 'ÖNEMLİ: Büyük deprem (≥5.0), kritik aksiyonlar ekle! Mahsur kalanlar, yıkıntılar, tsunami riski gibi konuları dahil et.' : ''}
${context.magnitude && context.magnitude >= 6.5 ? 'ÇOK KRİTİK: Çok büyük deprem (≥6.5), tsunami riski, yıkıntılar, mahsur kalanlar için özel aksiyonlar ekle!' : ''}`;

    const systemPrompt = `Sen bir AFAD ve UMKE acil durum uzmanısın. Afet anında insanlara hayat kurtarıcı, kısa, net talimatlar veriyorsun. 

TALİMATLAR:
- AFAD standartlarına uygun, Türkçe, anlaşılır ve hemen uygulanabilir olmalı
- Panik yaratmadan, sakin ve etkili yönlendirme yap
- Kritik aksiyonlar için adım adım rehber ver
- Güvenlik notları ve yaygın hataları belirt
- Risk azaltma potansiyelini değerlendir
- Sadece JSON formatında yanıt ver

DEPREM ÖNCELİKLERİ:
1. ÇÖK-KAPAN-TUTUN (en kritik, sarsıntı anı)
2. Gaz ve elektrik kapatma (sarsıntı sonrası)
3. Güvenli tahliye
4. Acil çağrı (112)
5. Toplanma alanına gitme
6. Yaralı kontrolü ve ilk yardım

Büyük depremlerde (≥5.0) mahsur kalanlar, yıkıntılar, tsunami riski gibi ek aksiyonlar ekle.`;

    // ELITE: Cost optimization - reduced maxTokens
    const aiResponse = await openAIService.generateText(prompt, {
      systemPrompt,
      maxTokens: 400, // Optimized: Reduced from 600 to save ~$0.00012 per call
      temperature: 0.5, // Daha tutarlı sonuçlar için düşük temperature
      serviceName: 'PanicAssistantService', // ELITE: For cost tracking
    });

    // JSON parse et
    const parsed = this.parseAIResponse(aiResponse);

    return parsed.actions.map((action: Record<string, unknown>) => ({
      id: (action.id as string) || String(Math.random()),
      text: (action.text as string) || 'Aksiyon',
      priority: typeof action.priority === 'number' ? action.priority : 1,
      icon: this.validateIcon(action.icon as string),
      phase: ['before', 'during', 'after', 'check'].includes(action.phase as string)
        ? action.phase as 'before' | 'during' | 'after' | 'check'
        : 'during',
      details: (action.details as string) || undefined,
      checklist: Array.isArray(action.checklist)
        ? (action.checklist as unknown[]).filter((item: unknown): item is string => typeof item === 'string').slice(0, 3)
        : undefined,
      expectedDurationMinutes: typeof action.expectedDurationMinutes === 'number'
        ? action.expectedDurationMinutes
        : undefined,
      completed: false,
    }));
  }

  /**
   * AI yanıtını parse et ve validate et
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseAIResponse(response: string): { actions: Record<string, unknown>[] } {
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
      parsed.actions = parsed.actions.map((action: Record<string, unknown>, idx: number) => ({
        id: (action.id as string) || String(idx + 1),
        text: (action.text as string) || 'Aksiyon',
        priority: typeof action.priority === 'number' ? action.priority : idx + 1,
        icon: this.validateIcon(action.icon as string),
        phase: ['before', 'during', 'after', 'check'].includes(action.phase as string)
          ? action.phase
          : 'during',
        details: (action.details as string) || undefined,
        checklist: Array.isArray(action.checklist)
          ? (action.checklist as unknown[]).filter((item: unknown): item is string => typeof item === 'string').slice(0, 3)
          : undefined,
        expectedDurationMinutes: typeof action.expectedDurationMinutes === 'number'
          ? action.expectedDurationMinutes
          : undefined,
      }));

      // Priority'ye göre sırala
      parsed.actions.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.priority as number) - (b.priority as number));

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
      'home', 'water', 'flashlight',
    ];

    return validIcons.includes(icon) ? icon : 'shield-checkmark';
  }

  /**
   * Kural tabanlı kapsamlı fallback aksiyonlar
   */
  private getActionsWithRules(
    scenario: DisasterScenario,
    context?: EmergencyContext,
  ): EmergencyAction[] {
    if (scenario === 'earthquake') {
      const baseActions: EmergencyAction[] = [
        {
          id: '1',
          text: 'ÇÖK - KAPAN - TUTUN',
          priority: 1,
          completed: false,
          icon: 'shield-checkmark',
          phase: 'during',
          details: 'Sarsıntı sırasında kendinizi sağlam bir yapının yanına konumlandırarak başınızı koruyun. Yaşam üçgeni oluşturun.',
          checklist: [
            'Yere çökün',
            'Sağlam bir mobilyanın yanına geçin',
            'Başınızı ve boynunuzu koruyun',
            'Tutunacak bir şey bulun',
            'Pencerelerden uzak durun',
          ],
          expectedDurationMinutes: 1,
          warningLevel: 'emergency',
          timeCritical: true,
          location: 'İç mekan - güvenli alan',
          stepByStepGuide: [
            {
              id: 'step_1_1',
              order: 1,
              text: 'Hemen yere çökün',
              completed: false,
              critical: true,
              estimatedSeconds: 2,
              visualCue: 'Diz çökme pozisyonu',
            },
            {
              id: 'step_1_2',
              order: 2,
              text: 'Sağlam bir mobilyanın yanına geçin (masa, koltuk, yatak)',
              completed: false,
              critical: true,
              estimatedSeconds: 3,
              visualCue: 'Mobilya yanı pozisyonu',
            },
            {
              id: 'step_1_3',
              order: 3,
              text: 'Başınızı ve boynunuzu kollarınızla koruyun',
              completed: false,
              critical: true,
              estimatedSeconds: 2,
              visualCue: 'Baş koruma pozisyonu',
            },
            {
              id: 'step_1_4',
              order: 4,
              text: 'Mobilyaya sıkıca tutunun',
              completed: false,
              critical: true,
              estimatedSeconds: 1,
            },
          ],
          safetyNotes: [
            'Asansör kullanmayın',
            'Merdivenlerden uzak durun',
            'Dışarı çıkmaya çalışmayın',
            'Kapı eşiklerinde durmayın (eski bilgi)',
          ],
          commonMistakes: [
            'Kapı eşiğinde durmak (eski ve yanlış bilgi)',
            'Dışarı çıkmaya çalışmak',
            'Asansör kullanmak',
            'Pencereye yakın durmak',
          ],
          successCriteria: [
            'Yere çöktünüz',
            'Sağlam bir yapının yanındasınız',
            'Baş ve boyun korunuyor',
            'Sarsıntı bitene kadar bu pozisyondasınız',
          ],
          estimatedRiskReduction: 80,
        },
        {
          id: '2',
          text: 'Pencere ve aynalardan uzak dur',
          priority: 2,
          completed: false,
          icon: 'warning',
          phase: 'during',
          details: 'Camların kırılması ciddi yaralanmalara yol açabilir, iç duvarlara doğru yönelin.',
          warningLevel: 'critical',
          timeCritical: true,
          location: 'İç mekan',
          safetyNotes: [
            'Kırık cam parçaları ölümcül olabilir',
            'İç duvarlar daha güvenlidir',
            'Ağır eşyalardan uzak durun',
          ],
          estimatedRiskReduction: 60,
        },
        {
          id: '3',
          text: 'Başını ve boynunu koru',
          priority: 3,
          completed: false,
          icon: 'medical',
          phase: 'during',
          details: 'Sarsıntı sırasında düşen cisimlere karşı en hayati bölgeleri koruyun. Kollarınızı başınızın üzerine koyun.',
          warningLevel: 'critical',
          timeCritical: true,
          stepByStepGuide: [
            {
              id: 'step_3_1',
              order: 1,
              text: 'Kollarınızı başınızın üzerine kaldırın',
              completed: false,
              critical: true,
              estimatedSeconds: 1,
            },
            {
              id: 'step_3_2',
              order: 2,
              text: 'Ellerinizi başınızın arkasında birleştirin',
              completed: false,
              critical: true,
              estimatedSeconds: 1,
            },
            {
              id: 'step_3_3',
              order: 3,
              text: 'Boynunuzu korumak için çenenizi göğsünüze yaklaştırın',
              completed: false,
              critical: true,
              estimatedSeconds: 1,
            },
          ],
          estimatedRiskReduction: 70,
        },
        {
          id: '4',
          text: 'Sarsıntı bitene kadar bekle',
          priority: 4,
          completed: false,
          icon: 'alert-circle',
          phase: 'during',
          details: 'Ani hareket etmeyin, sarsıntı geçmeden tahliye etmeyin. Artçı sarsıntılar olabilir.',
          warningLevel: 'warning',
          safetyNotes: [
            'Ana sarsıntıdan sonra artçılar olabilir',
            'En az 1 dakika bekleyin',
            'Sarsıntı tamamen bitene kadar hareket etmeyin',
          ],
          estimatedRiskReduction: 50,
        },
        {
          id: '5',
          text: 'Gaz vanasını kapat',
          priority: 5,
          completed: false,
          icon: 'warning',
          phase: 'after',
          details: 'Sarsıntı bittikten sonra gaz kaçağı riskine karşı ana gaz vanasını kapatın.',
          warningLevel: 'critical',
          timeCritical: true,
          location: 'Bina dışı - gaz vanası',
          toolsNeeded: ['Gaz anahtarı veya pense'],
          stepByStepGuide: [
            {
              id: 'step_5_1',
              order: 1,
              text: 'Gaz vanası konumunu hatırlayın',
              completed: false,
              critical: true,
              estimatedSeconds: 5,
            },
            {
              id: 'step_5_2',
              order: 2,
              text: 'Gaz kokusu varsa kibrit/çakmak kullanmayın',
              completed: false,
              critical: true,
              estimatedSeconds: 2,
            },
            {
              id: 'step_5_3',
              order: 3,
              text: 'Ana gaz vanasını saat yönünde kapatın',
              completed: false,
              critical: true,
              estimatedSeconds: 10,
            },
            {
              id: 'step_5_4',
              order: 4,
              text: 'Vananın kapalı olduğundan emin olun',
              completed: false,
              critical: true,
              estimatedSeconds: 3,
            },
          ],
          checklist: [
            'Gaz kokusu kontrolü yapın',
            'Ana gaz vanası konumunu bulun',
            'Vana anahtarı veya pense hazırlayın',
            'Vana saat yönünde kapatın',
            'Kapatıldığını doğrulayın',
          ],
          safetyNotes: [
            'Gaz kokusu varsa elektrik düğmelerine dokunmayın',
            'Kibrit/çakmak kullanmayın',
            'Pencere ve kapıları açın',
            'Açık alevden uzak durun',
          ],
          commonMistakes: [
            'Gaz kokusu varken elektrik kullanmak',
            'Yanlış yönde çevirmek',
            'Vananın açık kaldığını kontrol etmemek',
          ],
          estimatedRiskReduction: 85,
        },
        {
          id: '6',
          text: 'Elektrik sigortasını kapat',
          priority: 6,
          completed: false,
          icon: 'flashlight',
          phase: 'after',
          details: 'Elektrik kaçağı riskine karşı ana sigortayı kapatın.',
          warningLevel: 'warning',
          location: 'Sigorta kutusu',
          toolsNeeded: ['Sigorta anahtarı veya yalıtımlı pense'],
          stepByStepGuide: [
            {
              id: 'step_6_1',
              order: 1,
              text: 'Sigorta kutusunu bulun',
              completed: false,
              critical: true,
              estimatedSeconds: 10,
            },
            {
              id: 'step_6_2',
              order: 2,
              text: 'Ana sigortayı kapatın',
              completed: false,
              critical: true,
              estimatedSeconds: 5,
            },
          ],
          safetyNotes: [
            'Islak ellerle dokunmayın',
            'Yalıtımlı araçlar kullanın',
            'Su ile temas varsa önce sigortayı kapatın',
          ],
          estimatedRiskReduction: 70,
        },
        {
          id: '7',
          text: 'Sarsıntı bittikten sonra dışarı çık',
          priority: 7,
          completed: false,
          icon: 'exit',
          phase: 'after',
          details: 'Asansör kullanmayın, merdivenleri kontrollü şekilde kullanın. Ayakkabı giyin.',
          warningLevel: 'warning',
          checklist: [
            'Ayakkabı giyin (kırık cam riski)',
            'Asansör kullanmayın',
            'Merdivenleri kontrol edin',
            'Yavaş ve dikkatli ilerleyin',
            'Çıkış yolunu kontrol edin',
          ],
          stepByStepGuide: [
            {
              id: 'step_7_1',
              order: 1,
              text: 'Ayakkabı giyin (kırık cam ve enkaz riski)',
              completed: false,
              critical: true,
              estimatedSeconds: 10,
            },
            {
              id: 'step_7_2',
              order: 2,
              text: 'Çıkış yolunu gözlemleyin',
              completed: false,
              critical: true,
              estimatedSeconds: 5,
            },
            {
              id: 'step_7_3',
              order: 3,
              text: 'Merdivenleri kullanın (asansör değil)',
              completed: false,
              critical: true,
              estimatedSeconds: 30,
            },
            {
              id: 'step_7_4',
              order: 4,
              text: 'Dışarı çıktıktan sonra binadan uzaklaşın',
              completed: false,
              critical: true,
              estimatedSeconds: 60,
            },
          ],
          safetyNotes: [
            'Asansör kesinlikle kullanmayın',
            'Merdivenler hasarlı olabilir',
            'Bina dışına çıktıktan sonra uzaklaşın',
            'Düşen cisimlere dikkat edin',
          ],
          commonMistakes: [
            'Asansör kullanmak',
            'Ayakkabısız çıkmak',
            'Acele etmek',
            'Bina yakınında durmak',
          ],
          estimatedRiskReduction: 75,
        },
        {
          id: '8',
          text: 'Acil çantanı al',
          priority: 8,
          completed: false,
          icon: 'bag',
          phase: 'after',
          details: 'Önceden hazırladığınız acil durum çantasını yanınıza alın.',
          warningLevel: 'warning',
          location: 'Ev - acil çanta konumu',
          checklist: [
            'Acil çanta konumunu hatırlayın',
            'Çantayı kontrol edin',
            'Yanınıza alın',
            'Eksik varsa temel ihtiyaçları ekleyin',
          ],
          estimatedRiskReduction: 40,
        },
        {
          id: '9',
          text: 'Toplanma alanına git',
          priority: 9,
          completed: false,
          icon: 'location',
          phase: 'after',
          details: 'Önceden belirlenen toplanma alanına giderek aile bireyleriyle buluşun.',
          warningLevel: 'warning',
          location: 'Toplanma alanı',
          checklist: [
            'Toplanma alanı konumunu hatırlayın',
            'En güvenli rotayı seçin',
            'Aile üyeleriyle buluşun',
            'Durumu değerlendirin',
          ],
          stepByStepGuide: [
            {
              id: 'step_9_1',
              order: 1,
              text: 'Toplanma alanı konumunu hatırlayın',
              completed: false,
              critical: true,
              estimatedSeconds: 5,
            },
            {
              id: 'step_9_2',
              order: 2,
              text: 'En güvenli rotayı belirleyin',
              completed: false,
              critical: true,
              estimatedSeconds: 10,
            },
            {
              id: 'step_9_3',
              order: 3,
              text: 'Toplanma alanına gidin',
              completed: false,
              critical: true,
              estimatedSeconds: 300,
            },
            {
              id: 'step_9_4',
              order: 4,
              text: 'Aile üyeleriyle buluşun',
              completed: false,
              critical: true,
              estimatedSeconds: 60,
            },
          ],
          safetyNotes: [
            'Hasarlı binalardan uzak durun',
            'Düşen elektrik tellerinden uzak durun',
            'Yıkıntılara dikkat edin',
            'Alternatif rotalar belirleyin',
          ],
          estimatedRiskReduction: 60,
        },
        {
          id: '10',
          text: '112\'yi ara, yardım iste',
          priority: 10,
          completed: false,
          icon: 'call',
          phase: 'after',
          details: 'Yaralı veya mahsur kalanlar için 112 Acil Çağrı Merkezi ile iletişime geçin.',
          warningLevel: 'critical',
          emergencyNumber: '112',
          location: 'Güvenli alan',
          checklist: [
            '112\'yi arayın',
            'Durumu net açıklayın',
            'Konumunuzu paylaşın',
            'Yaralı sayısını bildirin',
            'İhtiyaçları belirtin',
          ],
          stepByStepGuide: [
            {
              id: 'step_10_1',
              order: 1,
              text: '112\'yi arayın',
              completed: false,
              critical: true,
              estimatedSeconds: 10,
            },
            {
              id: 'step_10_2',
              order: 2,
              text: 'Sakin ve net konuşun',
              completed: false,
              critical: true,
              estimatedSeconds: 30,
            },
            {
              id: 'step_10_3',
              order: 3,
              text: 'Konumunuzu tam olarak verin',
              completed: false,
              critical: true,
              estimatedSeconds: 20,
            },
            {
              id: 'step_10_4',
              order: 4,
              text: 'Yaralı sayısı ve durumu bildirin',
              completed: false,
              critical: true,
              estimatedSeconds: 30,
            },
          ],
          safetyNotes: [
            'Sakin kalın',
            'Net ve kısa konuşun',
            'Konum bilgisini doğru verin',
            'Telefonu meşgul etmeyin',
          ],
          commonMistakes: [
            'Panik yapmak',
            'Gereksiz detay vermek',
            'Konum bilgisini yanlış vermek',
            'Çok uzun konuşmak',
          ],
          estimatedRiskReduction: 90,
        },
        {
          id: '11',
          text: 'Yaralıları kontrol et',
          priority: 11,
          completed: false,
          icon: 'medical',
          phase: 'after',
          details: 'Çevrenizdeki yaralıları kontrol edin, ilk yardım yapın.',
          warningLevel: 'warning',
          location: 'Yakın çevre',
          checklist: [
            'Yaralıları tespit edin',
            'Bilinç kontrolü yapın',
            'Solunum kontrolü yapın',
            'Kanama kontrolü yapın',
            'İlk yardım uygulayın',
          ],
          stepByStepGuide: [
            {
              id: 'step_11_1',
              order: 1,
              text: 'Güvenli bir şekilde yaklaşın',
              completed: false,
              critical: true,
              estimatedSeconds: 10,
            },
            {
              id: 'step_11_2',
              order: 2,
              text: 'Bilinç kontrolü yapın',
              completed: false,
              critical: true,
              estimatedSeconds: 5,
            },
            {
              id: 'step_11_3',
              order: 3,
              text: 'Solunum kontrolü yapın',
              completed: false,
              critical: true,
              estimatedSeconds: 5,
            },
            {
              id: 'step_11_4',
              order: 4,
              text: 'Kanama varsa basınç uygulayın',
              completed: false,
              critical: true,
              estimatedSeconds: 30,
            },
          ],
          safetyNotes: [
            'Kendinizi riske atmayın',
            'Güvenli bir pozisyonda yaklaşın',
            'Boyun yaralanması şüphesi varsa hareket ettirmeyin',
            '112\'yi bilgilendirin',
          ],
          estimatedRiskReduction: 85,
        },
        {
          id: '12',
          text: 'Aile üyeleriyle iletişim kur',
          priority: 12,
          completed: false,
          icon: 'people',
          phase: 'after',
          details: 'Aile üyelerinin durumunu kontrol edin, iletişim kurun.',
          warningLevel: 'warning',
          checklist: [
            'Aile üyelerini arayın',
            'Durumlarını öğrenin',
            'Buluşma noktasını hatırlatın',
            'Güvenli olduklarından emin olun',
          ],
          estimatedRiskReduction: 50,
        },
        {
          id: '13',
          text: 'Artçı sarsıntılara hazır ol',
          priority: 13,
          completed: false,
          icon: 'alert-circle',
          phase: 'after',
          details: 'Ana sarsıntıdan sonra artçı sarsıntılar olabilir. Hazırlıklı olun.',
          warningLevel: 'warning',
          checklist: [
            'Açık alanda kalın',
            'Hasarlı binalardan uzak durun',
            'Çök-kapan-tutun pozisyonunu hatırlayın',
            'Artçı uyarılarını takip edin',
          ],
          safetyNotes: [
            'Artçılar ana sarsıntıdan sonra saatlerce sürebilir',
            'Hasarlı binalara girmeyin',
            'Açık alanda kalın',
            'Çök-kapan-tutun tekrar uygulanabilir',
          ],
          estimatedRiskReduction: 55,
        },
        {
          id: '14',
          text: 'Su ve yiyecek stoğunu kontrol et',
          priority: 14,
          completed: false,
          icon: 'water',
          phase: 'after',
          details: 'Acil durum çantanızdaki su ve yiyecek stoğunu kontrol edin.',
          warningLevel: 'info',
          location: 'Acil çanta',
          checklist: [
            'Su stoğunu kontrol edin',
            'Yiyecek stoğunu kontrol edin',
            'Eksikleri belirleyin',
            'Stokları paylaşın',
          ],
          estimatedRiskReduction: 30,
        },
        {
          id: '15',
          text: 'Haberleri takip et',
          priority: 15,
          completed: false,
          icon: 'radio',
          phase: 'after',
          details: 'Pilli radyo veya telefon ile resmi haberleri takip edin.',
          warningLevel: 'info',
          toolsNeeded: ['Pilli radyo', 'Powerbank', 'Telefon'],
          checklist: [
            'Pilli radyo açın',
            'Resmi haber kaynaklarını takip edin',
            'Sosyal medya söylentilerine dikkat edin',
            'AFAD açıklamalarını dinleyin',
          ],
          estimatedRiskReduction: 25,
        },
      ];

      // Büyük deprem için ek kritik aksiyonlar
      if (context?.magnitude && context.magnitude >= 5.0) {
        baseActions.push({
          id: '16',
          text: 'Mahsur kalanları tespit et',
          priority: 16,
          completed: false,
          icon: 'people',
          phase: 'after',
          details: 'Çevrenizde mahsur kalanları tespit edin ve 112\'ye bildirin.',
          warningLevel: 'critical',
          checklist: [
            'Çevreyi gözlemleyin',
            'Ses dinleyin',
            'Mahsur kalanları tespit edin',
            '112\'ye konum bildirin',
            'Kurtarma ekiplerini yönlendirin',
          ],
          estimatedRiskReduction: 95,
        });

        baseActions.push({
          id: '17',
          text: 'Yıkıntılardan uzak dur',
          priority: 17,
          completed: false,
          icon: 'warning',
          phase: 'after',
          details: 'Yıkıntıların üzerine çıkmayın, düşme riski vardır.',
          warningLevel: 'critical',
          safetyNotes: [
            'Yıkıntıların üzerine çıkmayın',
            'Düşen cisimlere dikkat edin',
            'Kurtarma ekiplerini bekleyin',
            'Güvenli mesafede durun',
          ],
          estimatedRiskReduction: 80,
        });
      }

      // Çok büyük deprem için ek aksiyonlar
      if (context?.magnitude && context.magnitude >= 6.5) {
        baseActions.push({
          id: '18',
          text: 'Tsunami riski kontrolü',
          priority: 18,
          completed: false,
          icon: 'water',
          phase: 'after',
          details: 'Sahil bölgelerinde tsunami riski olabilir, yüksek yerlere çıkın.',
          warningLevel: 'critical',
          timeCritical: true,
          location: 'Sahil bölgeleri',
          checklist: [
            'Deniz seviyesinden uzaklaşın',
            'Yüksek yerlere çıkın',
            'Tsunami uyarılarını takip edin',
            'En az 30 metre yüksekliğe çıkın',
          ],
          safetyNotes: [
            'Tsunami ilk dalgadan sonra da gelebilir',
            'Denizden uzaklaşın',
            'Yüksek binalara çıkın',
            'Araçla kaçmayın',
          ],
          estimatedRiskReduction: 90,
        });
      }

      // Tüm aksiyonları detaylandır
      return this.enrichActions(baseActions, scenario, context);
    }

    // Diğer senaryolar için kapsamlı aksiyonlar
    if (scenario === 'fire') {
      return this.getFireActions(context);
    }

    if (scenario === 'flood') {
      return this.getFloodActions(context);
    }

    if (scenario === 'trapped') {
      return this.getTrappedActions(context);
    }

    // Varsayılan
    return [
      {
        id: '1',
        text: 'Sakin kal, panik yapma',
        priority: 1,
        completed: false,
        icon: 'shield-checkmark',
        phase: 'before',
        details: 'Derin nefes alın, çevrenizdekilere güven verin.',
        warningLevel: 'info',
        estimatedRiskReduction: 20,
      },
      {
        id: '2',
        text: 'Güvenli alana git',
        priority: 2,
        completed: false,
        icon: 'exit',
        phase: 'during',
        warningLevel: 'critical',
        timeCritical: true,
        estimatedRiskReduction: 70,
      },
      {
        id: '3',
        text: '112\'yi ara',
        priority: 3,
        completed: false,
        icon: 'call',
        phase: 'after',
        details: 'Olay hakkında net bilgi verin, adresinizi paylaşın.',
        emergencyNumber: '112',
        warningLevel: 'critical',
        estimatedRiskReduction: 85,
      },
    ];
  }

  /**
   * Yangın senaryosu için aksiyonlar
   */
  private getFireActions(context?: EmergencyContext): EmergencyAction[] {
    return [
      {
        id: 'fire_1',
        text: 'YANGIN VARSA DIŞARI ÇIK',
        priority: 1,
        completed: false,
        icon: 'exit',
        phase: 'during',
        details: 'Yangın varsa hemen binayı terk edin, asansör kullanmayın.',
        warningLevel: 'emergency',
        timeCritical: true,
        stepByStepGuide: [
          {
            id: 'fire_step_1',
            order: 1,
            text: 'Yangın alarmını dinleyin',
            completed: false,
            critical: true,
            estimatedSeconds: 5,
          },
          {
            id: 'fire_step_2',
            order: 2,
            text: 'Kapıyı kontrol edin (sıcaklık)',
            completed: false,
            critical: true,
            estimatedSeconds: 3,
          },
          {
            id: 'fire_step_3',
            order: 3,
            text: 'Kapı sıcaksa alternatif yol bulun',
            completed: false,
            critical: true,
            estimatedSeconds: 10,
          },
          {
            id: 'fire_step_4',
            order: 4,
            text: 'Yere yakın ilerleyin (duman yukarıda)',
            completed: false,
            critical: true,
            estimatedSeconds: 30,
          },
        ],
        safetyNotes: [
          'Asansör kullanmayın',
          'Duman yukarıda, yere yakın ilerleyin',
          'Kapı sıcaksa açmayın',
          'Pencereye yakın durmayın',
        ],
        estimatedRiskReduction: 90,
      },
      {
        id: 'fire_2',
        text: '110 İtfaiye\'yi ara',
        priority: 2,
        completed: false,
        icon: 'call',
        phase: 'during',
        emergencyNumber: '110',
        warningLevel: 'critical',
        timeCritical: true,
        estimatedRiskReduction: 95,
      },
    ];
  }

  /**
   * Sel senaryosu için aksiyonlar
   */
  private getFloodActions(context?: EmergencyContext): EmergencyAction[] {
    return [
      {
        id: 'flood_1',
        text: 'YÜKSEK YERE ÇIK',
        priority: 1,
        completed: false,
        icon: 'exit',
        phase: 'during',
        details: 'Sel suyundan yüksek yerlere çıkın, araçla kaçmayın.',
        warningLevel: 'emergency',
        timeCritical: true,
        safetyNotes: [
          'Araçla kaçmayın',
          'Yüksek binalara çıkın',
          'Su akışına karşı yürümeyin',
          'Elektrik tellerinden uzak durun',
        ],
        estimatedRiskReduction: 85,
      },
    ];
  }

  /**
   * Mahsur kalma senaryosu için aksiyonlar
   */
  private getTrappedActions(context?: EmergencyContext): EmergencyAction[] {
    return [
      {
        id: 'trapped_1',
        text: 'SES ÇIKAR, YARDIM ÇAĞIR',
        priority: 1,
        completed: false,
        icon: 'call',
        phase: 'during',
        details: 'Düzenli aralıklarla ses çıkarın, kurtarma ekiplerinin sizi bulmasını sağlayın.',
        warningLevel: 'critical',
        stepByStepGuide: [
          {
            id: 'trapped_step_1',
            order: 1,
            text: 'Her 5 dakikada bir ses çıkarın',
            completed: false,
            critical: true,
            estimatedSeconds: 10,
          },
          {
            id: 'trapped_step_2',
            order: 2,
            text: 'Düzenli ritim kullanın (3 vuruş)',
            completed: false,
            critical: true,
            estimatedSeconds: 5,
          },
          {
            id: 'trapped_step_3',
            order: 3,
            text: 'Enerjinizi koruyun',
            completed: false,
            critical: true,
          },
        ],
        estimatedRiskReduction: 75,
      },
    ];
  }

  // Helper metodlar
  private getStepByStepGuide(actionId: string, scenario: DisasterScenario): ActionStep[] {
    // Bazı aksiyonlar için zaten stepByStepGuide var, diğerleri için boş döndür
    return [];
  }

  private getVisualGuide(actionId: string, scenario: DisasterScenario): VisualGuide | undefined {
    const guides: Record<string, VisualGuide> = {
      '1': {
        type: 'illustration',
        description: 'Çök-kapan-tutun pozisyonu: Yere çökün, sağlam mobilyanın yanına geçin, baş ve boynunuzu koruyun.',
        annotations: [
          { id: 'ann_1', x: 50, y: 30, text: 'Baş koruması', color: '#ef4444' },
          { id: 'ann_2', x: 50, y: 60, text: 'Sağlam mobilya', color: '#3b82f6' },
        ],
      },
    };
    return guides[actionId];
  }

  private getAudioInstructions(actionId: string): AudioInstruction | undefined {
    if (actionId === '1') {
      return {
        text: 'Çök, kapan, tutun. Yere çökün, sağlam bir mobilyanın yanına geçin, baş ve boynunuzu koruyun.',
        language: 'tr',
        durationSeconds: 8,
      };
    }
    return undefined;
  }

  private getWarningLevel(actionId: string, context?: EmergencyContext): 'info' | 'warning' | 'critical' | 'emergency' {
    const criticalActions = ['1', '5', '10', '16', '17', '18'];
    if (criticalActions.includes(actionId)) return 'critical';
    if (actionId === '1' && context?.magnitude && context.magnitude >= 6.0) return 'emergency';
    return 'warning';
  }

  private isTimeCritical(actionId: string): boolean {
    const timeCriticalActions = ['1', '2', '3', '5', '10', '18'];
    return timeCriticalActions.includes(actionId);
  }

  private getDependencies(actionId: string): string[] {
    const dependencies: Record<string, string[]> = {
      '7': ['5', '6'], // Dışarı çıkmak için gaz ve elektrik kapatılmalı
      '9': ['7'], // Toplanma alanına gitmek için dışarı çıkmış olmalı
      '10': ['7'], // 112 aramak için güvenli alanda olmalı
    };
    return dependencies[actionId] || [];
  }

  private getLocation(actionId: string): string | undefined {
    const locations: Record<string, string> = {
      '1': 'İç mekan - güvenli alan',
      '5': 'Bina dışı - gaz vanası',
      '6': 'Sigorta kutusu',
      '7': 'Bina çıkışı',
      '8': 'Ev - acil çanta konumu',
      '9': 'Toplanma alanı',
      '10': 'Güvenli alan',
      '11': 'Yakın çevre',
    };
    return locations[actionId];
  }

  private getToolsNeeded(actionId: string): string[] | undefined {
    const tools: Record<string, string[]> = {
      '5': ['Gaz anahtarı veya pense'],
      '6': ['Sigorta anahtarı veya yalıtımlı pense'],
      '15': ['Pilli radyo', 'Powerbank', 'Telefon'],
    };
    return tools[actionId];
  }

  private getSafetyNotes(actionId: string): string[] | undefined {
    // Zaten bazı aksiyonlarda var, diğerleri için boş
    return undefined;
  }

  private getCommonMistakes(actionId: string): string[] | undefined {
    // Zaten bazı aksiyonlarda var, diğerleri için boş
    return undefined;
  }

  private getSuccessCriteria(actionId: string): string[] | undefined {
    // Zaten bazı aksiyonlarda var, diğerleri için boş
    return undefined;
  }

  private getRiskReduction(actionId: string): number {
    const riskReductions: Record<string, number> = {
      '1': 80,
      '2': 60,
      '3': 70,
      '4': 50,
      '5': 85,
      '6': 70,
      '7': 75,
      '8': 40,
      '9': 60,
      '10': 90,
      '11': 85,
      '12': 50,
      '13': 55,
      '14': 30,
      '15': 25,
      '16': 95,
      '17': 80,
      '18': 90,
    };
    return riskReductions[actionId] || 50;
  }
}

export const panicAssistantService = new PanicAssistantService();

