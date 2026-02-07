/**
 * useMapVoiceGuidance — FAZ 6
 * 
 * Integrates VoiceEvacuationService with map events.
 * Announces EEW warnings, safe zone directions, and family status changes via TTS.
 */

import { useCallback, useRef, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('MapVoiceGuidance');

// Lazy import to avoid circular deps
let voiceService: any = null;
const getVoiceService = () => {
    if (!voiceService) {
        try {
            voiceService = require('../services/VoiceEvacuationService');
        } catch {
            logger.warn('VoiceEvacuationService not available');
        }
    }
    return voiceService;
};

// Lazy import expo-speech
let Speech: any = null;
const getSpeech = async () => {
    if (!Speech) {
        try {
            Speech = await import('expo-speech');
        } catch {
            logger.warn('expo-speech not available');
        }
    }
    return Speech;
};

interface VoiceGuidanceOptions {
    /** Whether voice guidance is enabled */
    enabled?: boolean;
    /** Language for TTS (default: tr-TR) */
    language?: string;
}

export function useMapVoiceGuidance(options: VoiceGuidanceOptions = {}) {
    const { enabled = true, language = 'tr-TR' } = options;
    const lastAnnouncementRef = useRef<string>('');
    const lastAnnouncementTimeRef = useRef<number>(0);

    // Prevent duplicate announcements within 10 seconds
    const speak = useCallback(async (text: string, priority: 'normal' | 'urgent' = 'normal') => {
        if (!enabled) return;

        const now = Date.now();
        if (text === lastAnnouncementRef.current && now - lastAnnouncementTimeRef.current < 10000) {
            return; // Skip duplicate within 10s
        }

        lastAnnouncementRef.current = text;
        lastAnnouncementTimeRef.current = now;

        try {
            const speech = await getSpeech();
            if (!speech) return;

            // Stop any current speech for urgent messages
            if (priority === 'urgent') {
                await speech.stop();
            }

            await speech.speak(text, {
                language,
                rate: priority === 'urgent' ? 1.2 : 0.95,
                pitch: priority === 'urgent' ? 1.1 : 1.0,
            });
        } catch (error) {
            logger.warn('TTS failed:', error);
        }
    }, [enabled, language]);

    /** Announce EEW wave arrival countdown */
    const announceEEWCountdown = useCallback((secondsRemaining: number) => {
        if (secondsRemaining <= 0) {
            speak('DİKKAT! Deprem dalgası ulaştı! Güvenli pozisyon alın!', 'urgent');
        } else if (secondsRemaining <= 5) {
            speak(`Deprem dalgası ${secondsRemaining} saniye sonra ulaşacak! Yere çömelip başınızı koruyun!`, 'urgent');
        } else if (secondsRemaining <= 15) {
            speak(`Deprem dalgası ${secondsRemaining} saniye sonra ulaşacak. Güvenli bir yere geçin.`, 'urgent');
        } else if (secondsRemaining <= 30) {
            speak(`Deprem erken uyarısı. Tahmini varış: ${secondsRemaining} saniye.`, 'normal');
        }
    }, [speak]);

    /** Announce safe zone direction and distance */
    const announceSafeZone = useCallback((zoneName: string, distanceKm: number, walkingMinutes: number) => {
        if (distanceKm < 0.5) {
            speak(`${zoneName} toplanma alanı ${Math.round(distanceKm * 1000)} metre uzakta. Tahmini ${walkingMinutes} dakika yürüme.`);
        } else {
            speak(`En yakın güvenli bölge: ${zoneName}. ${distanceKm.toFixed(1)} kilometre uzakta. Tahmini ${walkingMinutes} dakika yürüme.`);
        }
    }, [speak]);

    /** Announce family member status change */
    const announceFamilyStatus = useCallback((memberName: string, status: string) => {
        const statusMap: Record<string, string> = {
            'safe': 'güvende bildirildi',
            'need-help': 'yardım istiyor',
            'critical': 'acil durumda',
            'unknown': 'durumu bilinmiyor',
        };
        const statusText = statusMap[status] || status;
        speak(`${memberName} ${statusText}.`, status === 'critical' ? 'urgent' : 'normal');
    }, [speak]);

    /** Announce earthquake detection */
    const announceEarthquake = useCallback((magnitude: number, location: string, distanceKm?: number) => {
        let text = `${magnitude.toFixed(1)} büyüklüğünde deprem. ${location}.`;
        if (distanceKm !== undefined) {
            text += ` Size ${distanceKm.toFixed(0)} kilometre uzakta.`;
        }
        speak(text, magnitude >= 4.0 ? 'urgent' : 'normal');
    }, [speak]);

    /** Stop all speech */
    const stopSpeaking = useCallback(async () => {
        try {
            const speech = await getSpeech();
            if (speech) await speech.stop();
        } catch { /* ignore */ }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopSpeaking();
        };
    }, [stopSpeaking]);

    return {
        speak,
        announceEEWCountdown,
        announceSafeZone,
        announceFamilyStatus,
        announceEarthquake,
        stopSpeaking,
    };
}
