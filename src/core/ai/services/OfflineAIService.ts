/**
 * OFFLINE AI SERVICE
 * Provides AI responses when device is offline
 * Uses local knowledge base for instant answers
 */

import {
    getOfflineAnswer,
    classifyIntent,
    searchKnowledge,
    isEmergencyQuery,
    getEmergencyLevel,
    KNOWLEDGE_STATS,
    OfflineAnswer,
} from '../data/offlineKnowledgeBase';
import { UserIntent, INTENT_EMERGENCY_LEVEL } from '../types/intent.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OfflineAIService');

export interface AIResponse {
    answer: string;
    detailedAnswer?: string;
    confidence: number;
    intent: UserIntent;
    source: 'openai' | 'offline' | 'hybrid';
    emergencyLevel: 'normal' | 'urgent' | 'critical';
    relatedTopics?: string[];
    suggestedActions?: SuggestedAction[];
    responseTime: number; // ms
}

export interface SuggestedAction {
    id: string;
    label: string;
    icon: string;
    action: 'call' | 'navigate' | 'share' | 'info';
    data?: string;
}

class OfflineAIService {
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        logger.info('OfflineAIService initialized', {
            totalEntries: KNOWLEDGE_STATS.totalEntries,
            uniqueKeywords: KNOWLEDGE_STATS.uniqueKeywords,
        });

        this.isInitialized = true;
    }

    /**
     * Get an AI response using only offline knowledge base
     * Response time target: <200ms
     */
    async getResponse(message: string): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            if (!message || message.trim().length === 0) {
                return this.createEmptyResponse(startTime);
            }

            const offlineAnswer = getOfflineAnswer(message.trim());
            const endTime = Date.now();

            // Build suggested actions based on intent
            const suggestedActions = this.getSuggestedActions(offlineAnswer.intent, offlineAnswer.emergencyLevel);

            // Build related topics
            const relatedTopics = this.getRelatedTopics(offlineAnswer.intent);

            return {
                answer: offlineAnswer.answer,
                detailedAnswer: offlineAnswer.detailedAnswer,
                confidence: offlineAnswer.confidence,
                intent: offlineAnswer.intent,
                source: 'offline',
                emergencyLevel: offlineAnswer.emergencyLevel,
                suggestedActions,
                relatedTopics,
                responseTime: endTime - startTime,
            };
        } catch (error) {
            logger.error('Error getting offline response:', error);
            return this.createFallbackResponse(startTime);
        }
    }

    /**
     * Check if a message is an emergency query
     */
    isEmergency(message: string): boolean {
        return isEmergencyQuery(message);
    }

    /**
     * Get emergency level for a message
     */
    getEmergencyLevel(message: string): 'normal' | 'urgent' | 'critical' {
        return getEmergencyLevel(message);
    }

    /**
     * Classify user intent
     */
    classifyIntent(message: string) {
        return classifyIntent(message);
    }

    /**
     * Search knowledge base
     */
    searchKnowledge(query: string, limit?: number) {
        return searchKnowledge(query, limit);
    }

    private getSuggestedActions(intent: UserIntent, emergencyLevel: string): SuggestedAction[] {
        const actions: SuggestedAction[] = [];

        // Emergency actions
        if (emergencyLevel === 'critical') {
            actions.push({
                id: 'call_112',
                label: '112\'yi Ara',
                icon: 'call',
                action: 'call',
                data: '112',
            });
            actions.push({
                id: 'sos',
                label: 'SOS Gönder',
                icon: 'alert-circle',
                action: 'share',
            });
        }

        // Intent-specific actions
        switch (intent) {
            case 'EARTHQUAKE_NOW':
            case 'TRAPPED':
                actions.push({
                    id: 'share_location',
                    label: 'Konum Paylaş',
                    icon: 'location',
                    action: 'share',
                });
                break;
            case 'FIRST_AID':
                actions.push({
                    id: 'first_aid_guide',
                    label: 'İlk Yardım Rehberi',
                    icon: 'medkit',
                    action: 'navigate',
                    data: 'first_aid',
                });
                break;
            case 'PREPAREDNESS':
                actions.push({
                    id: 'preparedness_plan',
                    label: 'Hazırlık Planı',
                    icon: 'list',
                    action: 'navigate',
                    data: 'preparedness',
                });
                break;
            case 'EVACUATION':
                actions.push({
                    id: 'map',
                    label: 'Harita',
                    icon: 'map',
                    action: 'navigate',
                    data: 'map',
                });
                break;
            case 'RISK_QUERY':
                actions.push({
                    id: 'risk_score',
                    label: 'Risk Skoru',
                    icon: 'analytics',
                    action: 'navigate',
                    data: 'risk',
                });
                break;
        }

        return actions;
    }

    private getRelatedTopics(intent: UserIntent): string[] {
        const topicMap: Record<string, string[]> = {
            EARTHQUAKE_NOW: ['Deprem sonrası', 'İlk yardım', 'Toplanma alanları'],
            TRAPPED: ['Hayatta kalma', 'Sinyal verme', '112 arama'],
            FIRST_AID: ['Kanama kontrolü', 'Kırık tedavi', 'Kalp masajı'],
            PREPAREDNESS: ['Deprem çantası', 'Aile planı', 'Ev güvenliği'],
            EVACUATION: ['Toplanma alanları', 'Tahliye rotası', 'Güvenli bölgeler'],
            RISK_QUERY: ['Bina güvenliği', 'Fay hatları', 'Bölgesel risk'],
        };

        return topicMap[intent] || [];
    }

    private createEmptyResponse(startTime: number): AIResponse {
        return {
            answer: 'Lütfen bir soru yazın. Size deprem, afet güvenliği ve ilk yardım konularında yardımcı olabilirim.',
            confidence: 1,
            intent: 'UNKNOWN',
            source: 'offline',
            emergencyLevel: 'normal',
            responseTime: Date.now() - startTime,
        };
    }

    private createFallbackResponse(startTime: number): AIResponse {
        return {
            answer: `Şu an yanıt oluşturulamadı. Acil durumda:

🆘 112'yi arayın
📍 Güvenli bir yere gidin
👨‍👩‍👧 Ailenizle iletişim kurun`,
            confidence: 0.5,
            intent: 'UNKNOWN',
            source: 'offline',
            emergencyLevel: 'normal',
            responseTime: Date.now() - startTime,
        };
    }

    /**
     * Get knowledge base statistics
     */
    getStats() {
        return KNOWLEDGE_STATS;
    }
}

export const offlineAIService = new OfflineAIService();
