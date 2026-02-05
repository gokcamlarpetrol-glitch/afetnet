/**
 * EEW HISTORY STORE - ELITE EDITION
 * 
 * Geçmiş EEW uyarılarını saklar ve görüntüler
 * 
 * FEATURES:
 * - Persistent storage (AsyncStorage)
 * - Last 100 events
 * - Search and filter
 * - Statistics
 * 
 * @version 1.0.0
 * @elite true
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('EEWHistoryStore');

// ============================================================
// TYPES
// ============================================================

export interface EEWHistoryEvent {
    id: string;
    timestamp: number;

    // Earthquake data
    magnitude: number;
    location: string;
    depth: number;
    latitude: number;
    longitude: number;

    // EEW data
    warningTime: number; // seconds of advance warning
    estimatedIntensity: number; // MMI
    epicentralDistance: number; // km

    // Source
    source: 'AFAD' | 'KANDILLI' | 'USGS' | 'EMSC' | 'CROWDSOURCED' | 'DEVICE_SENSOR';

    // User data
    userLatitude?: number;
    userLongitude?: number;

    // Flags
    wasNotified: boolean;
    isTest?: boolean;

    // Quality
    confidence: number;
    certainty: 'low' | 'medium' | 'high';
}

export interface EEWStatistics {
    totalEvents: number;
    averageWarningTime: number; // seconds
    averageMagnitude: number;
    eventsBySource: Record<string, number>;
    eventsLast24h: number;
    eventsLast7d: number;
    eventsLast30d: number;
}

interface EEWHistoryState {
    events: EEWHistoryEvent[];
    maxEvents: number;

    // Actions
    addEvent: (event: Omit<EEWHistoryEvent, 'id'>) => void;
    clearHistory: () => void;
    getEvent: (id: string) => EEWHistoryEvent | undefined;
    getRecentEvents: (limit?: number) => EEWHistoryEvent[];
    getEventsBySource: (source: string) => EEWHistoryEvent[];
    getEventsByMagnitudeRange: (min: number, max: number) => EEWHistoryEvent[];
    getEventsInTimeRange: (startTime: number, endTime: number) => EEWHistoryEvent[];
    getStatistics: () => EEWStatistics;
    searchEvents: (query: string) => EEWHistoryEvent[];
}

// ============================================================
// STORE
// ============================================================

export const useEEWHistoryStore = create<EEWHistoryState>()(
    persist(
        (set, get) => ({
            events: [],
            maxEvents: 100,

            addEvent: (event) => {
                const newEvent: EEWHistoryEvent = {
                    ...event,
                    id: `eew-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                };

                set((state) => {
                    const updatedEvents = [newEvent, ...state.events];
                    // Keep only last maxEvents
                    if (updatedEvents.length > state.maxEvents) {
                        updatedEvents.splice(state.maxEvents);
                    }

                    logger.info(`EEW event added: M${event.magnitude} ${event.location}`);

                    return { events: updatedEvents };
                });
            },

            clearHistory: () => {
                set({ events: [] });
                logger.info('EEW history cleared');
            },

            getEvent: (id) => {
                return get().events.find((e) => e.id === id);
            },

            getRecentEvents: (limit = 20) => {
                return get().events.slice(0, limit);
            },

            getEventsBySource: (source) => {
                return get().events.filter((e) => e.source === source);
            },

            getEventsByMagnitudeRange: (min, max) => {
                return get().events.filter((e) => e.magnitude >= min && e.magnitude <= max);
            },

            getEventsInTimeRange: (startTime, endTime) => {
                return get().events.filter(
                    (e) => e.timestamp >= startTime && e.timestamp <= endTime
                );
            },

            getStatistics: () => {
                const events = get().events.filter((e) => !e.isTest);
                const now = Date.now();
                const day = 24 * 60 * 60 * 1000;

                // Source counts
                const eventsBySource: Record<string, number> = {};
                events.forEach((e) => {
                    eventsBySource[e.source] = (eventsBySource[e.source] || 0) + 1;
                });

                // Calculate averages
                const totalWarningTime = events.reduce((sum, e) => sum + e.warningTime, 0);
                const totalMagnitude = events.reduce((sum, e) => sum + e.magnitude, 0);

                return {
                    totalEvents: events.length,
                    averageWarningTime: events.length > 0 ? totalWarningTime / events.length : 0,
                    averageMagnitude: events.length > 0 ? totalMagnitude / events.length : 0,
                    eventsBySource,
                    eventsLast24h: events.filter((e) => e.timestamp > now - day).length,
                    eventsLast7d: events.filter((e) => e.timestamp > now - 7 * day).length,
                    eventsLast30d: events.filter((e) => e.timestamp > now - 30 * day).length,
                };
            },

            searchEvents: (query) => {
                const lowerQuery = query.toLowerCase();
                return get().events.filter(
                    (e) =>
                        e.location.toLowerCase().includes(lowerQuery) ||
                        e.source.toLowerCase().includes(lowerQuery) ||
                        e.magnitude.toString().includes(query)
                );
            },
        }),
        {
            name: 'eew-history-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                events: state.events,
            }),
        }
    )
);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format warning time for display
 */
export function formatWarningTime(seconds: number): string {
    if (seconds < 60) {
        return `${Math.round(seconds)} sn`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes} dk ${remainingSeconds} sn` : `${minutes} dk`;
}

/**
 * Get urgency level from warning time
 */
export function getUrgencyLevel(warningTime: number): 'critical' | 'high' | 'medium' | 'low' {
    if (warningTime <= 5) return 'critical';
    if (warningTime <= 10) return 'high';
    if (warningTime <= 20) return 'medium';
    return 'low';
}

/**
 * Get source display name
 */
export function getSourceDisplayName(source: string): string {
    const names: Record<string, string> = {
        'AFAD': 'AFAD',
        'KANDILLI': 'Kandilli',
        'USGS': 'USGS',
        'EMSC': 'EMSC',
        'CROWDSOURCED': 'Topluluk',
        'DEVICE_SENSOR': 'Cihaz Sensörü',
    };
    return names[source] || source;
}
