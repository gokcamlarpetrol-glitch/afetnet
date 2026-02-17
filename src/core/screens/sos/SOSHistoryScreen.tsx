/**
 * SOS HISTORY SCREEN - ELITE V2
 * View past SOS signals with location, status, and response tracking
 * 
 * FEATURES:
 * - Timeline view of all past SOS signals
 * - Status badges (active, resolved, cancelled)
 * - Location details with map link
 * - Response/ACK count
 * - Channel delivery breakdown
 */

import React, { useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Platform,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSOSStore, SOSSignal, SOSStatus, EmergencyReason } from '../../services/sos/SOSStateManager';
import { colors, typography } from '../../theme';
import * as haptics from '../../utils/haptics';

// ELITE: Status configuration
const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
    active: { color: '#ef4444', icon: 'alert-circle', label: 'Aktif' },
    broadcasting: { color: '#f59e0b', icon: 'radio', label: 'Yayınlanıyor' },
    countdown: { color: '#f59e0b', icon: 'timer', label: 'Geri Sayım' },
    resolved: { color: '#22c55e', icon: 'checkmark-circle', label: 'Çözüldü' },
    cancelled: { color: '#94a3b8', icon: 'close-circle', label: 'İptal Edildi' },
    idle: { color: '#64748b', icon: 'ellipse', label: 'Bilinmiyor' },
};

// ELITE: Reason labels
const REASON_LABELS: Record<string, string> = {
    MANUAL_SOS: 'Manuel SOS',
    IMPACT_DETECTED: 'Çarpma Algılandı',
    INACTIVITY_TIMEOUT: 'Hareketsizlik',
    LOW_BATTERY: 'Düşük Pil',
    FAMILY_PANIC: 'Aile Paniği',
    TRAPPED_DETECTED: 'Enkaz Altında',
};

interface SOSHistoryScreenProps {
    navigation: {
        goBack: () => void;
        navigate: (screen: string, params?: Record<string, unknown>) => void;
    };
}

// ELITE: Format timestamp to readable string
const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Bugün ${timeStr}`;
    if (isYesterday) return `Dün ${timeStr}`;
    return `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${timeStr}`;
};

// ELITE: Duration formatter
const formatDuration = (startMs: number, endMs: number): string => {
    const diffSec = Math.floor((endMs - startMs) / 1000);
    if (diffSec < 60) return `${diffSec} sn`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk`;
    return `${Math.floor(diffSec / 3600)} sa ${Math.floor((diffSec % 3600) / 60)} dk`;
};

// ELITE: History Item Component
const SOSHistoryItem = ({
    signal,
    index,
    onPress,
}: {
    signal: SOSSignal;
    index: number;
    onPress: (signal: SOSSignal) => void;
}) => {
    const statusKey = signal.status as string;
    const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.idle;
    const reasonLabel = REASON_LABELS[signal.reason as string] || signal.reason;

    const channelResults = useMemo(() => {
        const channels = signal.channels;
        let succeeded = 0;
        let total = 0;
        if (channels) {
            const entries = Object.entries(channels) as [string, string][];
            total = entries.length;
            succeeded = entries.filter(([, status]) => status === 'sent' || status === 'acknowledged').length;
        }
        return { succeeded, total };
    }, [signal.channels]);

    return (
        <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
            <Pressable
                onPress={() => onPress(signal)}
                style={({ pressed }) => [
                    styles.historyItem,
                    pressed && styles.historyItemPressed,
                ]}
            >
                {/* Status indicator */}
                <View style={[styles.statusDot, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon as any} size={18} color="#fff" />
                </View>

                <View style={styles.itemContent}>
                    {/* Header */}
                    <View style={styles.itemHeader}>
                        <View style={styles.itemTitleRow}>
                            <Text style={styles.itemTitle}>🆘 SOS Sinyali</Text>
                            <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
                                <Text style={[styles.statusBadgeText, { color: config.color }]}>
                                    {config.label}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.itemTime}>{formatDate(signal.timestamp)}</Text>
                    </View>

                    {/* Reason */}
                    <Text style={styles.itemReason}>{reasonLabel}</Text>

                    {/* Message */}
                    {signal.message && (
                        <Text style={styles.itemMessage} numberOfLines={2}>
                            {signal.message}
                        </Text>
                    )}

                    {/* Stats row */}
                    <View style={styles.statsRow}>
                        {/* Location */}
                        {signal.location && (
                            <View style={styles.statItem}>
                                <Ionicons name="location" size={14} color="#64748b" />
                                <Text style={styles.statText}>
                                    {signal.location.latitude.toFixed(4)}, {signal.location.longitude.toFixed(4)}
                                </Text>
                            </View>
                        )}

                        {/* ACK count */}
                        <View style={styles.statItem}>
                            <Ionicons name="people" size={14} color="#64748b" />
                            <Text style={styles.statText}>
                                {signal.acks?.length || 0} yanıt
                            </Text>
                        </View>

                        {/* Channel delivery */}
                        <View style={styles.statItem}>
                            <Ionicons name="radio" size={14} color="#64748b" />
                            <Text style={styles.statText}>
                                {channelResults.succeeded}/{channelResults.total} kanal
                            </Text>
                        </View>
                    </View>
                </View>

                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </Pressable>
        </Animated.View>
    );
};

export default function SOSHistoryScreen({ navigation }: SOSHistoryScreenProps) {
    const insets = useSafeAreaInsets();
    const signalHistory = useSOSStore((state) => state.signalHistory);

    // Sort by newest first
    const sortedHistory = useMemo(() => {
        return [...signalHistory].sort((a, b) => b.timestamp - a.timestamp);
    }, [signalHistory]);

    const handleSignalPress = useCallback(
        (signal: SOSSignal) => {
            haptics.impactLight();
            // Open location in maps if available
            if (signal.location) {
                const url = Platform.select({
                    ios: `maps:0,0?q=${signal.location.latitude},${signal.location.longitude}(SOS)`,
                    android: `geo:0,0?q=${signal.location.latitude},${signal.location.longitude}(SOS)`,
                    default: `https://maps.google.com/?q=${signal.location.latitude},${signal.location.longitude}`,
                });
                if (url) {
                    Linking.openURL(url).catch(() => { });
                }
            }
        },
        []
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </Pressable>
                <Text style={styles.headerTitle}>SOS Geçmişi</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Stats Summary */}
            {sortedHistory.length > 0 && (
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{sortedHistory.length}</Text>
                        <Text style={styles.summaryLabel}>Toplam</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: '#22c55e' }]}>
                            {sortedHistory.filter((s) => s.status === ('resolved' as SOSStatus)).length}
                        </Text>
                        <Text style={styles.summaryLabel}>Çözüldü</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>
                            {sortedHistory.reduce((sum, s) => sum + (s.acks?.length || 0), 0)}
                        </Text>
                        <Text style={styles.summaryLabel}>Yanıtlar</Text>
                    </View>
                </View>
            )}

            {/* History List */}
            <FlatList
                data={sortedHistory}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <SOSHistoryItem
                        signal={item}
                        index={index}
                        onPress={handleSignalPress}
                    />
                )}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: insets.bottom + 20,
                    flexGrow: 1,
                }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
                        </View>
                        <Text style={styles.emptyTitle}>Henüz SOS geçmişi yok</Text>
                        <Text style={styles.emptySubtext}>
                            Gönderilen SOS sinyalleriniz burada görünecek
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },

    // Summary
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 16,
        paddingHorizontal: 24,
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            },
            android: { elevation: 2 },
        }),
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#e2e8f0',
    },

    // History Item
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: { elevation: 1 },
        }),
    },
    historyItemPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    statusDot: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemContent: {
        flex: 1,
    },
    itemHeader: {
        marginBottom: 4,
    },
    itemTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    itemTime: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    itemReason: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    itemMessage: {
        fontSize: 13,
        color: '#475569',
        marginTop: 4,
        fontStyle: 'italic',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
        flexWrap: 'wrap',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 11,
        color: '#64748b',
    },

    // Empty
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#22c55e10',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 6,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        maxWidth: 260,
    },
});
