/**
 * OFFLINE KNOWLEDGE BASE
 * Main index file that combines all knowledge sources
 * Provides fast offline search and retrieval
 */

import { ALL_EARTHQUAKE_FAQ, FAQ_BY_ID, FAQ_BY_INTENT, KnowledgeEntry } from './earthquakeFAQ';
import { ALL_FIRST_AID_FAQ } from './firstAidGuide';
import { UserIntent, INTENT_PATTERNS, IntentMatch, INTENT_EMERGENCY_LEVEL } from '../types/intent.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OfflineKnowledgeBase');

// ============================================================================
// Combined Knowledge Base
// ============================================================================

export const ALL_KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
    ...ALL_EARTHQUAKE_FAQ,
    ...ALL_FIRST_AID_FAQ,
];

// Quick lookup maps
const KNOWLEDGE_BY_ID = new Map<string, KnowledgeEntry>();
const KNOWLEDGE_BY_INTENT = new Map<UserIntent, KnowledgeEntry[]>();
const KEYWORD_INDEX = new Map<string, KnowledgeEntry[]>();

// Initialize indexes
function initializeIndexes(): void {
    // Clear existing
    KNOWLEDGE_BY_ID.clear();
    KNOWLEDGE_BY_INTENT.clear();
    KEYWORD_INDEX.clear();

    for (const entry of ALL_KNOWLEDGE_ENTRIES) {
        // ID index
        KNOWLEDGE_BY_ID.set(entry.id, entry);

        // Intent index
        const intentEntries = KNOWLEDGE_BY_INTENT.get(entry.intent) || [];
        intentEntries.push(entry);
        KNOWLEDGE_BY_INTENT.set(entry.intent, intentEntries);

        // Keyword index
        for (const keyword of entry.keywords) {
            const normalizedKeyword = normalizeText(keyword);
            const keywordEntries = KEYWORD_INDEX.get(normalizedKeyword) || [];
            keywordEntries.push(entry);
            KEYWORD_INDEX.set(normalizedKeyword, keywordEntries);
        }
    }

    logger.info(`Offline Knowledge Base initialized with ${ALL_KNOWLEDGE_ENTRIES.length} entries`);
}

// Initialize on module load
initializeIndexes();

// ============================================================================
// Text Normalization
// ============================================================================

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^\w\s]/g, '')
        .trim();
}

function tokenize(text: string): string[] {
    return normalizeText(text).split(/\s+/).filter(t => t.length > 1);
}

// ============================================================================
// Intent Classification
// ============================================================================

export function classifyIntent(message: string): IntentMatch {
    const normalizedMessage = normalizeText(message);
    const tokens = tokenize(message);

    let bestMatch: IntentMatch = {
        intent: 'UNKNOWN',
        confidence: 0,
        matchedKeywords: [],
        matchedPattern: undefined,
    };

    // Check patterns first (higher accuracy)
    for (const pattern of INTENT_PATTERNS) {
        for (const regex of pattern.patterns) {
            if (regex.test(message)) {
                const confidence = 0.9 - (pattern.priority * 0.05); // Priority affects confidence
                if (confidence > bestMatch.confidence) {
                    bestMatch = {
                        intent: pattern.intent,
                        confidence,
                        matchedKeywords: [],
                        matchedPattern: regex.source,
                    };
                }
            }
        }
    }

    // If no pattern match, try keyword matching
    if (bestMatch.confidence < 0.5) {
        for (const pattern of INTENT_PATTERNS) {
            const matchedKeywords: string[] = [];

            for (const keyword of pattern.keywords) {
                const normalizedKeyword = normalizeText(keyword);
                if (normalizedMessage.includes(normalizedKeyword)) {
                    matchedKeywords.push(keyword);
                }
            }

            if (matchedKeywords.length > 0) {
                const keywordConfidence = Math.min(0.8, 0.3 + (matchedKeywords.length * 0.15));
                const priorityAdjusted = keywordConfidence - (pattern.priority * 0.03);

                if (priorityAdjusted > bestMatch.confidence) {
                    bestMatch = {
                        intent: pattern.intent,
                        confidence: priorityAdjusted,
                        matchedKeywords,
                        matchedPattern: undefined,
                    };
                }
            }
        }
    }

    // Default to GENERAL if still low confidence
    if (bestMatch.confidence < 0.2) {
        bestMatch.intent = 'GENERAL';
        bestMatch.confidence = 0.3;
    }

    return bestMatch;
}

// ============================================================================
// Knowledge Search
// ============================================================================

export interface SearchResult {
    entry: KnowledgeEntry;
    score: number;
    matchedKeywords: string[];
}

export function searchKnowledge(query: string, limit: number = 5): SearchResult[] {
    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);
    const results: SearchResult[] = [];

    for (const entry of ALL_KNOWLEDGE_ENTRIES) {
        let score = 0;
        const matchedKeywords: string[] = [];

        // Check question variations (exact match = high score)
        for (const variation of entry.questionVariations) {
            const normalizedVariation = normalizeText(variation);
            if (normalizedQuery === normalizedVariation) {
                score += 10;
                matchedKeywords.push(variation);
            } else if (normalizedQuery.includes(normalizedVariation) || normalizedVariation.includes(normalizedQuery)) {
                score += 5;
                matchedKeywords.push(variation);
            }
        }

        // Check keywords
        for (const keyword of entry.keywords) {
            const normalizedKeyword = normalizeText(keyword);
            if (normalizedQuery.includes(normalizedKeyword)) {
                score += 2;
                matchedKeywords.push(keyword);
            }
        }

        // Token overlap scoring
        for (const token of queryTokens) {
            for (const keyword of entry.keywords) {
                const keywordTokens = tokenize(keyword);
                if (keywordTokens.includes(token)) {
                    score += 1;
                }
            }
        }

        // Priority boost
        score += (4 - entry.priority) * 0.5;

        if (score > 0) {
            results.push({ entry, score, matchedKeywords });
        }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
}

// ============================================================================
// Get Answer
// ============================================================================

export interface OfflineAnswer {
    answer: string;
    detailedAnswer?: string;
    confidence: number;
    intent: UserIntent;
    emergencyLevel: 'normal' | 'urgent' | 'critical';
    source: 'offline';
    entryId?: string;
    relatedEntries?: string[];
}

export function getOfflineAnswer(message: string): OfflineAnswer {
    // 1. Classify intent
    const intentMatch = classifyIntent(message);

    // 2. Search knowledge base
    const searchResults = searchKnowledge(message, 3);

    // 3. Get best match
    if (searchResults.length > 0 && searchResults[0].score >= 2) {
        const bestResult = searchResults[0];
        return {
            answer: bestResult.entry.answer,
            detailedAnswer: bestResult.entry.detailedAnswer,
            confidence: Math.min(0.95, intentMatch.confidence + (bestResult.score * 0.05)),
            intent: intentMatch.intent,
            emergencyLevel: bestResult.entry.emergencyLevel,
            source: 'offline',
            entryId: bestResult.entry.id,
            relatedEntries: bestResult.entry.relatedEntries,
        };
    }

    // 4. Fallback to intent-based response
    const intentEntries = KNOWLEDGE_BY_INTENT.get(intentMatch.intent);
    if (intentEntries && intentEntries.length > 0) {
        const entry = intentEntries[0];
        return {
            answer: entry.answer,
            detailedAnswer: entry.detailedAnswer,
            confidence: intentMatch.confidence * 0.8,
            intent: intentMatch.intent,
            emergencyLevel: entry.emergencyLevel,
            source: 'offline',
            entryId: entry.id,
        };
    }

    // 5. Default fallback
    return {
        answer: `Anlıyorum. Şu konularda size yardımcı olabilirim:

🌍 Deprem ve afet güvenliği
🏥 İlk yardım rehberi
📋 Afet hazırlık planı
📊 Risk değerlendirmesi

Lütfen daha spesifik bir soru sorun veya yukarıdaki konulardan birini seçin.`,
        confidence: 0.3,
        intent: 'UNKNOWN',
        emergencyLevel: 'normal',
        source: 'offline',
    };
}

// ============================================================================
// Emergency Detection
// ============================================================================

export function isEmergencyQuery(message: string): boolean {
    const intentMatch = classifyIntent(message);
    return INTENT_EMERGENCY_LEVEL[intentMatch.intent] === 'critical';
}

export function getEmergencyLevel(message: string): 'normal' | 'urgent' | 'critical' {
    const intentMatch = classifyIntent(message);
    return INTENT_EMERGENCY_LEVEL[intentMatch.intent] || 'normal';
}

// ============================================================================
// Quick Responses for Common Queries
// ============================================================================

export const QUICK_RESPONSES: Record<string, string> = {
    'deprem': 'Deprem hakkında ne bilmek istiyorsunuz? Hazırlık, deprem anında yapılacaklar, ya da deprem sonrası mı?',
    'yardım': 'Acil yardım için 112\'yi arayın. Size nasıl yardımcı olabilirim?',
    'korku': 'Sakin olmaya çalışın. Derin nefes alın. Size yardımcı olmak için buradayım.',
};

// ============================================================================
// Statistics
// ============================================================================

export const KNOWLEDGE_STATS = {
    totalEntries: ALL_KNOWLEDGE_ENTRIES.length,
    earthquakeFAQ: ALL_EARTHQUAKE_FAQ.length,
    firstAidFAQ: ALL_FIRST_AID_FAQ.length,
    intentPatterns: INTENT_PATTERNS.length,
    uniqueKeywords: KEYWORD_INDEX.size,
};

export type { KnowledgeEntry } from './earthquakeFAQ';
export type { UserIntent, IntentMatch } from '../types/intent.types';

