/**
 * POWER INDICATOR - ELITE V4
 * Visual indicator for mesh power status
 * 
 * FEATURES:
 * - Battery level display
 * - Power mode indicator
 * - Scan profile info
 * - Emergency mode warning
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Modal,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { meshPowerManager, PowerState, PowerMode } from '../../services/mesh';

// ============================================================================
// COLORS (Local definitions for type safety)
// ============================================================================

const THEME_COLORS = {
    background: '#0A0A0F',
    card: '#1A1A2E',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    border: 'rgba(255,255,255,0.1)',
};

// ============================================================================
// TYPES
// ============================================================================

interface PowerIndicatorProps {
    compact?: boolean;
    onPress?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PowerIndicator: React.FC<PowerIndicatorProps> = ({
    compact = false,
    onPress,
}) => {
    const [powerState, setPowerState] = useState<PowerState | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const emergencyAnim = React.useRef(new Animated.Value(0)).current;

    // ============================================================================
    // EFFECTS
    // ============================================================================

    useEffect(() => {
        // Initialize power manager
        meshPowerManager.initialize();

        // Get initial state
        meshPowerManager.getState().then(setPowerState);

        // Subscribe to changes
        const unsubscribe = meshPowerManager.onStateChange(setPowerState);

        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (powerState?.isEmergencyMode) {
            // Emergency pulse animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(emergencyAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(emergencyAnim, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            emergencyAnim.setValue(0);
        }
    }, [powerState?.isEmergencyMode, emergencyAnim]);

    // ============================================================================
    // HELPERS
    // ============================================================================

    const getBatteryIcon = useCallback((): string => {
        if (!powerState) return 'battery-half-outline';

        const level = powerState.batteryLevel;
        if (powerState.isCharging) return 'battery-charging-outline';
        if (level > 80) return 'battery-full-outline';
        if (level > 50) return 'battery-half-outline';
        if (level > 20) return 'battery-dead-outline';
        return 'battery-dead';
    }, [powerState]);

    const getBatteryColor = useCallback((): string => {
        if (!powerState) return THEME_COLORS.textSecondary;

        const level = powerState.batteryLevel;
        if (powerState.isCharging) return THEME_COLORS.success;
        if (level > 50) return THEME_COLORS.success;
        if (level > 20) return THEME_COLORS.warning;
        return THEME_COLORS.danger;
    }, [powerState]);

    const getModeIcon = useCallback((): string => {
        if (!powerState) return 'flash-outline';

        switch (powerState.mode) {
            case 'emergency':
                return 'warning';
            case 'maximum':
                return 'flash';
            case 'power_saver':
                return 'leaf';
            default:
                return 'flash-outline';
        }
    }, [powerState]);

    const getModeColor = useCallback((): string => {
        if (!powerState) return THEME_COLORS.textSecondary;

        switch (powerState.mode) {
            case 'emergency':
                return THEME_COLORS.danger;
            case 'maximum':
                return THEME_COLORS.warning;
            case 'power_saver':
                return THEME_COLORS.success;
            default:
                return THEME_COLORS.primary;
        }
    }, [powerState]);

    const getModeLabel = useCallback((): string => {
        if (!powerState) return 'Yükleniyor...';

        switch (powerState.mode) {
            case 'emergency':
                return 'ACİL';
            case 'maximum':
                return 'Maksimum';
            case 'power_saver':
                return 'Tasarruf';
            default:
                return 'Dengeli';
        }
    }, [powerState]);

    // ============================================================================
    // ACTIONS
    // ============================================================================

    const handlePress = useCallback(() => {
        if (onPress) {
            onPress();
        } else {
            setShowDetails(true);
        }
    }, [onPress]);

    const handleModeChange = useCallback(async (mode: PowerMode) => {
        await meshPowerManager.setMode(mode);
    }, []);

    const toggleBackground = useCallback(async () => {
        if (powerState?.isBackgroundEnabled) {
            await meshPowerManager.disableBackground();
        } else {
            await meshPowerManager.enableBackground();
        }
    }, [powerState?.isBackgroundEnabled]);

    // ============================================================================
    // RENDER
    // ============================================================================

    if (!powerState) {
        return null;
    }

    const emergencyOpacity = emergencyAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.8, 1],
    });

    if (compact) {
        return (
            <TouchableOpacity onPress={handlePress} style={styles.compactContainer}>
                <Ionicons
                    name={getModeIcon() as any}
                    size={16}
                    color={getModeColor()}
                />
                <Text style={[styles.compactText, { color: getBatteryColor() }]}>
                    {powerState.batteryLevel}%
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <>
            <Animated.View style={[
                styles.container,
                powerState.isEmergencyMode && { opacity: emergencyOpacity },
            ]}>
                <TouchableOpacity onPress={handlePress} style={styles.touchable}>
                    <LinearGradient
                        colors={
                            powerState.isEmergencyMode
                                ? ['rgba(244,67,54,0.3)', 'rgba(244,67,54,0.1)']
                                : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                        }
                        style={styles.gradient}
                    >
                        {/* Battery Section */}
                        <View style={styles.section}>
                            <Ionicons
                                name={getBatteryIcon() as any}
                                size={20}
                                color={getBatteryColor()}
                            />
                            <Text style={[styles.value, { color: getBatteryColor() }]}>
                                {powerState.batteryLevel}%
                            </Text>
                        </View>

                        {/* Divider */}
                        <View style={styles.divider} />

                        {/* Mode Section */}
                        <View style={styles.section}>
                            <Ionicons
                                name={getModeIcon() as any}
                                size={20}
                                color={getModeColor()}
                            />
                            <Text style={[styles.label, { color: getModeColor() }]}>
                                {getModeLabel()}
                            </Text>
                        </View>

                        {/* Profile Info */}
                        <View style={styles.profileBadge}>
                            <Text style={styles.profileText}>
                                {powerState.currentProfile.name}
                            </Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            {/* Details Modal */}
            <Modal
                visible={showDetails}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDetails(false)}
            >
                <BlurView intensity={80} style={styles.modalOverlay} tint="dark">
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Güç Yönetimi</Text>
                            <TouchableOpacity
                                onPress={() => setShowDetails(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color={THEME_COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Battery Status */}
                            <View style={styles.statusCard}>
                                <View style={styles.statusRow}>
                                    <Ionicons
                                        name={getBatteryIcon() as any}
                                        size={32}
                                        color={getBatteryColor()}
                                    />
                                    <View style={styles.statusInfo}>
                                        <Text style={styles.statusValue}>
                                            {powerState.batteryLevel}%
                                        </Text>
                                        <Text style={styles.statusLabel}>
                                            {powerState.isCharging ? 'Şarj oluyor' : 'Batarya'}
                                        </Text>
                                    </View>
                                </View>

                                {powerState.estimatedRemainingTime && (
                                    <Text style={styles.estimatedTime}>
                                        Tahmini süre: ~{powerState.estimatedRemainingTime} dakika
                                    </Text>
                                )}
                            </View>

                            {/* Power Modes */}
                            <Text style={styles.sectionTitle}>Güç Modu</Text>
                            <View style={styles.modeGrid}>
                                {(['balanced', 'maximum', 'power_saver'] as PowerMode[]).map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        style={[
                                            styles.modeButton,
                                            powerState.mode === mode && styles.modeButtonActive,
                                        ]}
                                        onPress={() => handleModeChange(mode)}
                                    >
                                        <Ionicons
                                            name={
                                                mode === 'maximum' ? 'flash' :
                                                    mode === 'power_saver' ? 'leaf' : 'flash-outline'
                                            }
                                            size={24}
                                            color={powerState.mode === mode ? '#fff' : THEME_COLORS.text}
                                        />
                                        <Text style={[
                                            styles.modeLabel,
                                            powerState.mode === mode && styles.modeLabelActive,
                                        ]}>
                                            {mode === 'maximum' ? 'Maksimum' :
                                                mode === 'power_saver' ? 'Tasarruf' : 'Dengeli'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Background Toggle */}
                            <View style={styles.toggleRow}>
                                <View style={styles.toggleInfo}>
                                    <Text style={styles.toggleLabel}>Arka Plan İşlemi</Text>
                                    <Text style={styles.toggleDescription}>
                                        Uygulama kapalıyken mesh çalışır
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.toggleButton,
                                        powerState.isBackgroundEnabled && styles.toggleButtonActive,
                                    ]}
                                    onPress={toggleBackground}
                                >
                                    <View style={[
                                        styles.toggleKnob,
                                        powerState.isBackgroundEnabled && styles.toggleKnobActive,
                                    ]} />
                                </TouchableOpacity>
                            </View>

                            {/* Current Profile Details */}
                            <Text style={styles.sectionTitle}>Mevcut Profil</Text>
                            <View style={styles.profileCard}>
                                <Text style={styles.profileName}>
                                    {powerState.currentProfile.name}
                                </Text>
                                <View style={styles.profileDetails}>
                                    <View style={styles.profileDetail}>
                                        <Text style={styles.detailLabel}>Tarama Süresi</Text>
                                        <Text style={styles.detailValue}>
                                            {powerState.currentProfile.scanDuration / 1000}s
                                        </Text>
                                    </View>
                                    <View style={styles.profileDetail}>
                                        <Text style={styles.detailLabel}>Tarama Aralığı</Text>
                                        <Text style={styles.detailValue}>
                                            {powerState.currentProfile.scanInterval / 1000}s
                                        </Text>
                                    </View>
                                    <View style={styles.profileDetail}>
                                        <Text style={styles.detailLabel}>Reklam Süresi</Text>
                                        <Text style={styles.detailValue}>
                                            {powerState.currentProfile.advertiseDuration / 1000}s
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Emergency Warning */}
                            {powerState.isEmergencyMode && (
                                <View style={styles.emergencyCard}>
                                    <Ionicons name="warning" size={24} color={THEME_COLORS.danger} />
                                    <View style={styles.emergencyInfo}>
                                        <Text style={styles.emergencyTitle}>ACİL MOD AKTİF</Text>
                                        <Text style={styles.emergencyText}>
                                            Maksimum güç tüketimi ile çalışılıyor. SOS aktif.
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </BlurView>
            </Modal>
        </>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    touchable: {
        width: '100%',
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: THEME_COLORS.border,
    },
    section: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: THEME_COLORS.border,
        marginHorizontal: 12,
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
    },
    profileBadge: {
        marginLeft: 'auto',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    profileText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
    },
    compactText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: THEME_COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        minHeight: '70%',
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: THEME_COLORS.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: THEME_COLORS.text,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        padding: 20,
    },
    statusCard: {
        backgroundColor: THEME_COLORS.card,
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statusInfo: {
        flex: 1,
    },
    statusValue: {
        fontSize: 28,
        fontWeight: '700',
        color: THEME_COLORS.text,
    },
    statusLabel: {
        fontSize: 14,
        color: THEME_COLORS.textSecondary,
    },
    estimatedTime: {
        marginTop: 12,
        fontSize: 13,
        color: THEME_COLORS.textSecondary,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME_COLORS.text,
        marginBottom: 12,
    },
    modeGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    modeButton: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        backgroundColor: THEME_COLORS.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    modeButtonActive: {
        backgroundColor: THEME_COLORS.primary,
        borderColor: THEME_COLORS.primary,
    },
    modeLabel: {
        marginTop: 8,
        fontSize: 12,
        color: THEME_COLORS.text,
        fontWeight: '500',
    },
    modeLabelActive: {
        color: '#fff',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: THEME_COLORS.border,
        marginBottom: 20,
    },
    toggleInfo: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME_COLORS.text,
    },
    toggleDescription: {
        fontSize: 13,
        color: THEME_COLORS.textSecondary,
        marginTop: 2,
    },
    toggleButton: {
        width: 52,
        height: 32,
        borderRadius: 16,
        backgroundColor: THEME_COLORS.card,
        padding: 3,
    },
    toggleButtonActive: {
        backgroundColor: THEME_COLORS.primary,
    },
    toggleKnob: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#fff',
    },
    toggleKnobActive: {
        transform: [{ translateX: 20 }],
    },
    profileCard: {
        backgroundColor: THEME_COLORS.card,
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '700',
        color: THEME_COLORS.text,
        marginBottom: 12,
    },
    profileDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    profileDetail: {
        flex: 1,
        minWidth: '30%',
    },
    detailLabel: {
        fontSize: 12,
        color: THEME_COLORS.textSecondary,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME_COLORS.text,
        marginTop: 4,
    },
    emergencyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        backgroundColor: 'rgba(244,67,54,0.15)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(244,67,54,0.3)',
    },
    emergencyInfo: {
        flex: 1,
    },
    emergencyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: THEME_COLORS.danger,
    },
    emergencyText: {
        fontSize: 12,
        color: THEME_COLORS.textSecondary,
        marginTop: 2,
    },
});

export default PowerIndicator;
