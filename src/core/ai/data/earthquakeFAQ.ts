/**
 * EARTHQUAKE FAQ KNOWLEDGE BASE
 * Comprehensive Turkish earthquake safety Q&A database
 * Used for offline AI responses
 * 
 * Categories:
 * - DURING: What to do during earthquake
 * - BEFORE: Preparation before earthquake
 * - AFTER: Actions after earthquake
 * - BUILDING: Building safety information
 * - FAMILY: Family safety protocols
 * - FIRST_AID: Medical emergencies
 * - TRAPPED: If trapped under rubble
 * - EMERGENCY: Emergency contacts and procedures
 */

import { UserIntent } from '../types/intent.types';

export interface KnowledgeEntry {
    id: string;
    intent: UserIntent;
    category: 'earthquake' | 'first_aid' | 'preparedness' | 'general' | 'emergency';
    priority: 1 | 2 | 3; // 1 = highest
    keywords: string[];
    questionVariations: string[];
    answer: string;
    detailedAnswer?: string;
    relatedEntries?: string[];
    emergencyLevel: 'normal' | 'urgent' | 'critical';
    requiresAction?: boolean;
    actionType?: 'call' | 'navigate' | 'share' | 'alert' | 'none';
    source?: string;
}

// ============================================================================
// CRITICAL EMERGENCY - DURING EARTHQUAKE
// ============================================================================

export const EARTHQUAKE_DURING_FAQ: KnowledgeEntry[] = [
    {
        id: 'eq_during_001',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['deprem', 'oluyor', 'şimdi', 'ne yapmalı', 'sallantı', 'sarsıntı'],
        questionVariations: [
            'Deprem oluyor ne yapmalıyım?',
            'Şu an deprem var',
            'Sallantı var ne yapmam lazım?',
            'Deprem şu an ne yapayım',
            'Sarsıntı hissediyorum',
            'Yer sallanıyor',
        ],
        answer: `🚨 SAKİN KALIN! Hemen şunları yapın:

1️⃣ ÇÖMEL - Yere çöküp dizlerinizin üzerine gelin
2️⃣ KAPAN - Sağlam bir masanın altına girin
3️⃣ TUTUN - Masa ayağını sıkıca tutun

⚠️ YAPMAYIN:
• Koşmayın, merdiven kullanmayın
• Asansöre binmeyin
• Balkon veya pencereye gitmeyin

📱 Sallanma durduğunda açık alana çıkın.`,
        detailedAnswer: `DEPREM SIRASINDA ADIM ADIM:

🔴 İLK 10 SANİYE (KRİTİK):
1. Panik yapmayın, derin nefes alın
2. Bulunduğunuz yerde kalın
3. Çömel-Kapan-Tutun pozisyonuna geçin

🟡 ÇÖMEL-KAPAN-TUTUN TEKNİĞİ:
• Yere çömelip dizlerinizin üzerine gelin
• Başınızı ve boynunuzu koruyun
• Mümkünse sağlam bir masanın altına girin
• Masa ayağını sıkıca tutun
• Masa yoksa iç duvar dibine çömelin

🔴 KESİNLİKLE YAPMAYIN:
• Koşmayın - düşebilirsiniz
• Merdiven kullanmayın - çökebilir
• Asansöre binmeyin - mahsur kalabilirsiniz
• Pencere/balkon yakınına gitmeyin
• Dışarı çıkmaya çalışmayın

✅ SALLANMA DURDUKTAN SONRA:
1. 60 saniye bekleyin (artçılar olabilir)
2. Çevrenizi kontrol edin
3. Yavaşça açık alana çıkın
4. Ailenizi arayın`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'alert',
        relatedEntries: ['eq_during_002', 'eq_during_003', 'eq_after_001'],
        source: 'AFAD Deprem Rehberi',
    },
    {
        id: 'eq_during_002',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['masa', 'altına', 'korunak', 'sığınak', 'saklan'],
        questionVariations: [
            'Masanın altına mı girmeliyim?',
            'Nereye saklanmalıyım?',
            'Korunak nerede?',
            'Kapı eşiği mi masa mı?',
            'Nereye sığınmalıyım depremde?',
        ],
        answer: `✅ DOĞRU: Sağlam masanın altına girin!

Masa yoksa:
• İç duvar dibine çömelin
• Başınızı ellerinizle koruyun
• Pencere ve mobilyalardan uzak durun

❌ YANLIŞ: Kapı eşiği GÜVENLİ DEĞİL!
Modern binalarda kapı eşikleri koruma sağlamaz.`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'eq_during_003',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['dışarı', 'çık', 'kaç', 'koş', 'merdiven'],
        questionVariations: [
            'Dışarı çıkmalı mıyım?',
            'Koşmalı mıyım?',
            'Merdivenden inmeliyim mi?',
            'Kaçmalı mıyım?',
            'Binadan çıkmalı mı?',
        ],
        answer: `🚫 HAYIR! Deprem sırasında koşmayın!

Düşen eşyalar ve sarsıntı sizi yaralayabilir.

⏱️ BEKLE: Sallantı durana kadar yerinde kal
✅ SONRA: Sallantı durduğunda sakin şekilde çık

Merdiven kullanmak en tehlikeli seçenektir!`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'eq_during_004',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['asansör', 'lift', 'mahsur', 'kaldım'],
        questionVariations: [
            'Asansördeyim ne yapmalıyım?',
            'Asansörde deprem oldu',
            'Asansörde mahsur kaldım',
            'Lift çalışmıyor',
        ],
        answer: `🚨 ASANSÖRDE DEPREM:

1. TÜM KATLARA BASIN - en yakın katta duracaktır
2. Kapı açılırsa hemen çıkın
3. Mahsur kaldıysanız:
   • Acil çağrı butonuna basın
   • Duvarları vurun (dikkat çekmek için)
   • Telefondan 112'yi arayın
   
💡 Panik yapmayın - asansörler güvenlik sistemlidir.`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'AFAD',
    },
    {
        id: 'eq_during_005',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['araba', 'araç', 'trafik', 'sürüyorum', 'yol'],
        questionVariations: [
            'Arabadayım ne yapmalıyım?',
            'Araç kullanırken deprem oldu',
            'Trafikte deprem var',
            'Araba sürüyorum sallantı var',
        ],
        answer: `🚗 ARAÇTA DEPREM:

1. Yavaşça yol kenarına çekin
2. Köprü, tünel, alt geçitten UZAK DURUN
3. El frenini çekin, motoru kapatın
4. Araç içinde kalın - sarsıntı bitene kadar
5. Bitince anahtarı bırakıp yaya çıkın

⚠️ Köprü ve üst geçitler çökebilir!`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'eq_during_006',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['dışarıda', 'sokak', 'cadde', 'açık', 'alan'],
        questionVariations: [
            'Dışarıdayım ne yapmalıyım?',
            'Sokaktayım deprem var',
            'Açık alandayım',
            'Dışarıda deprem oldu',
        ],
        answer: `🏞️ DIŞARIDA DEPREM:

1. Binalardan, elektrik direklerinden UZAKLAŞ
2. Açık bir alana git
3. Çömel ve başını koru
4. Düşen cam ve molozlara dikkat et

✅ En güvenli: Park, bahçe, geniş meydan
❌ Tehlikeli: Bina yanı, elektrik hattı altı`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'eq_during_007',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['okul', 'sınıf', 'öğrenci', 'çocuk', 'öğretmen'],
        questionVariations: [
            'Okuldayım ne yapmalıyım?',
            'Sınıfta deprem oldu',
            'Çocuğum okulda deprem var',
            'Öğrenci olarak ne yapmalıyım?',
        ],
        answer: `🏫 OKULDA DEPREM:

1. Sıranın altına gir
2. Başını ve boynunu koru
3. Öğretmenin talimatlarını bekle
4. Koşma, itişme
5. Tahliye emri gelince düzenli çık

👨‍👩‍👧 Veliler: Panik yapmayın, okula koşmayın.
Okullar protokol uygular, çocuğunuz güvende.`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'MEB Deprem Protokolü',
    },
    {
        id: 'eq_during_008',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['iş', 'ofis', 'işyeri', 'çalışıyorum', 'patron'],
        questionVariations: [
            'İşteyim deprem oldu',
            'Ofiste ne yapmalıyım?',
            'İşyerinde deprem var',
            'Çalışırken deprem',
        ],
        answer: `🏢 OFİSTE DEPREM:

1. Masanın altına sığın
2. Bilgisayar, monitör gibi eşyalardan uzak dur
3. Pencerelerden uzak ol
4. Asansör kullanma
5. Yangın merdiveninden tahliye

⚠️ Yüksek katlarda sallantı daha şiddetli hissedilir - bu normaldir.`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'İSG Yönetmeliği',
    },
    {
        id: 'eq_during_009',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['gece', 'uyku', 'yatak', 'yatıyorum', 'uyanık'],
        questionVariations: [
            'Gece deprem oldu',
            'Yataktayım sallantı var',
            'Uyurken deprem',
            'Gece yarısı deprem ne yapmalı?',
        ],
        answer: `🌙 GECE DEPREMİ:

1. Yatakta kal - koşma
2. Yastıkla başını koru
3. Cam kırıkları için ayağına dikkat
4. El feneri kullan (telefon ışığı)
5. Sallantı duranca ayakkabı giy

💡 Yatağın yanında ter lik ve el feneri bulundur.`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'eq_during_010',
        intent: 'EARTHQUAKE_NOW',
        category: 'earthquake',
        priority: 1,
        keywords: ['bebek', 'çocuk', 'küçük', 'yeni doğan', 'hamile'],
        questionVariations: [
            'Bebeğimle ne yapmalıyım?',
            'Çocuğum yanımda deprem var',
            'Hamileyim deprem oldu',
            'Küçük çocukla deprem',
        ],
        answer: `👶 BEBEK/ÇOCUK İLE DEPREM:

1. Bebeği kucağına al
2. Birlikte masanın altına gir
3. Bebeğin başını göğsüne yasla
4. Çocuğa sakin ol, korkma de
5. Kucakta taşıyarak tahliye et

🤰 HAMİLE: Yan yat, karnını koru, döşeme üzerinde kal.`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
];

// ============================================================================
// TRAPPED UNDER RUBBLE - ENKAz ALTINDA
// ============================================================================

export const TRAPPED_FAQ: KnowledgeEntry[] = [
    {
        id: 'trapped_001',
        intent: 'TRAPPED',
        category: 'emergency',
        priority: 1,
        keywords: ['enkaz', 'mahsur', 'altında', 'kaldım', 'sıkıştım', 'çıkamıyorum'],
        questionVariations: [
            'Enkaz altındayım',
            'Mahsur kaldım ne yapmalıyım',
            'Bina çöktü altındayım',
            'Sıkıştım çıkamıyorum',
            'Yardım edin enkaz altındayım',
        ],
        answer: `🆘 ENKAZ ALTINDA HAYATTA KALMA:

1️⃣ SAKİN KAL - Oksijeni korumak için yavaş nefes al
2️⃣ HAREKET ETME - Enkaz kayabilir
3️⃣ SES ÇIKAR - Boru/demir vur, düdük çal
4️⃣ TELEFONDAYSAN - 112'yi ara, pil tasarrufu yap
5️⃣ ISI KORU - Giysilerinle örtün

📱 Afetnet SOS butonuna bas - konumun paylaşılacak!`,
        detailedAnswer: `🚨 ENKAZ ALTINDA DETAYLI REHber:

🔴 İLK YAPILACAKLAR:
1. Panik yapma - derin nefes al
2. Vücudunu kontrol et - yaralı mısın?
3. Çevrendekileri kontrol et
4. Hareket alanını değerlendir

🟡 HAYATTA KALMA:
• Az hareket et - oksijen tasarrufu
• Ağzını bez ile kapat - toz soluma
• Bağırarak sesi boşa harcama
• Metal/boru vurarak sinyal ver
• Telefonunu ışık olarak kullan

🔵 KURTARMA EKİBİNİ BEKLERKEN:
• Düzenli aralıklarla ses çıkar (3 kez vur)
• Sıvı varsa yudumla - az iç
• Uyanık kalmaya çalış
• Pozitif düşün - kurtarma gelecek

📞 112 ARAYABİLİYORSAN:
• Adını, bulunduğun binayı söyle
• Kaçıncı katta olduğunu belirt
• Kaç kişi olduğunu bildir
• Yaralı var mı belirt`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'AFAD Arama Kurtarma',
    },
    {
        id: 'trapped_002',
        intent: 'TRAPPED',
        category: 'emergency',
        priority: 1,
        keywords: ['ses', 'çıkar', 'sinyal', 'vur', 'düdük', 'çağır'],
        questionVariations: [
            'Nasıl ses çıkarmalıyım?',
            'Kurtarma ekibine nasıl sinyal veririm?',
            'Enkaz altından nasıl haber veririm?',
        ],
        answer: `📢 ENKAZ ALTINDAN SİNYAL VERME:

✅ ETKİLİ YÖNTEMLER:
1. Metal/boru vur (3 kez tekrarla)
2. Taş ile duvara vur
3. Düdük çal (varsa)
4. Telefon zil sesi

❌ YAPMA:
• Sürekli bağırma - enerjini bitirir
• Kibrit/çakmak yakma - oksijen tüketir

⏱️ Her 15-20 dakikada sinyal ver.`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'trapped_003',
        intent: 'TRAPPED',
        category: 'emergency',
        priority: 1,
        keywords: ['su', 'yemek', 'açlık', 'susuzluk', 'beklerken'],
        questionVariations: [
            'Enkaz altında su yok ne yapmalıyım?',
            'Kaç gün dayanabilirim?',
            'Susuzken ne yapmalıyım?',
        ],
        answer: `💧 ENKAZ ALTINDA HAYATTA KALMA:

💧 SU:
• İnsan 3-5 gün susuz dayanabilir
• Varsa az az iç
• Isıyı koruyarak terlemeyi azalt

🍞 YEMEK:
• 2-3 hafta yemeksiz dayanılabilir
• Öncelik su değil ısı koruması

🧘 ZİHİNSEL:
• Pozitif düşün
• Aile için hayatta kal
• Kurtarma gelecek!`,
        emergencyLevel: 'critical',
        requiresAction: false,
        actionType: 'none',
        source: 'Tıbbi Kaynaklar',
    },
];

// ============================================================================
// AFTER EARTHQUAKE - DEPREM SONRASI
// ============================================================================

export const EARTHQUAKE_AFTER_FAQ: KnowledgeEntry[] = [
    {
        id: 'eq_after_001',
        intent: 'WHAT_TO_DO',
        category: 'earthquake',
        priority: 1,
        keywords: ['sonra', 'bitti', 'durdu', 'şimdi', 'artçı'],
        questionVariations: [
            'Deprem bitti ne yapmalıyım?',
            'Sallantı durdu şimdi ne yapmalıyım?',
            'Deprem sonrası ne yapmalıyım?',
            'Artçı deprem olabilir mi?',
        ],
        answer: `✅ DEPREM DURDUĞUNDA:

1️⃣ 60 saniye bekle - artçı olabilir
2️⃣ Yaralı var mı kontrol et
3️⃣ Gaz ve elektriği kapat
4️⃣ Binayı kontrol et - hasar varsa çık
5️⃣ Açık alana git
6️⃣ Ailenle iletişim kur
7️⃣ Resmi açıklamaları takip et

⚠️ ARTÇI DEPREMLER: Saatlerce hatta günlerce sürebilir!`,
        detailedAnswer: `📋 DEPREM SONRASI KONTROL LİSTESİ:

🔴 İLK 5 DAKİKA:
□ Kendini kontrol et - yaralı mısın?
□ Ailenin durumunu kontrol et
□ Tehlikeli alanlardan uzaklaş
□ Derin nefes al, sakinleş

🟡 İLK 30 DAKİKA:
□ Gaz vanasını kapat
□ Elektrik sigortasını indir
□ Su vanasını kapat
□ Binayı hasar açısından kontrol et
□ Deprem çantasını al
□ Açık alana git

🟢 İLK 2 SAAT:
□ Aileni ara (kısa konuş - hatlar yoğun)
□ Toplanma alanına git
□ Hasarlı binalara girme
□ Resmi açıklamaları dinle
□ Komşulara yardım et
□ Fotoğraf çek (sigorta için)

📻 TAKİP ET:
• AFAD sosyal medya
• TRT Radyo
• Valilik açıklamaları`,
        emergencyLevel: 'urgent',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'eq_after_002',
        intent: 'WHAT_TO_DO',
        category: 'earthquake',
        priority: 1,
        keywords: ['gaz', 'elektrik', 'su', 'kapat', 'sızıntı'],
        questionVariations: [
            'Gaz vanasını kapatmalı mıyım?',
            'Elektriği kesmeli miyim?',
            'Gaz kokusu var ne yapmalıyım?',
            'Su borusu patladı',
        ],
        answer: `⚡ DEPREM SONRASI TESİSAT:

🔥 GAZ:
• Vanayı KAPAT
• Koku varsa pencereleri aç
• Çakmak/kibrit YAKMA
• 187'yi ara

⚡ ELEKTRİK:
• Ana sigortayı KAPAT
• Hasar varsa hiçbir cihaza dokunma
• 186'yı ara

💧 SU:
• Ana vanayı kapat
• Temiz su depola
• 185'i ara`,
        emergencyLevel: 'urgent',
        requiresAction: true,
        actionType: 'call',
        source: 'AFAD',
    },
    {
        id: 'eq_after_003',
        intent: 'WHAT_TO_DO',
        category: 'earthquake',
        priority: 1,
        keywords: ['bina', 'hasar', 'çatlak', 'güvenli', 'girebilir'],
        questionVariations: [
            'Binaya girmek güvenli mi?',
            'Evimde çatlaklar var tehlikeli mi?',
            'Hasarlı binaya girebilir miyim?',
            'Evim güvende mi?',
        ],
        answer: `🏠 BİNA HASAR DEĞERLENDİRME:

❌ GİRME (ÇOK TEHLİKELİ):
• Duvarlar eğilmiş
• Kolon/kiriş kırık
• Bina çökmüş
• Yapı kaymış

⚠️ DİKKATLİ OL:
• İnce çatlaklar (2mm altı)
• Sıva dökülmesi
• Cam kırıkları

✅ RESMİ KONTROL:
• Yerel yönetim ekibi gelene kadar bekle
• e-Devlet'ten hasar durumunu sorgula
• 181 ALO'yu ara`,
        emergencyLevel: 'urgent',
        requiresAction: false,
        actionType: 'none',
        source: 'Bayındırlık Bakanlığı',
    },
    {
        id: 'eq_after_004',
        intent: 'WHAT_TO_DO',
        category: 'earthquake',
        priority: 2,
        keywords: ['artçı', 'tekrar', 'yine', 'kaç', 'süre'],
        questionVariations: [
            'Artçı deprem olacak mı?',
            'Kaç tane artçı olabilir?',
            'Artçılar ne kadar sürer?',
            'Büyük artçı olabilir mi?',
        ],
        answer: `🔄 ARTÇI DEPREMLER:

📊 GERÇEKLER:
• Her büyük depremden sonra artçılar olur
• Günlerce, haftalarca sürebilir
• Genellikle ana depremden küçüktür
• İlk 24 saat en yoğundur

⚠️ DİKKAT:
• Her artçıda çömel-kapan-tutun yap
• Hasarlı binalardan uzak dur
• Toplanma alanında kal

📈 İSTATİSTİK:
7.0 deprem → 10-15 büyük artçı beklenir`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
        source: 'Kandilli Rasathanesi',
    },
    {
        id: 'eq_after_005',
        intent: 'WHAT_TO_DO',
        category: 'earthquake',
        priority: 2,
        keywords: ['toplanma', 'alan', 'nereye', 'git', 'acil'],
        questionVariations: [
            'Toplanma alanı nerede?',
            'Nereye gitmeliyim?',
            'En yakın toplanma alanı?',
            'Acil toplanma yeri?',
        ],
        answer: `📍 TOPLANMA ALANLARI:

🗺️ NASIL BULUNUR:
• e-Devlet → AFAD Toplanma Alanları
• AfetNet haritasından görebilirsin
• Belediye web sitesi

✅ TOPLANMA ALANINDA:
• Kayıt ol
• Aileni bekle
• Yetkilileri dinle
• Yardım için hazır ol

📱 AfetNet'te "Harita" sekmesine git - en yakın toplanma alanını göster!`,
        emergencyLevel: 'normal',
        requiresAction: true,
        actionType: 'navigate',
        source: 'AFAD',
    },
];

// ============================================================================
// BEFORE EARTHQUAKE - DEPREM ÖNCESİ HAZIRLIK
// ============================================================================

export const EARTHQUAKE_BEFORE_FAQ: KnowledgeEntry[] = [
    {
        id: 'eq_before_001',
        intent: 'PREPAREDNESS',
        category: 'preparedness',
        priority: 2,
        keywords: ['hazırlık', 'hazırlan', 'önce', 'ne', 'yapmalı', 'plan'],
        questionVariations: [
            'Depreme nasıl hazırlanmalıyım?',
            'Deprem öncesi ne yapmalıyım?',
            'Deprem hazırlığı nasıl yapılır?',
            'Afet planı nasıl yapılır?',
        ],
        answer: `📋 DEPREM HAZIRLIK PLANI:

1️⃣ DEPREM ÇANTASI HAZIRLA
2️⃣ AİLE BULUŞMA NOKTASI BELİRLE
3️⃣ ACİL İLETİŞİM LİSTESİ OLUŞTUR
4️⃣ EVİNİ GÜVENLİ HALE GETİR
5️⃣ TOPLANMA ALANINI ÖĞren

📱 AfetNet'te "Hazırlık Planı" bölümünden kişisel planını oluştur!`,
        detailedAnswer: `🏠 KAPSAMLI DEPREM HAZIRLIK REHBERİ:

📦 DEPREM ÇANTASI:
□ 3 günlük su (kişi başı 9 litre)
□ Konserve yiyecekler
□ El feneri + yedek pil
□ Pilli radyo
□ İlk yardım çantası
□ Düdük
□ Önemli evrak kopyaları
□ Şarj aleti (portatif)
□ Nakit para
□ İlaçlar (varsa)

🏠 EV GÜVENLİĞİ:
□ Mobilyaları duvara sabitle
□ Ağır eşyaları aşağı koy
□ Cam dolaplara kilit tak
□ Su ısıtıcısını sabitle
□ Gaz vanası yerini öğren

👨‍👩‍👧‍👦 AİLE PLANI:
□ Buluşma noktası belirle
□ Dış il irtibat kişisi seç
□ Çocuklara tatbikat yaptır
□ Toplanma alanını ziyaret et

📱 AFetNet'te tüm bunları takip edebilirsin!`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'navigate',
        source: 'AFAD',
    },
    {
        id: 'eq_before_002',
        intent: 'PREPAREDNESS',
        category: 'preparedness',
        priority: 2,
        keywords: ['çanta', 'deprem', 'afet', 'acil', 'malzeme'],
        questionVariations: [
            'Deprem çantasında ne olmalı?',
            'Afet çantası nasıl hazırlanır?',
            'Acil durum çantası içeriği?',
            'Deprem çantası listesi',
        ],
        answer: `🎒 DEPREM ÇANTASI İÇERİĞİ:

💧 SU VE GIDA:
• 3 günlük su (9 litre/kişi)
• Konserve yiyecekler
• Enerji barları
• Açacak

🔦 ARAÇLAR:
• El feneri + pil
• Düdük
• Pilli radyo
• Çok amaçlı bıçak

🏥 SAĞLIK:
• İlk yardım kiti
• Reçeteli ilaçlar
• Maske, eldiven

📱 TEKNOLOJİ:
• Portatif şarj cihazı
• Yedek telefon kablosu

📄 EVRAK:
• Kimlik fotokopisi
• Sigorta evrakları
• Nakit para`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
    {
        id: 'eq_before_003',
        intent: 'PREPAREDNESS',
        category: 'preparedness',
        priority: 2,
        keywords: ['mobilya', 'sabitle', 'dolap', 'düş', 'devril'],
        questionVariations: [
            'Mobilyaları nasıl sabitleyeyim?',
            'Dolap devrilmemesi için ne yapmalıyım?',
            'Ev güvenliği nasıl sağlanır?',
        ],
        answer: `🔧 MOBİLYA SABİTLEME:

📺 TELEVİZYON:
• Duvara monte et
• Kayma önleyici şerit kullan

🗄️ DOLAPLAR:
• L tipi köşe bağlantısı
• Dübel ile duvara sabitle
• Kapak kilitleri tak

📚 RAFLAR:
• Duvara monte
• Ağır eşyaları alta koy

🔥 SU ISITICI:
• Metal şerit ile sabitle
• Esnek boru bağlantısı

💡 Deprem sırasında düşen mobilyalar en büyük tehlikedir!`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
        source: 'AFAD',
    },
];

// ============================================================================
// RISK & SAFETY INFORMATION
// ============================================================================

export const RISK_INFO_FAQ: KnowledgeEntry[] = [
    {
        id: 'risk_001',
        intent: 'RISK_QUERY',
        category: 'earthquake',
        priority: 2,
        keywords: ['risk', 'tehlike', 'fay', 'bölge', 'riskli', 'güvenli'],
        questionVariations: [
            'Bölgem riskli mi?',
            'Türkiye deprem riski nedir?',
            'En riskli iller hangileri?',
            'Fay hattı nerede?',
            'Güvenli yer var mı?',
        ],
        answer: `🗺️ TÜRKİYE DEPREM RİSKİ:

🔴 ÇOK YÜKSEK RİSK:
• Marmara Bölgesi (İstanbul, Kocaeli)
• Ege kıyıları (İzmir, Manisa)
• Doğu Anadolu (Malatya, Elazığ)

🟠 YÜKSEK RİSK:
• Akdeniz kıyıları
• İç Anadolu (Konya, Afyon)

⚠️ Türkiye'nin %96'sı deprem kuşağındadır!

📱 AfetNet'te "Risk Skoru" bölümünden kendi bölgenin riskini öğren!`,
        emergencyLevel: 'normal',
        requiresAction: true,
        actionType: 'navigate',
        source: 'AFAD Deprem Haritası',
    },
    {
        id: 'risk_002',
        intent: 'RISK_QUERY',
        category: 'earthquake',
        priority: 2,
        keywords: ['bina', 'güvenli', 'kat', 'yıl', 'yapı'],
        questionVariations: [
            'Binam güvenli mi?',
            'Kaçıncı kat güvenli?',
            'Eski bina tehlikeli mi?',
            'Yapı güvenliği nasıl anlaşılır?',
        ],
        answer: `🏢 BİNA GÜVENLİĞİ:

✅ GÜVENLİ YAPILAR:
• 2000 sonrası deprem yönetmeliğine uygun
• Betonarme taşıyıcı sistem
• Düzenli bakım yapılmış

❌ RİSKLİ YAPILAR:
• 1999 öncesi yapılar
• Yığma (tuğla) binalar
• Zemin katta dükkan açılmış
• Kaçak kat eklenmiş

📋 KONTROL ET:
• Yapı ruhsatı var mı?
• Risk tespiti yapıldı mı?
• e-Devlet'ten bina durumunu sorgula`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
        source: 'Çevre ve Şehircilik Bakanlığı',
    },
    {
        id: 'risk_003',
        intent: 'EARTHQUAKE_INFO',
        category: 'earthquake',
        priority: 2,
        keywords: ['son', 'deprem', 'nerede', 'büyüklük', 'şiddet', 'ne zaman'],
        questionVariations: [
            'Son deprem nerede oldu?',
            'Az önce deprem mi oldu?',
            'Türkiye\'de son depremler?',
            'Bugün deprem oldu mu?',
        ],
        answer: `📊 SON DEPREMLER:

📱 AfetNet'te "Harita" sekmesine git:
• Gerçek zamanlı deprem verileri
• Kandilli + AFAD kaynakları
• Büyüklük ve derinlik bilgisi
• Konumuna göre uzaklık

🔔 BİLDİRİM AYARLARI:
"Ayarlar" → "Bildirimler" → "Deprem Uyarıları"

En doğru ve güncel bilgi için AfetNet harita!`,
        emergencyLevel: 'normal',
        requiresAction: true,
        actionType: 'navigate',
        source: 'Kandilli & AFAD',
    },
];

// ============================================================================
// GENERAL & APP HELP
// ============================================================================

export const GENERAL_FAQ: KnowledgeEntry[] = [
    {
        id: 'general_001',
        intent: 'GREETING',
        category: 'general',
        priority: 3,
        keywords: ['merhaba', 'selam', 'günaydın', 'iyi', 'akşamlar'],
        questionVariations: [
            'Merhaba',
            'Selam',
            'Günaydın',
            'İyi akşamlar',
            'Nasılsın',
        ],
        answer: `Merhaba! 👋

Ben AfetNet Yapay Zeka Asistanı. Size şu konularda yardımcı olabilirim:

🌍 Deprem ve afet bilgisi
🏥 İlk yardım rehberi
📋 Hazırlık planı
🗺️ Toplanma alanları
📊 Risk değerlendirmesi

Sormak istediğiniz bir şey var mı?`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
    },
    {
        id: 'general_002',
        intent: 'THANKS',
        category: 'general',
        priority: 3,
        keywords: ['teşekkür', 'sağol', 'eyvallah', 'mersi'],
        questionVariations: [
            'Teşekkürler',
            'Sağ ol',
            'Çok teşekkür ederim',
            'Eyvallah',
        ],
        answer: `Rica ederim! 🙏

Başka sorunuz olursa her zaman buradayım. 
Güvende kalın! 💚`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
    },
    {
        id: 'general_003',
        intent: 'APP_HELP',
        category: 'general',
        priority: 3,
        keywords: ['uygulama', 'nasıl', 'kullan', 'yardım', 'afetnet'],
        questionVariations: [
            'AfetNet nasıl kullanılır?',
            'Uygulama ne işe yarar?',
            'Özellikleri neler?',
            'AfetNet nedir?',
        ],
        answer: `📱 AFETNET ÖZELLİKLERİ:

🗺️ HARİTA:
• Gerçek zamanlı deprem verileri
• Toplanma alanları
• Tahliye rotaları
• Aile takibi

📊 RİSK SKORU:
• Kişisel risk değerlendirmesi
• Bölgesel tehlike analizi

📋 HAZIRLIK PLANI:
• Kişiselleştirilmiş kontrol listesi
• Deprem çantası rehberi

🆘 ACİL DURUM:
• Tek tuşla SOS
• Konum paylaşımı
• Acil iletişim

🤖 AI ASİSTAN:
• 7/24 yardım
• Offline çalışır`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
    },
    {
        id: 'general_004',
        intent: 'APP_HELP',
        category: 'general',
        priority: 3,
        keywords: ['sos', 'acil', 'buton', 'yardım', 'çağır'],
        questionVariations: [
            'SOS butonu ne işe yarar?',
            'Acil yardım nasıl çağırılır?',
            'SOS nasıl kullanılır?',
        ],
        answer: `🆘 SOS BUTONU:

1️⃣ Ana ekranda kırmızı SOS butonuna bas
2️⃣ 3 saniye bas ve tut
3️⃣ Otomatik olarak:
   • Konumun paylaşılır
   • Acil kişilere mesaj gider
   • 112 arama seçeneği çıkar

⚠️ Gerçek acil durumlar için kullan!

📍 İnternet olmadan da çalışır (BLE Mesh ile)`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
    },
];

// ============================================================================
// EMERGENCY CONTACTS
// ============================================================================

export const EMERGENCY_CONTACTS_FAQ: KnowledgeEntry[] = [
    {
        id: 'contacts_001',
        intent: 'NEED_HELP',
        category: 'emergency',
        priority: 1,
        keywords: ['numara', 'ara', 'telefon', 'acil', 'yardım', 'çağır'],
        questionVariations: [
            'Acil numaralar neler?',
            'Kimi aramalıyım?',
            'Yardım numarası kaç?',
            '112 mi aramalıyım?',
        ],
        answer: `📞 ACİL YARDIM NUMARALARI:

🚨 GENEL: 112 (Tüm acil durumlar)
🚒 İTFAİYE: 110
👮 POLİS: 155
🚑 AMBULANS: 112
🏥 SAĞLIK: 182

⚡ ALT YAPI:
• Elektrik: 186
• Gaz: 187
• Su: 185

📱 AFAD: 122
📱 KIZILAY: 168

💡 112 aramak için telefon hattı gerekli!`,
        emergencyLevel: 'urgent',
        requiresAction: true,
        actionType: 'call',
        source: 'Resmi Kaynak',
    },
];

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const ALL_EARTHQUAKE_FAQ: KnowledgeEntry[] = [
    ...EARTHQUAKE_DURING_FAQ,
    ...TRAPPED_FAQ,
    ...EARTHQUAKE_AFTER_FAQ,
    ...EARTHQUAKE_BEFORE_FAQ,
    ...RISK_INFO_FAQ,
    ...GENERAL_FAQ,
    ...EMERGENCY_CONTACTS_FAQ,
];

// Export count for verification
export const FAQ_COUNT = ALL_EARTHQUAKE_FAQ.length;

// Quick lookup by ID
export const FAQ_BY_ID = new Map(ALL_EARTHQUAKE_FAQ.map((entry) => [entry.id, entry]));

// Quick lookup by intent
export const FAQ_BY_INTENT = ALL_EARTHQUAKE_FAQ.reduce((acc, entry) => {
    const intent = entry.intent;
    if (!acc[intent]) {
        acc[intent] = [];
    }
    acc[intent].push(entry);
    return acc;
}, {} as Record<string, KnowledgeEntry[]>);
