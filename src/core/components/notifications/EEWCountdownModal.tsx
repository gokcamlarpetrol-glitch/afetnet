/**
 * FULLSCREEN EEW COUNTDOWN MODAL - ELITE EDITION
 * 
 * Tam ekran deprem geri sayım deneyimi
 * Hayat kurtaran anlar için maksimum etki
 * 
 * Features:
 * - Full screen immersive experience
 * - Animated countdown with scale effects
 * - Seismic wave visualization
 * - Pulsing ring animations
 * - Action buttons (ÇÖK-KAPAN-TUTUN)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Modal,
    Pressable,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    Easing,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// TYPES
// ============================================================

interface EEWCountdownModalProps {
    visible: boolean;
    magnitude: number;
    location: string;
    initialSeconds: number;
    onComplete: () => void;
    onDismiss: () => void;
}

// ============================================================
// SEISMIC WAVE COMPONENT
// ============================================================

const SeismicWave: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        const startAnimation = () => {
            scale.value = 0;
            opacity.value = 1;
            scale.value = withRepeat(
                withTiming(3, { duration: 2000, easing: Easing.out(Easing.ease) }),
                -1,
                false
            );
            opacity.value = withRepeat(
                withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
                -1,
                false
            );
        };

        const timeout = setTimeout(startAnimation, delay);
        return () => clearTimeout(timeout);
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.seismicWave, { borderColor: color }, animatedStyle]} />
    );
};

// ============================================================
// PULSE RING COMPONENT
// ============================================================

const PulseRing: React.FC<{ size: number; delay: number }> = ({ size, delay }) => {
    const scale = useSharedValue(0.8);
    const opacity = useSharedValue(0);

    useEffect(() => {
        const timeout = setTimeout(() => {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 600 }),
                    withTiming(0.8, { duration: 600 })
                ),
                -1,
                true
            );
            opacity.value = withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 600 }),
                    withTiming(0.3, { duration: 600 })
                ),
                -1,
                true
            );
        }, delay);

        return () => clearTimeout(timeout);
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                styles.pulseRing,
                { width: size, height: size, borderRadius: size / 2 },
                animatedStyle
            ]}
        />
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const EEWCountdownModal: React.FC<EEWCountdownModalProps> = ({
    visible,
    magnitude,
    location,
    initialSeconds,
    onComplete,
    onDismiss,
}) => {
    const [countdown, setCountdown] = useState(initialSeconds);
    const [isCompleted, setIsCompleted] = useState(false);

    // Animation values
    const countdownScale = useSharedValue(1);
    const backgroundPulse = useSharedValue(0);
    const shakeX = useSharedValue(0);

    // Speak countdown
    const speakNumber = useCallback((num: number) => {
        if (num <= 5 && num > 0) {
            Speech.speak(String(num), { language: 'tr-TR', rate: 1.5, pitch: 1.2 });
        } else if (num === 0) {
            Speech.speak('DEPREM! ÇÖK KAPAN TUTUN!', { language: 'tr-TR', rate: 1.3, pitch: 1.4 });
        }
    }, []);

    // Haptic per second
    const hapticPulse = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, []);

    // Countdown logic
    useEffect(() => {
        if (!visible) {
            setCountdown(initialSeconds);
            setIsCompleted(false);
            return;
        }

        if (countdown <= 0) {
            setIsCompleted(true);
            runOnJS(onComplete)();
            return;
        }

        const timer = setInterval(() => {
            setCountdown(prev => {
                const newCount = prev - 1;
                runOnJS(hapticPulse)();
                runOnJS(speakNumber)(newCount);
                return newCount;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [visible, countdown, initialSeconds]);

    // Countdown animation
    useEffect(() => {
        if (visible) {
            countdownScale.value = withRepeat(
                withSequence(
                    withSpring(1.15, { damping: 8 }),
                    withSpring(1, { damping: 8 })
                ),
                -1,
                true
            );

            backgroundPulse.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 500 }),
                    withTiming(0, { duration: 500 })
                ),
                -1,
                true
            );

            // Shake effect
            shakeX.value = withRepeat(
                withSequence(
                    withTiming(-5, { duration: 50 }),
                    withTiming(5, { duration: 50 }),
                    withTiming(-3, { duration: 50 }),
                    withTiming(3, { duration: 50 }),
                    withTiming(0, { duration: 50 })
                ),
                -1,
                false
            );
        }
    }, [visible]);

    const countdownStyle = useAnimatedStyle(() => ({
        transform: [{ scale: countdownScale.value }],
    }));

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeX.value }],
    }));

    const bgStyle = useAnimatedStyle(() => ({
        opacity: interpolate(backgroundPulse.value, [0, 1], [0.9, 1]),
    }));

    // Urgency color based on time
    const getUrgencyColor = () => {
        if (countdown <= 3) return '#dc2626'; // Critical red
        if (countdown <= 10) return '#ea580c'; // Orange
        return '#eab308'; // Yellow
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            transparent={false}
        >
            <Animated.View style={[styles.container, containerStyle]}>
                <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
                    <LinearGradient
                        colors={['#1a0000', '#2d0000', '#1a0000']}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                {/* Seismic Waves */}
                <View style={styles.wavesContainer}>
                    <SeismicWave delay={0} color="rgba(239, 68, 68, 0.3)" />
                    <SeismicWave delay={500} color="rgba(239, 68, 68, 0.2)" />
                    <SeismicWave delay={1000} color="rgba(239, 68, 68, 0.1)" />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.magnitudeBadge}>
                        <Text style={styles.magnitudeLabel}>BÜYÜKLÜK</Text>
                        <Text style={styles.magnitudeValue}>M{magnitude.toFixed(1)}</Text>
                    </View>
                    <Text style={styles.location}>{location}</Text>
                </View>

                {/* Countdown Center */}
                <View style={styles.countdownCenter}>
                    <PulseRing size={250} delay={0} />
                    <PulseRing size={300} delay={200} />
                    <PulseRing size={350} delay={400} />

                    <Animated.View style={[styles.countdownCircle, countdownStyle]}>
                        <Text style={[styles.countdownNumber, { color: getUrgencyColor() }]}>
                            {isCompleted ? '!' : countdown}
                        </Text>
                        <Text style={styles.countdownLabel}>
                            {isCompleted ? 'DEPREM!' : 'SANİYE'}
                        </Text>
                    </Animated.View>
                </View>

                {/* Warning Message */}
                <View style={styles.warningContainer}>
                    <Text style={styles.warningTitle}>
                        {isCompleted ? 'KORUMA POZİSYONU!' : 'DEPREM YAKLAŞIYOR!'}
                    </Text>
                    <Text style={styles.warningSubtitle}>
                        {isCompleted
                            ? 'Sarsıntı geçene kadar pozisyonunuzu koruyun'
                            : 'ÇÖK - KAPAN - TUTUN pozisyonuna geçin'
                        }
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    <View style={styles.actionRow}>
                        <View style={styles.actionItem}>
                            <View style={[styles.actionIcon, { backgroundColor: '#dc2626' }]}>
                                <Ionicons name="arrow-down" size={32} color="#fff" />
                            </View>
                            <Text style={styles.actionLabel}>ÇÖK</Text>
                        </View>
                        <View style={styles.actionItem}>
                            <View style={[styles.actionIcon, { backgroundColor: '#ea580c' }]}>
                                <Ionicons name="shield" size={32} color="#fff" />
                            </View>
                            <Text style={styles.actionLabel}>KAPAN</Text>
                        </View>
                        <View style={styles.actionItem}>
                            <View style={[styles.actionIcon, { backgroundColor: '#16a34a' }]}>
                                <Ionicons name="hand-left" size={32} color="#fff" />
                            </View>
                            <Text style={styles.actionLabel}>TUTUN</Text>
                        </View>
                    </View>
                </View>

                {/* Dismiss Button */}
                <Pressable style={styles.dismissButton} onPress={onDismiss}>
                    <Text style={styles.dismissText}>Kapat</Text>
                </Pressable>
            </Animated.View>
        </Modal>
    );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a0000',
    },
    wavesContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 100,
        height: 100,
        marginLeft: -50,
        marginTop: -50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    seismicWave: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    magnitudeBadge: {
        backgroundColor: 'rgba(220, 38, 38, 0.9)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    magnitudeLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    magnitudeValue: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
    },
    location: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 18,
        marginTop: 16,
        textAlign: 'center',
    },
    countdownCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    countdownCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderWidth: 4,
        borderColor: 'rgba(239, 68, 68, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countdownNumber: {
        fontSize: 96,
        fontWeight: '900',
    },
    countdownLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 18,
        fontWeight: '600',
        marginTop: -10,
    },
    warningContainer: {
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 20,
    },
    warningTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
    },
    warningSubtitle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 8,
    },
    actionsContainer: {
        paddingHorizontal: 30,
        marginBottom: 30,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    actionItem: {
        alignItems: 'center',
    },
    actionIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 8,
    },
    dismissButton: {
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 40,
    },
    dismissText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
    },
});

export default EEWCountdownModal;
