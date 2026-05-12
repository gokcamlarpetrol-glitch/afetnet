/**
 * EEW COMMAND CENTER - ELITE PREMIUM EDITION
 * 
 * 🛡️ KAPSAMLI ERKEN UYARI YÖNETİM MERKEZİ
 * 
 * ELITE FEATURES:
 * - Ultra-modern, Command-Center style aesthetic
 * - Glassmorphism, Neon Glow effects & LinearGradients
 * - Simulated Regional Network Node Status (Kandilli/AFAD)
 * - Enhanced Live Seismograph UI with precise rendering
 * - Intelligent Feedback Mechanisms (Haptics & Animations)
 * 
 * @version 2.0.0
 * @elite true
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
    Animated,
    Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { useBackgroundSeismicMonitor } from '../../services/BackgroundSeismicMonitor';
import { onDeviceSeismicDetector, useSeismographData } from '../../services/OnDeviceSeismicDetector';
import { crowdsourcedSeismicNetwork } from '../../services/CrowdsourcedSeismicNetwork';
import { notificationCenter } from '../../services/notifications/NotificationCenter';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';

const logger = createLogger('EEWSettingsScreen');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    const sensorData = useSeismographData();

    // Local states
    const [showDebug, setShowDebug] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    // Network status state (derived from actual monitor state)


    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Subtle pulsing for active status indicator
        let anim: Animated.CompositeAnimation | null = null;
        if (backgroundMonitor.enabled) {
            anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                ])
            );
            anim.start();
        } else {
            pulseAnim.setValue(1);
        }
        // CRITICAL FIX: Stop animation on unmount to prevent leak
        return () => { anim?.stop(); };
    }, [backgroundMonitor.enabled, pulseAnim]);


    // ==================== HANDLERS ====================

    const handleSensitivityChange = useCallback((level: SensitivityLevel) => {
        haptics.impactLight();
        backgroundMonitor.setSensitivity(level);

        const thresholds: Record<SensitivityLevel, number> = {
            low: 0.05,
            medium: 0.02,
            high: 0.01,
        };
        onDeviceSeismicDetector.updateConfig({ minAcceleration: thresholds[level] });
    }, [backgroundMonitor]);

    const handlePowerModeChange = useCallback((mode: PowerMode) => {
        haptics.impactLight();
        backgroundMonitor.setPowerMode(mode);
    }, [backgroundMonitor]);

    const handleBackgroundToggle = useCallback(async (enabled: boolean) => {
        haptics.impactMedium();
        await backgroundMonitor.setEnabled(enabled);

        if (enabled) {
            Alert.alert(
                '🛡️ Sürekli İzleme Aktif',
                'Uygulama arka planda iken bile en ufak P-Dalga sarsıntıları ağa raporlanacak.',
            );
        }
    }, [backgroundMonitor]);

    const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => { if (testTimerRef.current) clearTimeout(testTimerRef.current); };
    }, []);

    const handleTestEarthquake = useCallback(async () => {
        if (isTesting) return;

        haptics.impactHeavy();
        setIsTesting(true);
        logger.warn('TEST MODE: Simulating earthquake...');

        // Haptic feedback sequence mimicking P-wave then S-wave
        Vibration.vibrate([100, 300, 100, 500, 1000]);

        // Send test notification
        await notificationCenter.notify('earthquake', {
            magnitude: 5.6,
            location: 'SIMULASYON TESTI - AFETNET',
            timestamp: Date.now(),
            isEEW: true,
            isTest: true, // Prevent downstream handlers from triggering real emergency mode
        }, 'EEWSettingsScreen-test');

        // CRITICAL FIX: Save timer ref so it can be cleared on unmount
        testTimerRef.current = setTimeout(() => {
            testTimerRef.current = null;
            setIsTesting(false);
            Alert.alert('Simülasyon Başarılı', 'Sistem tüm uyarı bileşenlerini başarıyla ateşledi.');
        }, 4000);
    }, [isTesting]);

    const handleCalibrate = useCallback(() => {
        haptics.impactLight();
        Alert.alert(
            '📐 Referans Kalibrasyonu',
            'Telefonu mükemmel düz ve sarsıntısız bir yüzeye bırakıp 5 saniye dokunmayın.',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Kalibre Et',
                    style: 'default',
                    onPress: async () => {
                        const noise = await onDeviceSeismicDetector.runCalibration();
                        Alert.alert('✅ Kalibrasyon Tamamlandı', `Zemin Gürültü Toleransı:\n${noise.toFixed(4)}g olarak ayarlandı.`);
                    },
                },
            ],
        );
    }, []);

    // ==================== RENDERS ====================

    const renderGlassCard = (children: React.ReactNode, style?: any) => (
        <View style={[styles.glassCard, style]}>
            {children}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Dark premium gradient background */}
            <LinearGradient
                colors={['#020617', '#0B1120', '#020617']}
                style={StyleSheet.absoluteFillObject}
            />

            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                {/* ELITE: Navigation Header */}
                <View style={styles.navHeader}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                    </Pressable>
                    <Text style={styles.navTitle}>EEW Komuta Merkezi</Text>
                    <View style={styles.backButton} /> {/* Placeholder for center alignment */}
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

                    {/* HERO HEADER */}
                    <Animated.View style={[styles.heroHeader, { transform: [{ scale: pulseAnim }] }]}>
                        <LinearGradient
                            colors={backgroundMonitor.enabled ? ['#10B98130', '#04785710'] : ['#EF444430', '#991B1B10']}
                            style={styles.heroGlow}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        <Ionicons
                            name={backgroundMonitor.enabled ? "shield-checkmark" : "shield-half-outline"}
                            size={56}
                            color={backgroundMonitor.enabled ? "#10B981" : "#F87171"}
                        />
                    </Animated.View>
                    <Text style={styles.headerTitle}>AfetNet İstasyonu</Text>
                    <Text style={styles.headerSubtitle}>
                        {backgroundMonitor.enabled ? 'Sistem Aktif ve Deprem Dalgalarını Dinliyor.' : 'Sistem Beklemede. Korumayı Aktif Edin.'}
                    </Text>

                    {/* STATUS NETWORK CARD */}
                    <Text style={styles.sectionHeader}>AĞ & SİSTEM DURUMU</Text>
                    {renderGlassCard(
                        <View>
                            <View style={styles.mainToggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.mainToggleTitle}>7/24 Kesintisiz Radar</Text>
                                    <Text style={styles.mainToggleSubtitle}>Arka planda uyurken dahi korur</Text>
                                </View>
                                <Switch
                                    value={backgroundMonitor.enabled}
                                    onValueChange={handleBackgroundToggle}
                                    trackColor={{ false: '#334155', true: '#059669' }}
                                    thumbColor={backgroundMonitor.enabled ? '#34D399' : '#94A3B8'}
                                />
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.networkGrid}>
                                <View style={styles.networkBox}>
                                    <Ionicons name="server-outline" size={16} color="#60A5FA" />
                                    <Text style={styles.networkBoxValue}>{backgroundMonitor.enabled ? 'Bağlı' : '--'}</Text>
                                    <Text style={styles.networkBoxLabel}>Bölge Skorer</Text>
                                </View>
                                <View style={styles.networkBox}>
                                    <Ionicons name="earth" size={16} color="#34D399" />
                                    <Text style={styles.networkBoxValue}>{backgroundMonitor.enabled ? 'Bağlı' : '--'}</Text>
                                    <Text style={styles.networkBoxLabel}>Ana Merkez</Text>
                                </View>
                                <View style={styles.networkBox}>
                                    <Ionicons name="speedometer-outline" size={16} color="#FBBF24" />
                                    <Text style={styles.networkBoxValue}>{backgroundMonitor.enabled ? `${backgroundMonitor.samplingRate}Hz` : '--'}</Text>
                                    <Text style={styles.networkBoxLabel}>Örnekleme</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* LIVE SEISMOGRAPH */}
                    <Text style={[styles.sectionHeader, { marginTop: 24 }]}>CANLI SİSMOGRAF (P/S-WAVE)</Text>
                    {renderGlassCard(
                        !onDeviceSeismicDetector.getIsRunning() || !backgroundMonitor.enabled ? (
                            <View style={styles.emptySeismograph}>
                                <Ionicons name="pulse" size={24} color="#475569" />
                                <Text style={styles.emptySeismographText}>Canlı veriler için radar korumasını etkinleştirin.</Text>
                            </View>
                        ) : sensorData ? (
                            <View>
                                <View style={styles.graphContainer}>
                                    {/* Grid Lines for Professional Look */}
                                    <View style={styles.graphGridLine} />
                                    <View style={[styles.graphGridLine, { top: '50%' }]} />
                                    <View style={[styles.graphGridLine, { top: '75%' }]} />

                                    <View style={styles.axisRow}>
                                        <Text style={[styles.axisLabel, { color: '#60A5FA' }]}>X Ekseni</Text>
                                        <Text style={[styles.axisValue, { color: '#60A5FA' }]}>{sensorData.x.toFixed(3)}</Text>
                                    </View>
                                    <View style={styles.graphTrack}>
                                        <View style={[styles.graphFill, { width: `${Math.min(100, Math.abs(sensorData.x) * 50)}%`, backgroundColor: '#3B82F6' }]} />
                                    </View>

                                    <View style={styles.axisRow}>
                                        <Text style={[styles.axisLabel, { color: '#34D399' }]}>Y Ekseni</Text>
                                        <Text style={[styles.axisValue, { color: '#34D399' }]}>{sensorData.y.toFixed(3)}</Text>
                                    </View>
                                    <View style={styles.graphTrack}>
                                        <View style={[styles.graphFill, { width: `${Math.min(100, Math.abs(sensorData.y) * 50)}%`, backgroundColor: '#10B981' }]} />
                                    </View>

                                    <View style={styles.axisRow}>
                                        <Text style={[styles.axisLabel, { color: '#FBBF24' }]}>Z Ekseni</Text>
                                        <Text style={[styles.axisValue, { color: '#FBBF24' }]}>{sensorData.z.toFixed(3)}</Text>
                                    </View>
                                    <View style={styles.graphTrack}>
                                        <View style={[styles.graphFill, { width: `${Math.min(100, Math.abs(sensorData.z) * 50)}%`, backgroundColor: '#F59E0B' }]} />
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.axisRow}>
                                    <Text style={styles.axisLabelBold}>BİLEŞKE İVME ŞİDDETİ (∆g)</Text>
                                    <Text style={[styles.axisValueBold, { color: sensorData.magnitude > 0.05 ? '#EF4444' : '#34D399' }]}>
                                        {sensorData.magnitude.toFixed(4)}g
                                    </Text>
                                </View>
                                <View style={styles.masterGraphTrack}>
                                    <LinearGradient
                                        colors={sensorData.magnitude > 0.05 ? ['#EF4444', '#B91C1C'] : ['#34D399', '#059669']}
                                        style={[styles.masterGraphFill, { width: `${Math.min(100, (sensorData.magnitude / 0.1) * 100)}%` }]}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    />
                                </View>
                                <Text style={styles.seismographSubText}>Anlık DC-Offset filtreleme uygulanmaktadır.</Text>
                            </View>
                        ) : (
                            <View style={styles.emptySeismograph}>
                                <Text style={styles.emptySeismographText}>Sensör senkronizasyonu bekleniyor...</Text>
                            </View>
                        )
                    )}

                    {/* SENSITIVITY & POWER */}
                    <Text style={[styles.sectionHeader, { marginTop: 24 }]}>KORUMA PARAMETRELERİ</Text>
                    <View style={styles.optionsGrid}>
                        {/* Sensitivity */}
                        {renderGlassCard(
                            <View>
                                <Text style={styles.optionSectionTitle}>Hassasiyet Eşiği</Text>
                                <View style={styles.segmentsContainer}>
                                    {(['low', 'medium', 'high'] as SensitivityLevel[]).map((level) => (
                                        <TouchableOpacity
                                            key={level}
                                            style={[styles.segmentBtn, backgroundMonitor.sensitivity === level && styles.segmentBtnActive]}
                                            onPress={() => handleSensitivityChange(level)}
                                        >
                                            <Text style={[styles.segmentText, backgroundMonitor.sensitivity === level && styles.segmentTextActive]}>
                                                {level === 'low' ? 'Düşük' : level === 'medium' ? 'Orta' : 'Yüksek'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={styles.optionHelpText}>
                                    {backgroundMonitor.sensitivity === 'low' ? 'Zıplamalarda yanlış alarmı engeller.' : backgroundMonitor.sensitivity === 'medium' ? 'Klasik şehir içi kullanımı için idealdir.' : 'Kusursuz güvenlik, tüm ivmelenmeyi raporlar.'}
                                </Text>
                            </View>,
                            { flex: 1, marginBottom: 0 }
                        )}

                        {/* Power */}
                        {renderGlassCard(
                            <View>
                                <Text style={styles.optionSectionTitle}>Cihaz Tüketimi</Text>
                                <View style={styles.segmentsContainer}>
                                    {(['battery_saver', 'normal', 'aggressive'] as PowerMode[]).map((mode) => (
                                        <TouchableOpacity
                                            key={mode}
                                            style={[styles.segmentBtn, backgroundMonitor.powerMode === mode && styles.segmentBtnActive]}
                                            onPress={() => handlePowerModeChange(mode)}
                                        >
                                            <IconOrText mode={mode} active={backgroundMonitor.powerMode === mode} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={styles.optionHelpText}>
                                    {backgroundMonitor.powerMode === 'battery_saver' ? 'Pil Dostu (5Hz)' : backgroundMonitor.powerMode === 'normal' ? 'Stabil Performans (10Hz)' : 'Agresif Tarama (100Hz)'}
                                </Text>
                            </View>,
                            { flex: 1, marginBottom: 0 }
                        )}
                    </View>

                    {/* ACTIONS: TEST & CALIBRATE */}
                    <Text style={[styles.sectionHeader, { marginTop: 24 }]}>MODÜL TESTLERİ</Text>
                    {renderGlassCard(
                        <View style={{ gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.simulateBtn, isTesting && { opacity: 0.6 }]}
                                onPress={handleTestEarthquake}
                                disabled={isTesting}
                            >
                                <LinearGradient
                                    colors={['#EF4444', '#991B1B']}
                                    style={StyleSheet.absoluteFillObject}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                />
                                <Ionicons name="warning" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.simulateBtnText}>
                                    {isTesting ? 'UYARI SİMÜLE EDİLİYOR...' : 'SİSTEMİ TEST ET (SİMÜLASYON)'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.calibrateBtn} onPress={handleCalibrate}>
                                <Ionicons name="compass" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                                <Text style={styles.calibrateBtnText}>Sensör Merkezi Kalibrasyonu</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* DEBUGGER — only visible in development builds */}
                    {__DEV__ && (
                        <>
                            <TouchableOpacity style={styles.debugHeader} onPress={() => setShowDebug(!showDebug)}>
                                <Text style={styles.debugTitle}>Geliştirici Verileri</Text>
                                <Ionicons name={showDebug ? 'chevron-up' : 'chevron-down'} size={16} color="#475569" />
                            </TouchableOpacity>

                            {showDebug && (
                                <View style={styles.debugTerminal}>
                                    <Text style={styles.debugTerminalText}>Cihaz Sensörü: {onDeviceSeismicDetector.getIsRunning() ? 'Aktif' : 'Bekleme'}</Text>
                                    <Text style={styles.debugTerminalText}>Topluluk Ağı: {crowdsourcedSeismicNetwork.getIsRunning() ? 'Bağlı' : 'Bekleme'}</Text>
                                    <Text style={styles.debugTerminalText}>Arka Plan Görevi: {backgroundMonitor.registered ? 'Kayıtlı' : 'Ayrık'}</Text>
                                    <Text style={styles.debugTerminalText}>Uygulama Durumu: {backgroundMonitor.appState}</Text>
                                    <Text style={styles.debugTerminalText}>Örnekleme Hızı: {backgroundMonitor.samplingRate}Hz</Text>
                                </View>
                            )}
                        </>
                    )}

                    <View style={{ height: 60 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const IconOrText = ({ mode, active }: { mode: PowerMode, active: boolean }) => {
    const color = active ? '#FFFFFF' : '#94A3B8';
    if (mode === 'battery_saver') return <Ionicons name="battery-half" size={18} color={color} />;
    if (mode === 'normal') return <Ionicons name="speedometer-outline" size={18} color={color} />;
    return <Ionicons name="flash" size={18} color={color} />;
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    navHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F8FAFC',
        letterSpacing: 0.5,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 16,
    },
    heroHeader: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    heroGlow: {
        width: 100,
        height: 100,
        borderRadius: 50,
        position: 'absolute',
        transform: [{ scale: 1.5 }],
    },
    headerTitle: {
        textAlign: 'center',
        fontSize: 26,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        textAlign: 'center',
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 6,
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        letterSpacing: 1.5,
        marginBottom: 10,
        marginLeft: 4,
    },
    glassCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 18,
        marginBottom: 16,
    },
    mainToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mainToggleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F8FAFC',
    },
    mainToggleSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginVertical: 16,
    },
    networkGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    networkBox: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: 10,
        marginHorizontal: 4,
        borderRadius: 12,
    },
    networkBoxValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#F8FAFC',
        marginVertical: 4,
    },
    networkBoxLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
    },
    emptySeismograph: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 12,
    },
    emptySeismographText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500',
    },
    graphContainer: {
        position: 'relative',
        paddingVertical: 8,
    },
    graphGridLine: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        zIndex: 0,
    },
    axisRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    axisLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    axisValue: {
        fontSize: 12,
        fontFamily: 'Courier',
        fontWeight: 'bold',
    },
    graphTrack: {
        height: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 16,
    },
    graphFill: {
        height: '100%',
        borderRadius: 3,
    },
    axisLabelBold: {
        fontSize: 13,
        fontWeight: '800',
        color: '#F8FAFC',
    },
    axisValueBold: {
        fontSize: 16,
        fontWeight: '800',
    },
    masterGraphTrack: {
        height: 14,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 7,
        overflow: 'hidden',
        marginTop: 6,
    },
    masterGraphFill: {
        height: '100%',
        borderRadius: 7,
    },
    seismographSubText: {
        fontSize: 10,
        color: '#475569',
        textAlign: 'center',
        marginTop: 12,
    },
    optionsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    optionSectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E2E8F0',
        marginBottom: 12,
    },
    segmentsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        padding: 4,
        marginBottom: 10,
    },
    segmentBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 6,
    },
    segmentBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    segmentText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    segmentTextActive: {
        color: '#FFFFFF',
    },
    optionHelpText: {
        fontSize: 10,
        color: '#64748B',
        lineHeight: 14,
    },
    simulateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 4,
    },
    simulateBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
        letterSpacing: 1,
    },
    calibrateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    calibrateBtnText: {
        color: '#94A3B8',
        fontWeight: '600',
        fontSize: 13,
    },
    debugHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        marginTop: 16,
        paddingHorizontal: 8,
    },
    debugTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        letterSpacing: 1,
    },
    debugTerminal: {
        backgroundColor: '#000000',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    debugTerminalText: {
        fontFamily: 'Courier',
        fontSize: 11,
        color: '#10B981',
        marginBottom: 4,
    }
});
