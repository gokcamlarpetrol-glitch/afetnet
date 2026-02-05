/**
 * FIRST AID GUIDE KNOWLEDGE BASE
 * Comprehensive Turkish first aid instructions for emergencies
 * Optimized for offline use
 */

import { UserIntent } from '../types/intent.types';
import { KnowledgeEntry } from './earthquakeFAQ';

// ============================================================================
// BLEEDING - KANAMA
// ============================================================================

export const BLEEDING_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_bleeding_001',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 1,
        keywords: ['kan', 'kanama', 'kesik', 'yara', 'durdurmak'],
        questionVariations: [
            'Kanama nasıl durdurulur?',
            'Kan akıyor ne yapmalıyım?',
            'Kesildim ne yapayım?',
            'Yara kanaması durmuyor',
        ],
        answer: `🩸 KANAMA DURDURMA:

1️⃣ TEMİZ BEZ İLE BASIN
   • Yaranın üzerine temiz bez koyun
   • Sıkıca 10-15 dakika basın
   • Bezi kaldırmadan basın tutun

2️⃣ YARALI BÖLGEYİ YUKARI KALDIR
   • Kanayan bölgeyi kalp seviyesinin üstüne

3️⃣ BASINÇ NOKTALARINI KULLAN
   • Kolda: Koltuk altı
   • Bacakta: Kasık

⚠️ 15 dakika sonra kanama devam ediyorsa 112'yi arayın!`,
        detailedAnswer: `🏥 DETAYLI KANAMA KONTROLÜ:

🔴 HAFİF KANAMA (Küçük kesikler):
1. Suyla yıkayın
2. Temiz bezle bastırın
3. Yara bandı uygulayın

🟠 ORTA ŞİDDETTE KANAMA:
1. Temiz bez/gazlı bez kullanın
2. 15 dakika basınç uygulayın
3. Bandaj ile sarın
4. Gerekirse ikinci kat ekleyin

🔴 AĞIR KANAMA (ACİL):
1. 112'yi hemen arayın
2. Eldiven giyin (varsa)
3. Yaraya doğrudan basınç
4. Turnike SADECE son çare
5. Şok pozisyonu (ayaklar yukarı)

⚠️ YAPMAYIN:
• İlk bezi çıkarmayın
• Yaraya tozlu/kirli bez koymayın
• Batmış cismi çıkarmayın`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'Türk Kızılay İlk Yardım',
    },
    {
        id: 'fa_bleeding_002',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 1,
        keywords: ['turnike', 'bağla', 'sık', 'ağır', 'kanama'],
        questionVariations: [
            'Turnike nasıl yapılır?',
            'Ağır kanama için ne yapmalı?',
            'Kol kesildi çok kan akıyor',
        ],
        answer: `🆘 TURNİKE (SON ÇARE):

⚠️ SADECE ŞU DURUMLARDA:
• Uzuv kopması
• Arteriyel (fışkıran) kanama
• Diğer yöntemler işe yaramadı

UYGULAMA:
1. Yaranın 5-7 cm üstüne uygula
2. 5 cm genişlikte bant kullan
3. Kan duruncaya kadar sık
4. Saati not et
5. Kesinlikle gevşetme
6. Acil tıbbi yardım çağır

⏱️ 2 saatten fazla tutulmamalı!`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'UMKE',
    },
];

// ============================================================================
// FRACTURES - KIRIKLAR
// ============================================================================

export const FRACTURE_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_fracture_001',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 1,
        keywords: ['kırık', 'kemik', 'kırıldı', 'atel', 'çıkık'],
        questionVariations: [
            'Kırık kemik için ne yapmalı?',
            'Kolu kırıldı ne yapayım?',
            'Kemik kırığı ilk yardım',
            'Çıkık için ne yapmalı?',
        ],
        answer: `🦴 KIRIK İLK YARDIM:

1️⃣ Hareket ettirme!
2️⃣ Kırığı destekle (boyun dahil)
3️⃣ Buz uygula (bez ile)
4️⃣ Şişmeyi engellemek için yukarı kaldır
5️⃣ Atel uygula (varsa)
6️⃣ 112'yi ara

🚫 YAPMA:
• Kemiği yerine oturtmaya çalışma
• Masaj yapma
• Isı uygulama

⚠️ OMURGA KIRIGI ŞÜPHESI:
Kesinlikle hareket ettirme, 112 bekle!`,
        detailedAnswer: `🏥 KIRIK TÜRLERİNE GÖRE İLK YARDIM:

💪 KOL KIRIĞI:
1. Kolu vücuda yakın tut
2. Üçgen askı yap
3. Hareketsiz tut
4. Buz uygula

🦵 BACAK KIRIĞI:
1. Hasta yatır
2. Bacağı hareket ettirme
3. Battaniye/giysi ile destekle
4. 112 ara

🦴 AÇIK KIRIK (Kemik görünür):
1. Yaraya dokunma
2. Steril gazlı bez ile ört
3. Kemiği itme
4. ACİL 112

🔙 OMURGA/BOYUN:
1. Hiç hareket ettirme
2. Baş ve boynu sabitle
3. Hasta bilinçliyse konuş
4. 112 bekle

📌 ATEL YAPIMI:
• Sert malzeme (tahta, karton)
• Eklem üstü ve altını sabitle
• Çok sıkmadan bağla`,
        emergencyLevel: 'urgent',
        requiresAction: true,
        actionType: 'call',
        source: 'UMKE',
    },
];

// ============================================================================
// BURNS - YANIKLAR
// ============================================================================

export const BURN_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_burn_001',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 1,
        keywords: ['yanık', 'yandım', 'ateş', 'kaynar', 'su', 'sıcak'],
        questionVariations: [
            'Yanık için ne yapmalı?',
            'Elim yandı ne yapayım?',
            'Kaynar su döküldü',
            'Yanık nasıl tedavi edilir?',
        ],
        answer: `🔥 YANIK İLK YARDIM:

1️⃣ SOĞUK SU UYGULA
   • Musluk suyu (20 dakika)
   • Buz değil, soğuk su!

2️⃣ SARAN KAĞIDI İLE ÖRT
   • Temiz, yapışmayan

3️⃣ AĞRI KESİCİ VER
   • Parasetamol

🚫 YAPMA:
• Buzla yakma
• Yağ sürme
• Kabarcığı patlatma
• Yanığa pamuk koyma
• Diş macunu sürme

⚠️ BÜYÜK YANIK: 112 ara!`,
        detailedAnswer: `🏥 YANIK DERECELERİNE GÖRE:

1️⃣ BİRİNCİ DERECE:
• Kızarıklık, ağrı
• Evde tedavi yeterli
• Soğuk su + nemlendirici

2️⃣ İKİNCİ DERECE:
• Kabarcık, şiddetli ağrı
• Kabarcığı patlatma
• Steril örtü + doktora git

3️⃣ ÜÇÜNCÜ DERECE:
• Deri beyaz veya siyah
• Ağrı az (sinirler hasar görmüş)
• ACİL 112

⚡ ELEKTRİK YANIĞI:
1. Elektriği kes
2. Kişiye dokunma
3. 112 ara
4. Giriş ve çıkış yarası olabilir

🔥 ALEVLİ GİYSİ:
• Dur-Yat-Yuvarlan!
• Battaniye ile ört
• Giysiiyi zorla çıkarma`,
        emergencyLevel: 'urgent',
        requiresAction: false,
        actionType: 'none',
        source: 'Türk Kızılay',
    },
];

// ============================================================================
// SHOCK - ŞOK
// ============================================================================

export const SHOCK_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_shock_001',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 1,
        keywords: ['şok', 'bayılma', 'solgun', 'terleme', 'bilinç'],
        questionVariations: [
            'Şok durumunda ne yapmalı?',
            'Birisi bayılıyor',
            'Çok solgun ve terliyor',
            'Şok belirtileri neler?',
        ],
        answer: `🚨 ŞOK DURUMU İLK YARDIM:

BELİRTİLER:
• Solgun, soğuk, nemli cilt
• Hızlı, zayıf nabız
• Hızlı soluma
• Baş dönmesi, bulantı

İLK YARDIM:
1️⃣ Sırtüstü yatır
2️⃣ Bacakları 30cm yukarı kaldır
3️⃣ Üstünü ört (ısıt)
4️⃣ Sakinleştir
5️⃣ 112'yi ara

🚫 Su veya yiyecek verme!`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'UMKE',
    },
];

// ============================================================================
// CPR - KALP MASAJI
// ============================================================================

export const CPR_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_cpr_001',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 1,
        keywords: ['kalp', 'masaj', 'cpr', 'nefes', 'atmıyor', 'durmuş'],
        questionVariations: [
            'Kalp masajı nasıl yapılır?',
            'CPR nasıl uygulanır?',
            'Kişi nefes almıyor',
            'Kalp durdu ne yapayım?',
        ],
        answer: `❤️ KALP MASAJI (CPR):

1️⃣ GÜVENLİK KONTROLÜ
   • Ortam güvenli mi?

2️⃣ BİLİNÇ KONTROLÜ
   • Omuzlarına dokun, seslen

3️⃣ 112'Yİ ARA
   • Hoparlöre al, yanında tut

4️⃣ KALP MASAJI
   • Göğüs ortasına ellerini koy
   • 5-6 cm bastır
   • Dakikada 100-120 baskı
   • "Stayin' Alive" şarkısı ritmi

5️⃣ AMBULANS GELENE KADAR DEVAM

⚠️ Yorulursan başkasıyla değiş!`,
        detailedAnswer: `🏥 ADIM ADIM CPR:

📌 BİLİNÇ VE SOLUNUM:
1. Omuzlarına dokun
2. "İyi misiniz?" diye sor
3. Yanıt yoksa 112 ara
4. Göğsün inip kalktığına bak (10 sn)

❤️ GÖĞÜS BASKISI:
• Sert zemine yatır
• Göğüs kemiğinin ortası
• İki eli üst üste koy
• Kollar dik, dirsek bükülmez
• 5-6 cm derinlikte bas
• 100-120/dakika hız

💨 SUNI SOLUNUM (Eğitimli iseniz):
• Başı geriye yatır
• Çeneyi yukarı kaldır
• Burnunu kapat
• 2 solunum ver
• 30 baskı / 2 solunum

⏱️ DEVAM:
• Ambulans gelene
• Kişi hareket edene
• Çok yorulana kadar

👶 BEBEK/ÇOCUK:
• 2 parmakla bastır
• Daha hafif basınç
• 100-120/dakika`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'AHA Guidelines',
    },
];

// ============================================================================
// CHOKING - BOĞULMA
// ============================================================================

export const CHOKING_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_choking_001',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 1,
        keywords: ['boğulma', 'tıkandı', 'nefes', 'alamıyor', 'boğazı'],
        questionVariations: [
            'Boğulan birine ne yapmalı?',
            'Bir şey boğazına kaçtı',
            'Nefes alamıyor ne yapayım?',
            'Heimlich manevrası nasıl?',
        ],
        answer: `🆘 BOĞULMA - HEIMLICH MANEVRAS:

HAFIF TIKAMA (Öksürebiliyor):
• Öksürmeye teşvik et
• Sırtına vurma

TAM TIKAMA (Öksüremiyor):
1. Arkasına geç
2. Kollarını karnına sar
3. Yumruğunu göbeğin üstüne koy
4. Yukarı-içeri çek (5 kez)
5. Cisim çıkana kadar tekrarla

👶 BEBEK (1 yaş altı):
• Ters çevir
• Sırtına 5 vuruş
• Çevir, 5 göğüs baskısı

⚠️ Bilinç kaybederse CPR başla!`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'Türk Kızılay',
    },
];

// ============================================================================
// EARTHQUAKE INJURIES - DEPREM YARALANMALARI
// ============================================================================

export const EARTHQUAKE_INJURY_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_eq_injury_001',
        intent: 'INJURY',
        category: 'first_aid',
        priority: 1,
        keywords: ['deprem', 'yaralanma', 'enkaz', 'ezilme', 'crush'],
        questionVariations: [
            'Depremde yaralanan birine ne yapmalı?',
            'Enkaz altından çıkan kişiye ilk yardım?',
            'Ezilme sendromu nedir?',
        ],
        answer: `🚨 DEPREM YARALANMASI İLK YARDIM:

⚠️ EZİLME SENDROMU:
4+ saat sıkışan uzuv tehlikeli!

1️⃣ Acil hareket ettirme
2️⃣ 112'yi hemen ara
3️⃣ Bilinci kontrol et
4️⃣ Kanamayı kontrol et
5️⃣ Isı koruması sağla
6️⃣ Sıvı verme (kusabilir)

🏥 AMBULANS BEKLERKEN:
• Sakin tut, konuş
• Vücut ısısını koru
• Şok pozisyonu
• Kırıkları hareket ettirme`,
        emergencyLevel: 'critical',
        requiresAction: true,
        actionType: 'call',
        source: 'UMKE Deprem Rehberi',
    },
    {
        id: 'fa_eq_injury_002',
        intent: 'INJURY',
        category: 'first_aid',
        priority: 1,
        keywords: ['toz', 'solumak', 'maske', 'nefes', 'darlığı'],
        questionVariations: [
            'Toz soludum ne yapmalıyım?',
            'Enkaz tozundan korunma?',
            'Nefes almak zorlaşıyor',
        ],
        answer: `💨 TOZ VE SOLUNUM:

KORUNMA:
• Ağız ve burnunu bez ile kapat
• N95 maske kullan (varsa)
• Tozlu alanlardan uzaklaş

BELİRTİLER:
• Öksürük
• Nefes darlığı
• Göz yanması

İLK YARDIM:
1. Temiz havaya çık
2. Bol su iç
3. Gözleri suyla yıka
4. Şiddetli belirtide 112 ara

⚠️ Asbest içeren eski binalarda özellikle dikkat!`,
        emergencyLevel: 'urgent',
        requiresAction: false,
        actionType: 'none',
        source: 'Sağlık Bakanlığı',
    },
];

// ============================================================================
// PSYCHOLOGICAL FIRST AID - PSİKOLOJİK İLK YARDIM
// ============================================================================

export const PSYCHOLOGICAL_FIRST_AID: KnowledgeEntry[] = [
    {
        id: 'fa_psych_001',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 2,
        keywords: ['panik', 'korku', 'stres', 'travma', 'sakinleş'],
        questionVariations: [
            'Panik atak geçiriyorum',
            'Çok korkuyorum ne yapmalı?',
            'Sakinleşemiyorum',
            'Travma sonrası ne yapmalı?',
        ],
        answer: `🧘 PANİK VE KORKU YÖNETİMİ:

NEFES EGZERSİZİ (4-7-8):
1. 4 saniye nefes al
2. 7 saniye tut
3. 8 saniye yavaşça ver
4. 4-5 kez tekrarla

TOPRAKLANMA (5-4-3-2-1):
• 5 şey GÖR
• 4 şey DOKUN
• 3 şey DUYUM
• 2 şey KOKLA
• 1 şey TAT

💬 KENDİNE SÖYLE:
"Bu geçici. Güvendeyim. Başa çıkabilirim."

📞 182 ALO Psikiyatri Hattı`,
        emergencyLevel: 'urgent',
        requiresAction: false,
        actionType: 'none',
        source: 'Türk Psikologlar Derneği',
    },
    {
        id: 'fa_psych_002',
        intent: 'FIRST_AID',
        category: 'first_aid',
        priority: 2,
        keywords: ['çocuk', 'korkuyor', 'ağlıyor', 'travma', 'koruma'],
        questionVariations: [
            'Çocuğum çok korkuyor',
            'Çocukla deprem sonrası konuşma',
            'Çocuğu nasıl sakinleştiririm?',
        ],
        answer: `👧 ÇOCUKLA DEPREM SONRASI:

YAPILACAKLAR:
1. Sarıl, fiziksel temas kur
2. "Güvendesin" de
3. Duygularını ifade etmesine izin ver
4. Basit ve dürüst bilgi ver
5. Rutinlere dön

YAPILMAYACAKLAR:
• Haberleri sürekli izlettirme
• "Korkma" deme
• Detaylı görüntüler gösterme
• Yalnız bırakma

🎨 YARDIMCI AKTİVİTELER:
• Resim çizdirme
• Oyun oynama
• Hikaye anlatma

📞 Uzun süren belirtilerde uzman desteği al`,
        emergencyLevel: 'normal',
        requiresAction: false,
        actionType: 'none',
        source: 'UNICEF',
    },
];

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const ALL_FIRST_AID_FAQ: KnowledgeEntry[] = [
    ...BLEEDING_FIRST_AID,
    ...FRACTURE_FIRST_AID,
    ...BURN_FIRST_AID,
    ...SHOCK_FIRST_AID,
    ...CPR_FIRST_AID,
    ...CHOKING_FIRST_AID,
    ...EARTHQUAKE_INJURY_FIRST_AID,
    ...PSYCHOLOGICAL_FIRST_AID,
];

export const FIRST_AID_COUNT = ALL_FIRST_AID_FAQ.length;
