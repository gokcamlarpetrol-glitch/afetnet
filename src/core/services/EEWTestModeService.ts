/**
 * EEW TEST MODE SERVICE - ELITE EDITION
 * 
 * Kullanıcıların EEW sistemini güvenle test etmesini sağlar
 * 
 * FEATURES:
 * - Simulated earthquake events
 * - Full countdown experience (test mode indicator)
 * - Sound/haptic testing
 * - Notification testing
 * - No false alerts (clearly marked as TEST)
 * 
 * @version 1.0.0
 * @elite true
 */

import { createLogger } from '../utils/logger';
import { eewCountdownEngine, CountdownConfig } from './EEWCountdownEngine';
import { multiChannelAlertService } from './MultiChannelAlertService';
import * as Haptics from 'expo-haptics';

const logger = createLogger('EEWTestModeService');

// ============================================================
// TEST SCENARIOS
// ============================================================

export interface TestScenario {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    magnitude: number;
    location: string;
    warningTime: number; // seconds
    estimatedIntensity: number; // MMI
    epicentralDistance: number; // km
    origin: {
        latitude: number;
        longitude: number;
        depth: number;
    };
}

const TEST_SCENARIOS: TestScenario[] = [
    {
        id: 'mild_distant',
        name: '🟢 Hafif Deprem (Uzak)',
        nameEn: 'Mild Earthquake (Distant)',
        description: 'Uzak bölgede hafif deprem. Sarsıntı hissedilmeyebilir.',
        magnitude: 4.2,
        location: 'Bolu - 150km',
        warningTime: 45,
        estimatedIntensity: 3.5,
        epicentralDistance: 150,
        origin: { latitude: 40.73, longitude: 31.61, depth: 10 },
    },
    {
        id: 'moderate_medium',
        name: '🟡 Orta Şiddette Deprem',
        nameEn: 'Moderate Earthquake',
        description: 'Orta şiddette deprem. Eşyalar sallanabilir.',
        magnitude: 5.1,
        location: 'Sakarya - 80km',
        warningTime: 25,
        estimatedIntensity: 5.5,
        epicentralDistance: 80,
        origin: { latitude: 40.69, longitude: 30.40, depth: 12 },
    },
    {
        id: 'strong_near',
        name: '🟠 Güçlü Deprem (Yakın)',
        nameEn: 'Strong Earthquake (Near)',
        description: 'Güçlü deprem! Sığınma pozisyonu alın.',
        magnitude: 6.2,
        location: 'İzmit - 40km',
        warningTime: 12,
        estimatedIntensity: 7.0,
        epicentralDistance: 40,
        origin: { latitude: 40.82, longitude: 29.93, depth: 8 },
    },
    {
        id: 'critical_very_near',
        name: '🔴 Kritik Deprem (Çok Yakın)',
        nameEn: 'Critical Earthquake (Very Near)',
        description: 'KRİTİK! Hemen ÇÖK-KAPAN-TUTUN!',
        magnitude: 7.1,
        location: 'İstanbul - 15km',
        warningTime: 5,
        estimatedIntensity: 8.5,
        epicentralDistance: 15,
        origin: { latitude: 40.98, longitude: 29.03, depth: 7 },
    },
];

// ============================================================
// TEST MODE SERVICE
// ============================================================

class EEWTestModeService {
    private isTestActive = false;
    private currentScenarioId: string | null = null;

    /**
     * Get all available test scenarios
     */
    getScenarios(): TestScenario[] {
        return TEST_SCENARIOS;
    }

    /**
     * Get scenario by ID
     */
    getScenario(id: string): TestScenario | undefined {
        return TEST_SCENARIOS.find(s => s.id === id);
    }

    /**
     * Check if test mode is currently active
     */
    isActive(): boolean {
        return this.isTestActive;
    }

    /**
     * Get current test scenario ID
     */
    getCurrentScenarioId(): string | null {
        return this.currentScenarioId;
    }

    /**
     * Start a test scenario
     * IMPORTANT: Clearly marked as TEST to avoid panic
     */
    async startTest(scenarioId: string): Promise<boolean> {
        if (this.isTestActive) {
            logger.warn('Test already active, stopping previous test');
            this.stopTest();
        }

        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            logger.error(`Unknown test scenario: ${scenarioId}`);
            return false;
        }

        logger.info(`🧪 Starting EEW Test: ${scenario.name}`);

        this.isTestActive = true;
        this.currentScenarioId = scenarioId;

        // Create test countdown config
        const config: CountdownConfig = {
            warningTime: scenario.warningTime,
            magnitude: scenario.magnitude,
            estimatedIntensity: scenario.estimatedIntensity,
            location: `🧪 TEST: ${scenario.location}`,
            epicentralDistance: scenario.epicentralDistance,
            pWaveArrivalTime: 2,
            sWaveArrivalTime: scenario.warningTime + 2,
            origin: scenario.origin,
        };

        // Initial haptic to indicate test start
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        // Start countdown engine
        await eewCountdownEngine.startCountdown(config);

        return true;
    }

    /**
     * Stop current test
     */
    stopTest(): void {
        if (!this.isTestActive) return;

        logger.info('🧪 Stopping EEW Test');

        this.isTestActive = false;
        this.currentScenarioId = null;

        eewCountdownEngine.stopCountdown();
    }

    /**
     * Quick test - just haptic and sound
     */
    async quickTest(): Promise<void> {
        logger.info('🧪 Quick EEW Test (haptic + sound only)');

        // Haptic sequence
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise(resolve => setTimeout(resolve, 500));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await new Promise(resolve => setTimeout(resolve, 500));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        logger.info('🧪 Quick test completed');
    }

    /**
     * Test notification only (no countdown)
     */
    async testNotification(): Promise<void> {
        logger.info('🧪 Testing EEW notification');

        try {
            await multiChannelAlertService.sendAlert({
                title: '🧪 TEST: Deprem Uyarı Sistemi',
                body: 'Bu bir TEST bildirimidir. Gerçek bir deprem değildir.',
                priority: 'normal',
                channels: { pushNotification: true, vibration: true, alarmSound: true },
                data: { isTest: true },
            });
        } catch (error) {
            logger.error('Test notification failed:', error);
        }
    }
}

// Export singleton
export const eewTestModeService = new EEWTestModeService();

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

export function useEEWTestMode() {
    const [isActive, setIsActive] = useState(false);
    const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);

    const scenarios = eewTestModeService.getScenarios();

    const startTest = useCallback(async (scenarioId: string) => {
        const success = await eewTestModeService.startTest(scenarioId);
        if (success) {
            setIsActive(true);
            setCurrentScenarioId(scenarioId);
        }
        return success;
    }, []);

    const stopTest = useCallback(() => {
        eewTestModeService.stopTest();
        setIsActive(false);
        setCurrentScenarioId(null);
    }, []);

    const quickTest = useCallback(async () => {
        await eewTestModeService.quickTest();
    }, []);

    const testNotification = useCallback(async () => {
        await eewTestModeService.testNotification();
    }, []);

    return {
        scenarios,
        isActive,
        currentScenarioId,
        startTest,
        stopTest,
        quickTest,
        testNotification,
    };
}
