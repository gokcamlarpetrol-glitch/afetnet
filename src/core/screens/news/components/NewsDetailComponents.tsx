/**
 * NEWS DETAIL SCREEN - ELITE PERFORMANCE OPTIMIZED
 * Memoized components for maximum scroll performance
 */

import React, { memo, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles, CREAM_BACKGROUND } from '../styles/newsDetailStyles';
import { colors, typography } from '../../../theme';
import type { NewsArticle } from '../../../ai/types/news.types';

type TabType = 'summary' | 'original';

// ============================================================
// MEMOIZED HEADER COMPONENT
// ============================================================
interface NewsDetailHeaderProps {
    source: string;
    onBack: () => void;
    onShare: () => void;
}

export const NewsDetailHeader = memo(function NewsDetailHeader({
    source,
    onBack,
    onShare,
}: NewsDetailHeaderProps) {
    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={onBack}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <View style={styles.backButtonCircle}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </View>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {source || 'Haber'}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.shareButton}
                onPress={onShare}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <View style={styles.shareButtonCircle}>
                    <Ionicons name="share-outline" size={18} color="#0F172A" />
                </View>
            </TouchableOpacity>
        </View>
    );
});

// ============================================================
// MEMOIZED TITLE SECTION
// ============================================================
interface NewsTitleSectionProps {
    title: string;
    source: string;
    publishedAt?: string;
    magnitude?: number;
}

export const NewsTitleSection = memo(function NewsTitleSection({
    title,
    source,
    publishedAt,
    magnitude,
}: NewsTitleSectionProps) {
    const formattedDate = useMemo(() => {
        if (!publishedAt) return '';
        try {
            const date = new Date(publishedAt);
            return date.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return publishedAt;
        }
    }, [publishedAt]);

    return (
        <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.meta}>
                <Text style={styles.metaText}>{source}</Text>
                {publishedAt && (
                    <>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>{formattedDate}</Text>
                    </>
                )}
                {magnitude && magnitude > 0 && (
                    <>
                        <Text style={styles.metaDot}>•</Text>
                        <View style={styles.magnitudeBadge}>
                            <Text style={styles.magnitudeText}>{magnitude.toFixed(1)} ML</Text>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
});

// ============================================================
// MEMOIZED TAB BAR
// ============================================================
interface NewsDetailTabBarProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export const NewsDetailTabBar = memo(function NewsDetailTabBar({
    activeTab,
    onTabChange,
}: NewsDetailTabBarProps) {
    const handleSummaryPress = useCallback(() => {
        onTabChange('summary');
    }, [onTabChange]);

    const handleOriginalPress = useCallback(() => {
        onTabChange('original');
    }, [onTabChange]);

    return (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'summary' && styles.tabActive]}
                onPress={handleSummaryPress}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="sparkles"
                    size={16}
                    color={activeTab === 'summary' ? '#3B82F6' : '#64748B'}
                />
                <Text
                    style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}
                >
                    AI Özeti
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'original' && styles.tabActive]}
                onPress={handleOriginalPress}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="newspaper-outline"
                    size={16}
                    color={activeTab === 'original' ? '#3B82F6' : '#64748B'}
                />
                <Text
                    style={[styles.tabText, activeTab === 'original' && styles.tabTextActive]}
                >
                    Orijinal Haber
                </Text>
            </TouchableOpacity>
        </View>
    );
});

// ============================================================
// MEMOIZED AI SUMMARY CARD
// ============================================================
interface AISummaryCardProps {
    summary: string;
    loading: boolean;
}

export const AISummaryCard = memo(function AISummaryCard({
    summary,
    loading,
}: AISummaryCardProps) {
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>AI özeti hazırlanıyor...</Text>
            </View>
        );
    }

    if (!summary) {
        return (
            <View style={styles.emptySummaryContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#64748B" />
                <Text style={styles.emptySummaryText}>
                    Bu haber için özet oluşturulamadı.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
                <Ionicons name="sparkles" size={20} color="#3B82F6" />
                <Text style={styles.summaryTitle}>AI Özeti</Text>
            </View>
            <Text style={styles.summaryText}>{summary}</Text>
        </View>
    );
});

// ============================================================
// MEMOIZED ORIGINAL BUTTON
// ============================================================
interface OriginalButtonProps {
    onPress: () => void;
    hasValidUrl: boolean;
}

export const OriginalButton = memo(function OriginalButton({
    onPress,
    hasValidUrl,
}: OriginalButtonProps) {
    if (!hasValidUrl) return null;

    return (
        <TouchableOpacity style={styles.originalButton} onPress={onPress} activeOpacity={0.8}>
            <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.originalButtonGradient}
            >
                <Ionicons name="open-outline" size={18} color="#FFF" />
                <Text style={styles.originalButtonText}>Orijinal Haberi Oku</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
});

// ============================================================
// MEMOIZED DISCLAIMER
// ============================================================
export const AIDisclaimer = memo(function AIDisclaimer() {
    return (
        <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
            <Text style={styles.disclaimerText}>
                Bu özet yapay zeka tarafından otomatik olarak oluşturulmuştur. Tüm detaylar için orijinal haberi okuyunuz.
            </Text>
        </View>
    );
});

// ============================================================
// MEMOIZED LOADING INDICATOR
// ============================================================
interface LoadingIndicatorProps {
    text?: string;
}

export const LoadingIndicator = memo(function LoadingIndicator({
    text = 'Yükleniyor...',
}: LoadingIndicatorProps) {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>{text}</Text>
        </View>
    );
});

// Export all components
export default {
    NewsDetailHeader,
    NewsTitleSection,
    NewsDetailTabBar,
    AISummaryCard,
    OriginalButton,
    AIDisclaimer,
    LoadingIndicator,
};
