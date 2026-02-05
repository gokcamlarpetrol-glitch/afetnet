/**
 * FIRST AID GUIDE SERVICE - ELITE EDITION
 * 
 * Offline ilk yardım rehberi - Hayat kurtaran bilgiler
 * 
 * Features:
 * - Deprem yaralanmaları için özel rehber
 * - Offline tam içerik
 * - Adım adım talimatlar
 * - Görsel destekli
 * - Acil duruma göre filtreleme
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('FirstAidGuideService');

export interface FirstAidGuide {
    id: string;
    title: string;
    category: 'trauma' | 'bleeding' | 'fracture' | 'shock' | 'burn' | 'crush' | 'cpr' | 'other';
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedTime: string;
    steps: {
        order: number;
        instruction: string;
        warning?: string;
        tip?: string;
    }[];
    doNot: string[];
    equipment: string[];
    emergencyOnly: boolean;
}

// ELITE: Comprehensive earthquake-specific first aid guides
const FIRST_AID_GUIDES: FirstAidGuide[] = [
    // CPR - Hayati
    {
        id: 'cpr_adult',
        title: 'Yetişkin CPR (Kalp Masajı)',
        category: 'cpr',
        priority: 'critical',
        estimatedTime: 'Sürekli',
        steps: [
            { order: 1, instruction: 'Güvenliği kontrol edin - çevre güvenli mi?', warning: 'Artçı deprem olabilir!' },
            { order: 2, instruction: 'Bilinç kontrolü yapın: Omuzlarından sarsın ve "İyi misiniz?" diye sorun' },
            { order: 3, instruction: 'Nefes kontrolü: Göğsün hareket ettiğini izleyin (10 saniye)' },
            { order: 4, instruction: 'Nefes yoksa 112\'yi arayın veya birine aratın' },
            { order: 5, instruction: 'Sert zemine sırtüstü yatırın' },
            { order: 6, instruction: 'Göğüs kafesinin ortasına (iki meme arası) el topuğunuzu yerleştirin' },
            { order: 7, instruction: 'Diğer elinizi üstüne koyun, parmaklarınızı kenetleyin' },
            { order: 8, instruction: 'Kollarınız düz, omuzlar ellerin üstünde olsun' },
            { order: 9, instruction: 'En az 5 cm derinlikte, dakikada 100-120 baskı yapın', tip: 'Tempolu: "Stayin\' Alive" şarkısı hızında' },
            { order: 10, instruction: 'Sağlık ekibi gelene kadar devam edin', warning: 'Yorulursanız başkasıyla değişin' },
        ],
        doNot: [
            'Nefes varsa CPR başlatmayın',
            'Baskı yaparken elleri kaldırmayın',
            'Baskılar arasında dinlenmeyin',
        ],
        equipment: ['Sert zemin'],
        emergencyOnly: true,
    },

    // Ciddi Kanama
    {
        id: 'severe_bleeding',
        title: 'Ciddi Kanama Kontrolü',
        category: 'bleeding',
        priority: 'critical',
        estimatedTime: '2-5 dakika',
        steps: [
            { order: 1, instruction: 'Eldiven giyin (yoksa poşet kullanın)', tip: 'Enfeksiyondan korunun' },
            { order: 2, instruction: 'Yarayı temiz bezle sıkıca bastırın' },
            { order: 3, instruction: 'Yaraya doğrudan 10-15 dakika basınç uygulayın', warning: 'Bezi kaldırıp bakmayın!' },
            { order: 4, instruction: 'Mümkünse yaralı bölgeyi kalp seviyesinin üzerine kaldırın' },
            { order: 5, instruction: 'Kan sızıyorsa üstüne ikinci bez ekleyin, ilkini kaldırmayın' },
            { order: 6, instruction: 'Kanama durmuyorsa turnike uygulayın (kol/bacak için)' },
            { order: 7, instruction: 'Turnikeyi yaranın 5-7 cm üstüne, sıkıca bağlayın', warning: 'Turnike zamanını not alın!' },
        ],
        doNot: [
            'Batan nesneyi çıkarmayın',
            'Yarayı suyla yıkamayın (ciddi kanamalarda)',
            'Turnikeyi gevşetmeyin',
        ],
        equipment: ['Temiz bez veya gazlı bez', 'Eldiven veya poşet', 'Turnike veya kemer'],
        emergencyOnly: true,
    },

    // Kırık
    {
        id: 'fracture',
        title: 'Kırık Tespiti ve İlk Müdahale',
        category: 'fracture',
        priority: 'high',
        estimatedTime: '5-10 dakika',
        steps: [
            { order: 1, instruction: 'Yaralıyı hareket ettirmeyin', warning: 'Omurga kırığı olabilir!' },
            { order: 2, instruction: 'Kırık bölgesini sabitlemek için atel yapın' },
            { order: 3, instruction: 'Atel için düz tahta, karton veya rulo gazete kullanın' },
            { order: 4, instruction: 'Ateli kırığın üstündeki ve altındaki eklemleri de kapsayacak şekilde bağlayın' },
            { order: 5, instruction: 'Şişlik için buz veya soğuk kompres uygulayın', tip: 'Buzu doğrudan tene değdirmeyin' },
            { order: 6, instruction: 'Parmakların rengini ve hissini kontrol edin' },
        ],
        doNot: [
            'Kırık kemiği yerine oturtmaya çalışmayın',
            'Kırık bölgesini hareket ettirmeyin',
            'Açık kırıkta kemiği içeri itmeyin',
        ],
        equipment: ['Atel malzemesi (tahta, karton)', 'Bağ veya bez şerit', 'Buz'],
        emergencyOnly: false,
    },

    // Ezilme Sendromu
    {
        id: 'crush_syndrome',
        title: 'Enkaz Altı Ezilme Sendromu',
        category: 'crush',
        priority: 'critical',
        estimatedTime: 'Hastane öncesi',
        steps: [
            { order: 1, instruction: 'Profesyonel kurtarma ekibini bekleyin', warning: 'KRİTİK: Yanlış müdahale ölüme yol açabilir!' },
            { order: 2, instruction: 'Kurbanla konuşun, sakinleştirin' },
            { order: 3, instruction: 'Mümkünse su verin (bilinç açıksa)' },
            { order: 4, instruction: 'Uzun süreli sıkışmadan çıkarılmadan ÖNCE tıbbi ekip olmalı', warning: 'Hızlı çıkarma toksin salınımı yapabilir!' },
            { order: 5, instruction: 'Çıkarıldıktan sonra bacakları kalp seviyesinde tutun' },
            { order: 6, instruction: 'Sıvı kaybı için bol su verin' },
        ],
        doNot: [
            '4 saatten fazla sıkışmış kişiyi HIZLA çıkarmayın',
            'Ezilmiş bölgeyi masaj yapmayın',
            'Turnikeyi uzun süre uygulamayın',
        ],
        equipment: ['Su', 'Battaniye'],
        emergencyOnly: true,
    },

    // Şok
    {
        id: 'shock_trauma',
        title: 'Travmatik Şok',
        category: 'shock',
        priority: 'critical',
        estimatedTime: 'Hastane öncesi',
        steps: [
            { order: 1, instruction: 'Yaralıyı sırtüstü yatırın' },
            { order: 2, instruction: 'Bacakları 20-30 cm yükseltin', warning: 'Kafa/göğüs/omurga yaralanması varsa yükseltmeyin!' },
            { order: 3, instruction: 'Sıcak tutun - battaniye veya kıyafetle örtün' },
            { order: 4, instruction: 'Sıkı giysileri gevşetin' },
            { order: 5, instruction: 'Bilinci açıksa konuşun, sakinleştirin' },
            { order: 6, instruction: 'Yemek/içecek vermeyin' },
            { order: 7, instruction: 'Bilinç, nefes ve nabzı sürekli kontrol edin' },
        ],
        doNot: [
            'Ayağa kaldırmayın',
            'Yemek/içecek vermeyin',
            'Yalnız bırakmayın',
        ],
        equipment: ['Battaniye veya örtü'],
        emergencyOnly: true,
    },

    // Yanık
    {
        id: 'burn_care',
        title: 'Yanık Müdahalesi',
        category: 'burn',
        priority: 'high',
        estimatedTime: '5-15 dakika',
        steps: [
            { order: 1, instruction: 'Yanık bölgesini akan soğuk suyla 10-20 dakika soğutun', tip: 'Buzlu su değil, ılık su kullanın' },
            { order: 2, instruction: 'Takıları ve sıkı giysileri (şişmeden) çıkarın' },
            { order: 3, instruction: 'Temiz, kuru bezle gevşekçe örtün' },
            { order: 4, instruction: 'Ağrı kesici verin (bilinç açıksa)' },
            { order: 5, instruction: 'Su için (dehidratasyonu önlemek için)' },
        ],
        doNot: [
            'Buz uygulamayın',
            'Kabarcıkları patlatmayın',
            'Yağ, diş macunu, krem sürmeyin',
            'Yanık bölgesine yapışmış giysiyi zorla çıkarmayın',
        ],
        equipment: ['Temiz su', 'Temiz bez veya gazlı bez'],
        emergencyOnly: false,
    },

    // Temel Yara Bakımı
    {
        id: 'wound_care',
        title: 'Temel Yara Bakımı',
        category: 'trauma',
        priority: 'medium',
        estimatedTime: '5-10 dakika',
        steps: [
            { order: 1, instruction: 'Ellerinizi yıkayın veya eldiven giyin' },
            { order: 2, instruction: 'Yarayı temiz suyla yıkayın' },
            { order: 3, instruction: 'Yabancı cisimleri dikkatlice çıkarın' },
            { order: 4, instruction: 'Antiseptik uygulayın (varsa)' },
            { order: 5, instruction: 'Steril gazlı bezle örtün' },
            { order: 6, instruction: 'Bandajla sabitleyin' },
        ],
        doNot: [
            'Derin saplanmış nesneleri çıkarmayın',
            'Yarayı pamukla temizlemeyin',
        ],
        equipment: ['Su', 'Antiseptik', 'Gazlı bez', 'Bandaj', 'Eldiven'],
        emergencyOnly: false,
    },
];

class FirstAidGuideService {
    private guides: FirstAidGuide[] = [...FIRST_AID_GUIDES];
    private isInitialized = false;

    /**
     * Initialize service
     */
    initialize(): void {
        this.isInitialized = true;
        logger.info(`First aid guide service initialized with ${this.guides.length} guides`);
    }

    /**
     * Get all guides
     */
    getAllGuides(): FirstAidGuide[] {
        return [...this.guides];
    }

    /**
     * Get guide by ID
     */
    getGuideById(id: string): FirstAidGuide | null {
        return this.guides.find(g => g.id === id) || null;
    }

    /**
     * Get guides by category
     */
    getGuidesByCategory(category: FirstAidGuide['category']): FirstAidGuide[] {
        return this.guides.filter(g => g.category === category);
    }

    /**
     * Get guides by priority
     */
    getGuidesByPriority(priority: FirstAidGuide['priority']): FirstAidGuide[] {
        return this.guides.filter(g => g.priority === priority);
    }

    /**
     * Get critical (emergency) guides
     */
    getCriticalGuides(): FirstAidGuide[] {
        return this.guides.filter(g => g.priority === 'critical');
    }

    /**
     * Get earthquake-specific guides (prioritized for earthquake scenarios)
     */
    getEarthquakeGuides(): FirstAidGuide[] {
        // Priority order for earthquake: crush > bleeding > fracture > shock > cpr
        const priorityOrder = ['crush', 'bleeding', 'fracture', 'shock', 'cpr', 'burn', 'trauma', 'other'];
        return [...this.guides].sort((a, b) => {
            return priorityOrder.indexOf(a.category) - priorityOrder.indexOf(b.category);
        });
    }

    /**
     * Search guides
     */
    searchGuides(query: string): FirstAidGuide[] {
        const lowerQuery = query.toLowerCase();
        return this.guides.filter(g =>
            g.title.toLowerCase().includes(lowerQuery) ||
            g.steps.some(s => s.instruction.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Get quick reference card for a guide
     */
    getQuickReference(id: string): string | null {
        const guide = this.getGuideById(id);
        if (!guide) return null;

        let reference = `📋 ${guide.title}\n\n`;
        reference += `⏱ ${guide.estimatedTime}\n\n`;
        reference += `📝 Adımlar:\n`;

        guide.steps.forEach(step => {
            reference += `${step.order}. ${step.instruction}\n`;
            if (step.warning) reference += `   ⚠️ ${step.warning}\n`;
        });

        reference += `\n❌ YAPMAYIN:\n`;
        guide.doNot.forEach(item => {
            reference += `• ${item}\n`;
        });

        return reference;
    }

    /**
     * Get equipment checklist
     */
    getEquipmentChecklist(): string[] {
        const equipment = new Set<string>();
        this.guides.forEach(g => {
            g.equipment.forEach(e => equipment.add(e));
        });
        return Array.from(equipment);
    }
}

export const firstAidGuideService = new FirstAidGuideService();
