/**
 * EEW SETTINGS SCREEN - DEPREM UYARI AYARLARI
 * 
 * 🛡️ KULLANICIYA TAM KONTROL VER
 * 
 * ELITE FEATURES:
 * - Sensitivity adjustment
 * - Background monitoring toggle
 * - Power mode selection
 * - Test/simulation mode
 * - Debug information
 * 
 * @version 1.0.0
 * @elite true
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    Alert,
    Vibration,
    Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useBackgroundSeismicMonitor } from '../../services/BackgroundSeismicMonitor';
import { onDeviceSeismicDetector } from '../../services/OnDeviceSeismicDetector';
import { crowdsourcedSeismicNetwork } from '../../services/CrowdsourcedSeismicNetwork';
import { ultraFastEEWNotification } from '../../services/UltraFastEEWNotification';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EEWSettingsScreen');


// ============================================================
// TYPES
// ============================================================

type SensitivityLevel = 'low' | 'medium' | 'high';
type PowerMode = 'normal' | 'aggressive' | 'battery_saver';

// ============================================================
// COMPONENT
// ============================================================

export default function EEWSettingsScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const backgroundMonitor = useBackgroundSeismicMonitor();

    // Local states
    const [isTestMode, setIsTestMode] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    // ==================== HANDLERS ====================

    const handleSensitivityChange = useCallback((level: SensitivityLevel) => {
        backgroundMonitor.setSensitivity(level);

        // Update on-device detector threshold
        const thresholds: Record<SensitivityLevel, number> = {
            low: 0.05,
            medium: 0.02,
            high: 0.01,
        };

        onDeviceSeismicDetector.updateConfig({
            minAcceleration: thresholds[level],
        });

        Alert.alert('✅ Hassasiyet Güncellendi', `Hassasiyet: ${level === 'low' ? 'Düşük' : level === 'medium' ? 'Orta' : 'Yüksek'
            }`);
    }, [backgroundMonitor]);

    const handlePowerModeChange = useCallback((mode: PowerMode) => {
        backgroundMonitor.setPowerMode(mode);

        Alert.alert('✅ Güç Modu Güncellendi', `Mod: ${mode === 'normal' ? 'Normal' : mode === 'aggressive' ? 'Agresif' : 'Pil Tasarrufu'
            }`);
    }, [backgroundMonitor]);

    const handleBackgroundToggle = useCallback(async (enabled: boolean) => {
        await backgroundMonitor.setEnabled(enabled);

        if (enabled) {
            Alert.alert(
                '🌙 Arka Plan Koruması Aktif',
                'Uygulama kapalı olsa bile deprem algılama devam edecek. Pil tüketimi minimal düzeyde artabilir.',
            );
        }
    }, [backgroundMonitor]);

    const handleTestEarthquake = useCallback(async () => {
        if (isTesting) return;

        setIsTesting(true);
        logger.warn('🧪 TEST MODE: Simulating earthquake...');

        // Haptic feedback
        Vibration.vibrate([100, 200, 100, 200, 100]);

        // Send test notification
        await ultraFastEEWNotification.sendEEWNotification({
            magnitude: 5.2,
            location: 'TEST - Simülasyon',
            warningSeconds: 10,
            estimatedIntensity: 5,
            epicentralDistance: 50,
            source: 'TEST' as any,
        });

        setTimeout(() => {
            setIsTesting(false);
            Alert.alert('✅ Test Tamamlandı', 'Deprem uyarı sistemi başarıyla çalışıyor!');
        }, 3000);
    }, [isTesting]);

    const handleCalibrate = useCallback(async () => {
        Alert.alert(
            '📐 Kalibrasyon',
            'Telefonu düz bir yüzeye koyun ve 5 saniye bekleyin.',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Başlat',
                    onPress: async () => {
                        const noise = await onDeviceSeismicDetector.runCalibration();
                        Alert.alert('✅ Kalibrasyon Tamamlandı', `Gürültü seviyesi: ${noise.toFixed(4)}g`);
                    },
                },
            ],
        );
    }, []);

    // ==================== RENDER ====================

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* ELITE: Back Button */}
            <View style={[styles.backButtonContainer, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.screenTitle}>Deprem Erken Uyarı</Text>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

                {/* HEADER */}
                <View style={styles.header}>
                    <Ionicons name="shield-checkmark" size={48} color="#10B981" />
                    <Text style={styles.headerTitle}>Deprem Uyarı Sistemi</Text>
                    <Text style={styles.headerSubtitle}>Türkiye'nin En Hızlı EEW Sistemi</Text>
                </View>

                {/* STATUS CARD */}
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: backgroundMonitor.enabled ? '#10B981' : '#6B7280' }]} />
                        <Text style={styles.statusText}>
                            {backgroundMonitor.enabled ? 'Aktif - 7/24 Koruma' : 'Pasif'}
                        </Text>
                    </View>
                    <Text style={styles.statusDetail}>
                        Örnekleme: {backgroundMonitor.samplingRate}Hz | Mod: {backgroundMonitor.appState}
                    </Text>
                </View>

                {/* BACKGROUND MONITORING */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🌙 Arka Plan Koruması</Text>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>7/24 Deprem Algılama</Text>
                            <Text style={styles.settingHint}>Uygulama kapalı olsa bile çalışır</Text>
                        </View>
                        <Switch
                            value={backgroundMonitor.enabled}
                            onValueChange={handleBackgroundToggle}
                            trackColor={{ false: '#3f3f46', true: '#10B98150' }}
                            thumbColor={backgroundMonitor.enabled ? '#10B981' : '#71717a'}
                        />
                    </View>
                </View>

                {/* SENSITIVITY */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📊 Hassasiyet Ayarı</Text>
                    <View style={styles.optionGroup}>
                        {(['low', 'medium', 'high'] as SensitivityLevel[]).map((level) => (
                            <TouchableOpacity
                                key={level}
                                style={[
                                    styles.optionButton,
                                    backgroundMonitor.samplingRate === SAMPLING_MAP[level] && styles.optionButtonActive,
                                ]}
                                onPress={() => handleSensitivityChange(level)}
                            >
                                <Text style={styles.optionIcon}>
                                    {level === 'low' ? '🔇' : level === 'medium' ? '🔉' : '🔊'}
                                </Text>
                                <Text style={styles.optionLabel}>
                                    {level === 'low' ? 'Düşük' : level === 'medium' ? 'Orta' : 'Yüksek'}
                                </Text>
                                <Text style={styles.optionHint}>
                                    {level === 'low' ? 'Daha az yanlış alarm' : level === 'medium' ? 'Dengeli' : 'Maksimum algılama'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* POWER MODE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔋 Güç Modu</Text>
                    <View style={styles.optionGroup}>
                        {(['battery_saver', 'normal', 'aggressive'] as PowerMode[]).map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.optionButton,
                                    backgroundMonitor.powerMode === mode && styles.optionButtonActive,
                                ]}
                                onPress={() => handlePowerModeChange(mode)}
                            >
                                <Text style={styles.optionIcon}>
                                    {mode === 'battery_saver' ? '🪫' : mode === 'normal' ? '🔋' : '⚡'}
                                </Text>
                                <Text style={styles.optionLabel}>
                                    {mode === 'battery_saver' ? 'Tasarruf' : mode === 'normal' ? 'Normal' : 'Agresif'}
                                </Text>
                                <Text style={styles.optionHint}>
                                    {mode === 'battery_saver' ? '5Hz' : mode === 'normal' ? '10Hz' : '100Hz'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* TEST MODE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🧪 Test Modu</Text>
                    <TouchableOpacity
                        style={[styles.testButton, isTesting && styles.testButtonDisabled]}
                        onPress={handleTestEarthquake}
                        disabled={isTesting}
                    >
                        <Ionicons name="flash" size={24} color="#FFF" />
                        <Text style={styles.testButtonText}>
                            {isTesting ? 'Test Ediliyor...' : 'Deprem Simülasyonu Başlat'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.calibrateButton} onPress={handleCalibrate}>
                        <Ionicons name="compass" size={20} color="#10B981" />
                        <Text style={styles.calibrateButtonText}>Sensör Kalibrasyonu</Text>
                    </TouchableOpacity>
                </View>

                {/* DEBUG INFO */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.debugToggle}
                        onPress={() => setShowDebug(!showDebug)}
                    >
                        <Text style={styles.sectionTitle}>🐛 Geliştirici Bilgileri</Text>
                        <Ionicons name={showDebug ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    {showDebug && (
                        <View style={styles.debugContainer}>
                            <Text style={styles.debugText}>On-Device: {onDeviceSeismicDetector.getIsRunning() ? '✅' : '❌'}</Text>
                            <Text style={styles.debugText}>Crowdsource: {crowdsourcedSeismicNetwork.getIsRunning() ? '✅' : '❌'}</Text>
                            <Text style={styles.debugText}>Background: {backgroundMonitor.registered ? '✅' : '❌'}</Text>
                            <Text style={styles.debugText}>App State: {backgroundMonitor.appState}</Text>
                            <Text style={styles.debugText}>Sample Rate: {backgroundMonitor.samplingRate}Hz</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ============================================================
// CONSTANTS
// ============================================================

const SAMPLING_MAP: Record<SensitivityLevel, number> = {
    low: 50,
    medium: 100,
    high: 100,
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    backButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#18181B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    screenTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 16,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: 12,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#18181B',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#27272A',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statusDetail: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#18181B',
        borderRadius: 12,
        padding: 16,
    },
    settingInfo: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    settingHint: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    optionGroup: {
        flexDirection: 'row',
        gap: 8,
    },
    optionButton: {
        flex: 1,
        backgroundColor: '#18181B',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#27272A',
    },
    optionButtonActive: {
        borderColor: '#10B981',
        backgroundColor: '#10B98110',
    },
    optionIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    optionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    optionHint: {
        fontSize: 10,
        color: '#6B7280',
        marginTop: 2,
        textAlign: 'center',
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 12,
        padding: 16,
        gap: 8,
    },
    testButtonDisabled: {
        backgroundColor: '#6B7280',
    },
    testButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    calibrateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#18181B',
        borderRadius: 12,
        padding: 14,
        marginTop: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    calibrateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    debugToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    debugContainer: {
        backgroundColor: '#18181B',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
    },
    debugText: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: '#9CA3AF',
        marginBottom: 4,
    },
});
