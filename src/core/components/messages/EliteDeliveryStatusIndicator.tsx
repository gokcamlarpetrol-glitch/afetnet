/**
 * ELITE DELIVERY STATUS INDICATOR - PREMIUM EDITION
 * 
 * World-class message delivery status visualization.
 * Features premium animations and accessibility support.
 * 
 * DELIVERY STATES:
 * 1. PENDING   - Message queued, not sent
 * 2. SENDING   - Actively transmitting
 * 3. SENT      - Server received (single check)
 * 4. DELIVERED - Recipient received (double check)
 * 5. READ      - Recipient viewed (double check blue)
 * 6. FAILED    - Delivery failed
 * 
 * DESIGN REFERENCES:
 * - WhatsApp double-check system
 * - Telegram premium indicators
 * - iMessage delivery receipts
 * 
 * @author AfetNet Elite Team
 * @version 2.0.0
 */

import React, { memo, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, AccessibilityInfo } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withSpring,
    interpolate,
    Easing,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// ============================================================================
// TYPES
// ============================================================================

export type DeliveryState =
    | 'pending'
    | 'sending'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed';

export interface DeliveryStatusIndicatorProps {
    status: DeliveryState;
    timestamp?: number;
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
    showTimestamp?: boolean;
    onRetry?: () => void;
    testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_CONFIG: Record<DeliveryState, {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    accessibilityLabel: string;
}> = {
    pending: {
        icon: 'time-outline',
        color: colors.text.muted,
        label: 'Bekliyor',
        accessibilityLabel: 'Mesaj gönderilmeyi bekliyor',
    },
    sending: {
        icon: 'cloud-upload-outline',
        color: colors.primary.main,
        label: 'Gönderiliyor',
        accessibilityLabel: 'Mesaj gönderiliyor',
    },
    sent: {
        icon: 'checkmark',
        color: colors.text.muted,
        label: 'Gönderildi',
        accessibilityLabel: 'Mesaj sunucuya gönderildi',
    },
    delivered: {
        icon: 'checkmark-done',
        color: colors.text.muted,
        label: 'İletildi',
        accessibilityLabel: 'Mesaj alıcıya iletildi',
    },
    read: {
        icon: 'checkmark-done',
        color: colors.primary.main,
        label: 'Okundu',
        accessibilityLabel: 'Mesaj okundu',
    },
    failed: {
        icon: 'alert-circle',
        color: colors.status.danger,
        label: 'Başarısız',
        accessibilityLabel: 'Mesaj gönderilemedi. Tekrar denemek için dokunun.',
    },
};

const SIZE_CONFIG = {
    small: { iconSize: 14, fontSize: 10, spacing: 2 },
    medium: { iconSize: 16, fontSize: 12, spacing: 4 },
    large: { iconSize: 20, fontSize: 14, spacing: 6 },
};

// ============================================================================
// ANIMATED ICONS
// ============================================================================

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

const PendingAnimation: React.FC<{ size: number; color: string }> = memo(({ size, color }) => {
    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );
    }, [rotation]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
        <Animated.View style={animatedStyle}>
            <Ionicons name="time-outline" size={size} color={color} />
        </Animated.View>
    );
});

const SendingAnimation: React.FC<{ size: number; color: string }> = memo(({ size, color }) => {
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        translateY.value = withRepeat(
            withSequence(
                withTiming(-4, { duration: 500 }),
                withTiming(0, { duration: 500 })
            ),
            -1,
            true
        );
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.5, { duration: 500 }),
                withTiming(1, { duration: 500 })
            ),
            -1,
            true
        );
    }, [translateY, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={animatedStyle}>
            <Ionicons name="cloud-upload-outline" size={size} color={color} />
        </Animated.View>
    );
});

const DoubleCheckAnimation: React.FC<{
    size: number;
    color: string;
    showSecond: boolean;
}> = memo(({ size, color, showSecond }) => {
    const firstCheck = useSharedValue(0);
    const secondCheck = useSharedValue(0);

    useEffect(() => {
        firstCheck.value = withSpring(1, { damping: 12, stiffness: 100 });
        if (showSecond) {
            secondCheck.value = withSequence(
                withTiming(0, { duration: 0 }),
                withSpring(1, { damping: 12, stiffness: 100 })
            );
        }
    }, [firstCheck, secondCheck, showSecond]);

    const firstStyle = useAnimatedStyle(() => ({
        opacity: firstCheck.value,
        transform: [{ scale: firstCheck.value }],
    }));

    const secondStyle = useAnimatedStyle(() => ({
        opacity: secondCheck.value,
        transform: [{ scale: secondCheck.value }],
        position: 'absolute' as const,
        left: size * 0.4,
    }));

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={firstStyle}>
                <Ionicons name="checkmark" size={size} color={color} />
            </Animated.View>
            {showSecond && (
                <Animated.View style={secondStyle}>
                    <Ionicons name="checkmark" size={size} color={color} />
                </Animated.View>
            )}
        </View>
    );
});

const FailedAnimation: React.FC<{ size: number; color: string }> = memo(({ size, color }) => {
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 400 }),
                withTiming(1, { duration: 400 })
            ),
            3,
            true
        );
    }, [scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={animatedStyle}>
            <Ionicons name="alert-circle" size={size} color={color} />
        </Animated.View>
    );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EliteDeliveryStatusIndicator: React.FC<DeliveryStatusIndicatorProps> = memo(({
    status,
    timestamp,
    size = 'medium',
    showLabel = false,
    showTimestamp = false,
    onRetry,
    testID,
}) => {
    const config = STATUS_CONFIG[status];
    const sizeConfig = SIZE_CONFIG[size];

    // Format timestamp
    const formattedTime = useMemo(() => {
        if (!timestamp || !showTimestamp) return null;
        const date = new Date(timestamp);
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }, [timestamp, showTimestamp]);

    // Render appropriate icon
    const renderIcon = () => {
        const { iconSize, color } = { iconSize: sizeConfig.iconSize, color: config.color };

        switch (status) {
            case 'pending':
                return <PendingAnimation size={iconSize} color={color} />;
            case 'sending':
                return <SendingAnimation size={iconSize} color={color} />;
            case 'sent':
                return (
                    <Animated.View entering={FadeIn.duration(200)}>
                        <Ionicons name="checkmark" size={iconSize} color={color} />
                    </Animated.View>
                );
            case 'delivered':
                return <DoubleCheckAnimation size={iconSize} color={color} showSecond={true} />;
            case 'read':
                return <DoubleCheckAnimation size={iconSize} color={config.color} showSecond={true} />;
            case 'failed':
                return <FailedAnimation size={iconSize} color={color} />;
            default:
                return <Ionicons name={config.icon} size={iconSize} color={color} />;
        }
    };

    const content = (
        <View
            style={styles.container}
            testID={testID}
            accessibilityLabel={config.accessibilityLabel}
            accessibilityRole="text"
        >
            {showTimestamp && formattedTime && (
                <Text style={[styles.timestamp, { fontSize: sizeConfig.fontSize }]}>
                    {formattedTime}
                </Text>
            )}

            <View style={[styles.iconContainer, { marginLeft: sizeConfig.spacing }]}>
                {renderIcon()}
            </View>

            {showLabel && (
                <Text
                    style={[
                        styles.label,
                        {
                            fontSize: sizeConfig.fontSize,
                            color: config.color,
                            marginLeft: sizeConfig.spacing,
                        }
                    ]}
                >
                    {config.label}
                </Text>
            )}
        </View>
    );

    // If failed and has retry callback, wrap in touchable
    if (status === 'failed' && onRetry) {
        return (
            <TouchableOpacity
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Tekrar dene"
                accessibilityHint="Mesajı tekrar göndermek için dokunun"
            >
                {content}
            </TouchableOpacity>
        );
    }

    return content;
});

// ============================================================================
// EXTENDED DELIVERY REPORT COMPONENT
// ============================================================================

export interface DetailedDeliveryReport {
    messageId: string;
    status: DeliveryState;
    sentAt?: number;
    deliveredAt?: number;
    readAt?: number;
    recipientName?: string;
    failureReason?: string;
    retryCount?: number;
    channel?: 'cloud' | 'mesh' | 'hybrid';
}

export interface EliteDeliveryReportCardProps {
    report: DetailedDeliveryReport;
    onRetry?: () => void;
    onDismiss?: () => void;
}

export const EliteDeliveryReportCard: React.FC<EliteDeliveryReportCardProps> = memo(({
    report,
    onRetry,
    onDismiss,
}) => {
    const formatTime = (timestamp?: number) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
        });
    };

    const getChannelLabel = (channel?: string) => {
        switch (channel) {
            case 'cloud': return '☁️ Bulut';
            case 'mesh': return '📡 Mesh';
            case 'hybrid': return '🔄 Hibrit';
            default: return '-';
        }
    };

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={styles.reportCard}
        >
            <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>Teslimat Raporu</Text>
                {onDismiss && (
                    <TouchableOpacity onPress={onDismiss}>
                        <Ionicons name="close" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Durum:</Text>
                <EliteDeliveryStatusIndicator
                    status={report.status}
                    showLabel
                    size="medium"
                />
            </View>

            <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Alıcı:</Text>
                <Text style={styles.reportValue}>{report.recipientName || 'Bilinmiyor'}</Text>
            </View>

            <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Kanal:</Text>
                <Text style={styles.reportValue}>{getChannelLabel(report.channel)}</Text>
            </View>

            <View style={styles.reportDivider} />

            <View style={styles.reportTimeline}>
                <TimelineItem
                    label="Gönderildi"
                    time={formatTime(report.sentAt)}
                    isActive={!!report.sentAt}
                    isFirst
                />
                <TimelineItem
                    label="İletildi"
                    time={formatTime(report.deliveredAt)}
                    isActive={!!report.deliveredAt}
                />
                <TimelineItem
                    label="Okundu"
                    time={formatTime(report.readAt)}
                    isActive={!!report.readAt}
                    isLast
                />
            </View>

            {report.status === 'failed' && (
                <View style={styles.failureSection}>
                    <View style={styles.failureInfo}>
                        <Ionicons name="warning" size={16} color={colors.status.danger} />
                        <Text style={styles.failureText}>
                            {report.failureReason || 'Bağlantı hatası'}
                        </Text>
                    </View>
                    {report.retryCount && report.retryCount > 0 && (
                        <Text style={styles.retryCount}>
                            {report.retryCount} deneme yapıldı
                        </Text>
                    )}
                    {onRetry && (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={onRetry}
                            accessibilityRole="button"
                            accessibilityLabel="Tekrar dene"
                        >
                            <Ionicons name="refresh" size={16} color="#fff" />
                            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </Animated.View>
    );
});

// ============================================================================
// TIMELINE ITEM
// ============================================================================

interface TimelineItemProps {
    label: string;
    time: string;
    isActive: boolean;
    isFirst?: boolean;
    isLast?: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = memo(({
    label,
    time,
    isActive,
    isFirst,
    isLast,
}) => {
    return (
        <View style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
                {!isFirst && (
                    <View style={[
                        styles.timelineLine,
                        isActive && styles.timelineLineActive
                    ]} />
                )}
                <View style={[
                    styles.timelineDot,
                    isActive && styles.timelineDotActive
                ]}>
                    {isActive && (
                        <Ionicons name="checkmark" size={10} color="#fff" />
                    )}
                </View>
                {!isLast && (
                    <View style={[
                        styles.timelineLine,
                        styles.timelineLineBottom,
                        isActive && styles.timelineLineActive
                    ]} />
                )}
            </View>
            <View style={styles.timelineContent}>
                <Text style={[
                    styles.timelineLabel,
                    isActive && styles.timelineLabelActive
                ]}>
                    {label}
                </Text>
                <Text style={styles.timelineTime}>{time}</Text>
            </View>
        </View>
    );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        minWidth: 20,
        alignItems: 'center',
    },
    timestamp: {
        color: colors.text.muted,
        fontVariant: ['tabular-nums'],
    },
    label: {
        fontWeight: '500',
    },

    // Report Card
    reportCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    reportTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    reportRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    reportLabel: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    reportValue: {
        fontSize: 14,
        color: colors.text.primary,
        fontWeight: '500',
    },
    reportDivider: {
        height: 1,
        backgroundColor: colors.border.light,
        marginVertical: 12,
    },

    // Timeline
    reportTimeline: {
        paddingVertical: 8,
    },
    timelineItem: {
        flexDirection: 'row',
        height: 40,
    },
    timelineLeft: {
        width: 24,
        alignItems: 'center',
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: colors.border.light,
    },
    timelineLineBottom: {
        position: 'absolute',
        bottom: 0,
        top: 18,
        height: 22,
    },
    timelineLineActive: {
        backgroundColor: colors.primary.main,
    },
    timelineDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.border.light,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineDotActive: {
        backgroundColor: colors.primary.main,
    },
    timelineContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 12,
    },
    timelineLabel: {
        fontSize: 14,
        color: colors.text.muted,
    },
    timelineLabelActive: {
        color: colors.text.primary,
        fontWeight: '500',
    },
    timelineTime: {
        fontSize: 12,
        color: colors.text.muted,
        fontVariant: ['tabular-nums'],
    },

    // Failure Section
    failureSection: {
        marginTop: 12,
        padding: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
    },
    failureInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    failureText: {
        fontSize: 14,
        color: colors.status.danger,
        flex: 1,
    },
    retryCount: {
        fontSize: 12,
        color: colors.text.muted,
        marginTop: 4,
        marginLeft: 24,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary.main,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 12,
        gap: 6,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});

// ============================================================================
// EXPORTS
// ============================================================================

export default EliteDeliveryStatusIndicator;
