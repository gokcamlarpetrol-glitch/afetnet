/**
 * PREMIUM ANIMATED NOTIFICATION OVERLAY - ELITE EDITION
 * 
 * Sinematik, animasyonlu bildirim deneyimi
 * Hayat kurtaran uyarılar için maksimum dikkat çekicilik
 * 
 * Features:
 * - Pulsing glow animations
 * - Shake effect for urgency
 * - Countdown with scale animation
 * - Particle effects (simulated)
 * - Premium glassmorphism
 */

import React, { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Image,
    Pressable,
    ImageSourcePropType,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    withDelay,
    Easing,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// TYPES
// ============================================================

export type NotificationType =
    | 'earthquake'
    | 'tsunami'
    | 'sos'
    | 'family_safe'
    | 'family_help'
    | 'mesh_message'
    | 'pwave'
    | 'countdown';

interface PremiumNotificationProps {
    visible: boolean;
    type: NotificationType;
    title: string;
    message: string;
    countdown?: number;
    magnitude?: number;
    onDismiss: () => void;
    onAction?: () => void;
    actionLabel?: string;
    customImage?: ImageSourcePropType;
}

// ============================================================
// NOTIFICATION IMAGES
// ============================================================

const NOTIFICATION_IMAGES: Record<NotificationType, ImageSourcePropType> = {
    earthquake: require('../../../assets/images/notifications/eew_earthquake_alert_1770221766310.png'),
    countdown: require('../../../assets/images/notifications/eew_countdown_timer_1770221782922.png'),
    family_safe: require('../../../assets/images/notifications/family_safe_notification_1770221814961.png'),
    sos: require('../../../assets/images/notifications/sos_emergency_button_1770221830420.png'),
    tsunami: require('../../../assets/images/notifications/tsunami_warning_card_1770221848885.png'),
    pwave: require('../../../assets/images/notifications/dynamic_pwave_animation_1770221882022.png'),
    family_help: require('../../../assets/images/notifications/animated_shield_protection_1770221896644.png'),
    mesh_message: require('../../../assets/images/notifications/mesh_network_pulse_1770221916360.png'),
};

// ============================================================
// GRADIENT COLORS
// ============================================================

const GRADIENT_COLORS: Record<NotificationType, readonly [string, string]> = {
    earthquake: ['rgba(220, 38, 38, 0.95)', 'rgba(127, 29, 29, 0.98)'] as const,
    tsunami: ['rgba(37, 99, 235, 0.95)', 'rgba(30, 58, 138, 0.98)'] as const,
    sos: ['rgba(239, 68, 68, 0.95)', 'rgba(153, 27, 27, 0.98)'] as const,
    family_safe: ['rgba(34, 197, 94, 0.95)', 'rgba(21, 128, 61, 0.98)'] as const,
    family_help: ['rgba(245, 158, 11, 0.95)', 'rgba(180, 83, 9, 0.98)'] as const,
    mesh_message: ['rgba(59, 130, 246, 0.95)', 'rgba(37, 99, 235, 0.98)'] as const,
    pwave: ['rgba(239, 68, 68, 0.95)', 'rgba(185, 28, 28, 0.98)'] as const,
    countdown: ['rgba(220, 38, 38, 0.98)', 'rgba(127, 29, 29, 0.99)'] as const,
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const PremiumAnimatedNotification: React.FC<PremiumNotificationProps> = ({
    visible,
    type,
    title,
    message,
    countdown,
    magnitude,
    onDismiss,
    onAction,
    actionLabel = 'Tamam',
    customImage,
}) => {
    // Animation values
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);
    const pulseGlow = useSharedValue(0);
    const shakeX = useSharedValue(0);
    const countdownScale = useSharedValue(1);
    const ringProgress = useSharedValue(0);

    // Trigger haptic feedback
    const triggerHaptic = useCallback(() => {
        if (type === 'earthquake' || type === 'sos' || type === 'pwave') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (type === 'family_help') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [type]);

    // Entry/Exit animation
    useEffect(() => {
        if (visible) {
            runOnJS(triggerHaptic)();

            // Entry
            opacity.value = withTiming(1, { duration: 200 });
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });

            // Pulsing glow
            pulseGlow.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );

            // Shake for urgent types
            if (type === 'earthquake' || type === 'sos' || type === 'pwave') {
                shakeX.value = withRepeat(
                    withSequence(
                        withTiming(-8, { duration: 50 }),
                        withTiming(8, { duration: 50 }),
                        withTiming(-6, { duration: 50 }),
                        withTiming(6, { duration: 50 }),
                        withTiming(0, { duration: 50 })
                    ),
                    3,
                    false
                );
            }

            // Ring progress for countdown
            if (countdown && countdown > 0) {
                ringProgress.value = withTiming(1, {
                    duration: countdown * 1000,
                    easing: Easing.linear
                });
            }
        } else {
            opacity.value = withTiming(0, { duration: 200 });
            scale.value = withTiming(0.8, { duration: 200 });
        }
    }, [visible, type, countdown]);

    // Countdown scale animation
    useEffect(() => {
        if (countdown && countdown > 0 && visible) {
            countdownScale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 400 }),
                    withTiming(1, { duration: 400 })
                ),
                -1,
                true
            );
        }
    }, [countdown, visible]);

    // Animated styles
    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { scale: scale.value } as const,
            { translateX: shakeX.value } as const,
        ] as const,
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseGlow.value, [0, 1], [0.3, 0.8]),
        transform: [{ scale: interpolate(pulseGlow.value, [0, 1], [1, 1.05]) }],
    }));

    const countdownStyle = useAnimatedStyle(() => ({
        transform: [{ scale: countdownScale.value }],
    }));

    const ringStyle = useAnimatedStyle(() => ({
        opacity: ringProgress.value,
    }));

    if (!visible) return null;

    const imageSource = customImage || NOTIFICATION_IMAGES[type];
    const gradientColors = GRADIENT_COLORS[type];

    return (
        <View style={styles.overlay}>
            <BlurView intensity={50} style={StyleSheet.absoluteFill} tint="dark" />

            <Animated.View style={[styles.container, containerStyle]}>
                {/* Pulsing Glow Effect */}
                <Animated.View style={[styles.glowEffect, glowStyle]}>
                    <LinearGradient
                        colors={gradientColors}
                        style={styles.glowGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                </Animated.View>

                {/* Main Card */}
                <LinearGradient
                    colors={['rgba(30, 30, 30, 0.95)', 'rgba(15, 15, 15, 0.98)']}
                    style={styles.card}
                >
                    {/* Custom Image */}
                    <View style={styles.imageContainer}>
                        <Image
                            source={imageSource}
                            style={styles.notificationImage}
                            resizeMode="cover"
                        />

                        {/* Magnitude Badge */}
                        {magnitude && (
                            <View style={styles.magnitudeBadge}>
                                <Text style={styles.magnitudeText}>
                                    M{magnitude.toFixed(1)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>

                        {/* Countdown Display */}
                        {countdown !== undefined && countdown > 0 && (
                            <Animated.View style={[styles.countdownContainer, countdownStyle]}>
                                <Animated.View style={[styles.countdownRing, ringStyle]} />
                                <Text style={styles.countdownNumber}>{countdown}</Text>
                                <Text style={styles.countdownLabel}>SANİYE</Text>
                            </Animated.View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {onAction && (
                            <Pressable
                                style={[styles.actionButton, styles.primaryButton]}
                                onPress={onAction}
                            >
                                <Text style={styles.actionButtonText}>{actionLabel}</Text>
                            </Pressable>
                        )}
                        <Pressable
                            style={[styles.actionButton, styles.dismissButton]}
                            onPress={onDismiss}
                        >
                            <Ionicons name="close" size={20} color="#fff" />
                        </Pressable>
                    </View>
                </LinearGradient>
            </Animated.View>
        </View>
    );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    container: {
        width: SCREEN_WIDTH * 0.9,
        maxWidth: 400,
    },
    glowEffect: {
        position: 'absolute',
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        borderRadius: 32,
        overflow: 'hidden',
    },
    glowGradient: {
        flex: 1,
        borderRadius: 32,
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    imageContainer: {
        width: '100%',
        height: 200,
        position: 'relative',
    },
    notificationImage: {
        width: '100%',
        height: '100%',
    },
    magnitudeBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(220, 38, 38, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    magnitudeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        lineHeight: 22,
    },
    countdownContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    countdownRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    countdownNumber: {
        fontSize: 56,
        fontWeight: '900',
        color: '#ef4444',
    },
    countdownLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: -4,
    },
    actions: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    actionButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
    },
    dismissButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        flex: 0,
        width: 48,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default PremiumAnimatedNotification;
