/**
 * USER INTENT TYPES
 * Defines all possible user intents for AI classification
 */

export type UserIntent =
    // EMERGENCY (Highest Priority)
    | 'EARTHQUAKE_NOW'      // "Deprem oluyor!"
    | 'NEED_HELP'           // "Yardım lazım!"
    | 'TRAPPED'             // "Enkaz altındayım"
    | 'INJURY'              // "Yaralandım"
    | 'FIRE'                // "Yangın var!"
    | 'FLOOD'               // "Sel var!"

    // SAFETY ACTIONS
    | 'WHAT_TO_DO'          // "Ne yapmalıyım?"
    | 'EVACUATION'          // "Nereye sığınmalıyım?"
    | 'FIRST_AID'           // "İlk yardım nasıl?"
    | 'FAMILY_SAFETY'       // "Ailem güvende mi?"

    // INFORMATION
    | 'EARTHQUAKE_INFO'     // "Son deprem nerede?"
    | 'RISK_QUERY'          // "Bölgem riskli mi?"
    | 'PREPAREDNESS'        // "Nasıl hazırlanmalıyım?"
    | 'BUILDING_SAFETY'     // "Binam güvenli mi?"

    // GENERAL
    | 'APP_HELP'            // "Uygulama nasıl çalışır?"
    | 'GREETING'            // "Merhaba"
    | 'THANKS'              // "Teşekkürler"
    | 'GENERAL'             // Everything else
    | 'UNKNOWN';            // Cannot classify

export interface IntentMatch {
    intent: UserIntent;
    confidence: number; // 0-1
    matchedKeywords: string[];
    matchedPattern?: string;
}

export interface IntentPattern {
    intent: UserIntent;
    patterns: RegExp[];
    keywords: string[];
    priority: number; // Lower = higher priority
}

// Intent patterns for classification
export const INTENT_PATTERNS: IntentPattern[] = [
    // CRITICAL EMERGENCY - Highest Priority
    {
        intent: 'EARTHQUAKE_NOW',
        patterns: [
            /deprem\s*(oluyor|oldu|var|şu\s*an)/i,
            /sallant[iı]\s*(var|oluyor)/i,
            /sars[iı]nt[iı]/i,
            /yer\s*sallans/i,
        ],
        keywords: ['deprem oluyor', 'sallantı', 'sarsıntı', 'yer sallanıyor', 'şu an deprem'],
        priority: 1,
    },
    {
        intent: 'TRAPPED',
        patterns: [
            /enkaz\s*(alt[iı]nda|alt[iı]nday[iı]m)/i,
            /mahsur\s*(kald[iı]m|kal)/i,
            /s[iı]k[iı][sş]t[iı]m/i,
            /ç[iı]kam[iı]yorum/i,
            /g[oö]m[uü]ld[uü]m/i,
        ],
        keywords: ['enkaz', 'mahsur', 'sıkıştım', 'çıkamıyorum', 'altındayım'],
        priority: 1,
    },
    {
        intent: 'NEED_HELP',
        patterns: [
            /yard[iı]m\s*(laz[iı]m|et|iste)/i,
            /imdat/i,
            /acil\s*(yard[iı]m|durum)/i,
            /kurtarın/i,
        ],
        keywords: ['yardım', 'imdat', 'acil', 'kurtarın', 'yardım edin'],
        priority: 1,
    },
    {
        intent: 'INJURY',
        patterns: [
            /yaraland[iı]m/i,
            /kan\s*(ak[iı]yor|var)/i,
            /k[iı]r[iı]k/i,
            /yan[iı]k/i,
            /ac[iı]\s*(var|çek|hissed)/i,
        ],
        keywords: ['yaralandım', 'kan', 'kırık', 'yanık', 'acı', 'ağrı'],
        priority: 1,
    },

    // FIRST AID
    {
        intent: 'FIRST_AID',
        patterns: [
            /ilk\s*yard[iı]m/i,
            /nas[iı]l\s*(tedavi|iyile[sş])/i,
            /kan\s*durdu/i,
            /sarg[iı]/i,
        ],
        keywords: ['ilk yardım', 'tedavi', 'sargı', 'bandaj', 'kanaması'],
        priority: 2,
    },

    // WHAT TO DO
    {
        intent: 'WHAT_TO_DO',
        patterns: [
            /ne\s*yapmal[iı]/i,
            /nas[iı]l\s*yapmal[iı]/i,
            /ne\s*yapay[iı]m/i,
            /şimdi\s*ne/i,
        ],
        keywords: ['ne yapmalı', 'nasıl', 'ne yapayım', 'yapmalıyım'],
        priority: 2,
    },

    // EVACUATION
    {
        intent: 'EVACUATION',
        patterns: [
            /(nereye|nerede)\s*(s[iı][gğ][iı]n|git|tahliye)/i,
            /toplanma\s*(alan|yer|nokta)/i,
            /tahliye/i,
            /güvenli\s*(yer|alan)/i,
        ],
        keywords: ['nereye', 'sığınak', 'toplanma', 'tahliye', 'güvenli yer'],
        priority: 2,
    },

    // EARTHQUAKE INFO
    {
        intent: 'EARTHQUAKE_INFO',
        patterns: [
            /son\s*deprem/i,
            /deprem\s*(nerede|oldu|var\s*m[iı])/i,
            /kaç\s*(şiddet|büyüklük)/i,
            /bugün\s*deprem/i,
        ],
        keywords: ['son deprem', 'deprem nerede', 'büyüklük', 'şiddet'],
        priority: 3,
    },

    // RISK QUERY
    {
        intent: 'RISK_QUERY',
        patterns: [
            /risk(li)?\s*(m[iı]|var|ne)/i,
            /fay\s*(hatt[iı]|bölge)/i,
            /tehlike(li)?\s*(m[iı]|var)/i,
            /güven(de|li)\s*(m[iı]yim|mi)/i,
        ],
        keywords: ['riskli', 'fay', 'tehlike', 'güvenli', 'bölge riski'],
        priority: 3,
    },

    // PREPAREDNESS
    {
        intent: 'PREPAREDNESS',
        patterns: [
            /haz[iı]r(l[iı]k|lan)/i,
            /deprem\s*çantas[iı]/i,
            /ne\s*almal[iı]/i,
            /plan\s*yap/i,
        ],
        keywords: ['hazırlık', 'hazırlan', 'çanta', 'plan', 'malzeme'],
        priority: 3,
    },

    // BUILDING SAFETY
    {
        intent: 'BUILDING_SAFETY',
        patterns: [
            /bina(m)?\s*(güvenli|riskli|sağlam)/i,
            /ev(im)?\s*(güvenli|sağlam)/i,
            /yap[iı]\s*(kontrolü|güvenli)/i,
            /çatlak/i,
        ],
        keywords: ['bina', 'ev', 'güvenli', 'sağlam', 'çatlak', 'yapı'],
        priority: 3,
    },

    // APP HELP
    {
        intent: 'APP_HELP',
        patterns: [
            /uygulama\s*(nas[iı]l|ne)/i,
            /afetnet\s*nas[iı]l/i,
            /bu\s*uygulama/i,
            /özellik(ler)?/i,
        ],
        keywords: ['uygulama', 'afetnet', 'nasıl kullanılır', 'özellik'],
        priority: 4,
    },

    // GREETING
    {
        intent: 'GREETING',
        patterns: [
            /^merhaba$/i,
            /^selam$/i,
            /^günayd[iı]n$/i,
            /^iyi\s*(akşam|gün)lar$/i,
        ],
        keywords: ['merhaba', 'selam', 'günaydın', 'iyi akşamlar'],
        priority: 5,
    },

    // THANKS
    {
        intent: 'THANKS',
        patterns: [
            /teşekkür/i,
            /sağ\s*ol/i,
            /mersi/i,
            /eyvallah/i,
        ],
        keywords: ['teşekkür', 'sağol', 'mersi'],
        priority: 5,
    },
];

// Emergency level mapping
export const INTENT_EMERGENCY_LEVEL: Record<UserIntent, 'critical' | 'urgent' | 'normal'> = {
    EARTHQUAKE_NOW: 'critical',
    TRAPPED: 'critical',
    NEED_HELP: 'critical',
    INJURY: 'critical',
    FIRE: 'critical',
    FLOOD: 'critical',
    WHAT_TO_DO: 'urgent',
    EVACUATION: 'urgent',
    FIRST_AID: 'urgent',
    FAMILY_SAFETY: 'urgent',
    EARTHQUAKE_INFO: 'normal',
    RISK_QUERY: 'normal',
    PREPAREDNESS: 'normal',
    BUILDING_SAFETY: 'normal',
    APP_HELP: 'normal',
    GREETING: 'normal',
    THANKS: 'normal',
    GENERAL: 'normal',
    UNKNOWN: 'normal',
};
