/**
 * MY QR SCREEN - Elite Edition
 * Shows user's own QR code for others to scan and add as contact
 * 
 * Features:
 * - Display QR code with user identity
 * - Share QR payload
 * - Copy QR payload to clipboard
 * - Animated presentation
 * 
 * @author AfetNet Elite Messaging System
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Share,
    Alert,
    Dimensions,
    Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';
import { identityService } from '../../services/IdentityService';
import { colors, typography, spacing, borderRadius } from '../../theme';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MyQRScreen');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH - 100, 280);

interface MyQRScreenProps {
    navigation: StackNavigationProp<ParamListBase>;
}

export default function MyQRScreen({ navigation }: MyQRScreenProps) {
    const insets = useSafeAreaInsets();
    const [qrPayload, setQrPayload] = useState<string>('');
    const [userName, setUserName] = useState<string>('');
    const [userId, setUserId] = useState<string>('');

    // Pulse animation for QR code
    const pulseAnim = useRef(new RNAnimated.Value(1)).current;

    useEffect(() => {
        // Initialize identity and get QR payload
        const loadIdentity = async () => {
            await identityService.initialize();
            const payload = identityService.getQRPayload();
            const name = identityService.getDisplayName();
            const id = identityService.getMyId();

            setQrPayload(payload);
            setUserName(name || 'AfetNet Kullanıcısı');
            setUserId(id || '');
        };

        loadIdentity();
    }, []);

    // Start pulse animation
    useEffect(() => {
        const pulse = RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                RNAnimated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    // Copy QR payload to clipboard
    const handleCopy = useCallback(async () => {
        if (!qrPayload) return;

        await Clipboard.setStringAsync(qrPayload);
        haptics.notificationSuccess();
        Alert.alert('Kopyalandı', 'Kimlik bilgisi panoya kopyalandı.');
    }, [qrPayload]);

    // Share QR payload as text
    const handleShare = useCallback(async () => {
        try {
            haptics.impactMedium();

            await Share.share({
                message: `AfetNet ile beni ekle:\n\n${qrPayload}\n\nAfetNet uygulamasını açıp bu kodu QR tarayıcısında kullanabilirsin.`,
                title: 'AfetNet Kişi Bilgisi',
            });
        } catch (error) {
            logger.error('Share error:', error);
            Alert.alert('Hata', 'Paylaşım başarısız. Lütfen tekrar deneyin.');
        }
    }, [qrPayload]);

    // Copy short ID to clipboard
    const handleCopyId = useCallback(async () => {
        if (!userId) return;

        await Clipboard.setStringAsync(userId);
        haptics.notificationSuccess();
        Alert.alert('Kopyalandı', 'Kullanıcı ID panoya kopyalandı.');
    }, [userId]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <LinearGradient
                colors={['#0f172a', '#1e293b', '#334155']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.headerTitle}>QR Kodum</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            {/* QR Code Card */}
            <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.cardContainer}>
                <RNAnimated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
                    <BlurView intensity={40} tint="light" style={styles.cardBlur}>
                        <View style={styles.qrContainer}>
                            {/* User Info */}
                            <View style={styles.userInfo}>
                                <View style={styles.avatarCircle}>
                                    <Ionicons name="person" size={32} color="#0ea5e9" />
                                </View>
                                <Text style={styles.userName}>{userName}</Text>
                                <Pressable onPress={handleCopyId}>
                                    <Text style={styles.userIdText}>ID: {userId.slice(0, 12)}... 📋</Text>
                                </Pressable>
                            </View>

                            {/* QR Code */}
                            <View style={styles.qrWrapper}>
                                {qrPayload ? (
                                    <QRCode
                                        value={qrPayload}
                                        size={QR_SIZE}
                                        color="#1e293b"
                                        backgroundColor="#ffffff"
                                    />
                                ) : (
                                    <View style={[styles.qrPlaceholder, { width: QR_SIZE, height: QR_SIZE }]}>
                                        <Ionicons name="qr-code" size={80} color="#94a3b8" />
                                        <Text style={styles.placeholderText}>Yükleniyor...</Text>
                                    </View>
                                )}
                            </View>

                            {/* Instructions */}
                            <Text style={styles.instructions}>
                                Bu QR kodu taratarak kişi olarak eklenebilirsiniz
                            </Text>
                        </View>
                    </BlurView>
                </RNAnimated.View>
            </Animated.View>

            {/* Action Buttons */}
            <Animated.View entering={FadeInUp.delay(400)} style={styles.actionsContainer}>
                <Pressable
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
                    onPress={handleShare}
                >
                    <View style={[styles.actionIcon, { backgroundColor: 'rgba(14, 165, 233, 0.2)' }]}>
                        <Ionicons name="share-outline" size={24} color="#0ea5e9" />
                    </View>
                    <Text style={styles.actionLabel}>Paylaş</Text>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
                    onPress={handleCopy}
                >
                    <View style={[styles.actionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                        <Ionicons name="copy-outline" size={24} color="#22c55e" />
                    </View>
                    <Text style={styles.actionLabel}>Kopyala</Text>
                </Pressable>
            </Animated.View>

            {/* Footer Tip */}
            <Animated.View entering={FadeInUp.delay(500)} style={styles.footer}>
                <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
                <Text style={styles.footerText}>
                    Güvenli ve şifreli iletişim için kişilerinizi QR ile ekleyin
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.h2.fontSize,
        fontWeight: '700',
        color: '#fff',
    },
    cardContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    card: {
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    cardBlur: {
        padding: spacing.lg,
    },
    qrContainer: {
        backgroundColor: '#ffffff',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
    },
    userInfo: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    userName: {
        fontSize: typography.h3.fontSize,
        fontWeight: '700',
        color: '#1e293b',
    },
    userIdText: {
        fontSize: typography.caption.fontSize,
        color: '#64748b',
        marginTop: 4,
    },
    qrWrapper: {
        padding: spacing.md,
        backgroundColor: '#ffffff',
        borderRadius: borderRadius.md,
        marginVertical: spacing.md,
    },
    qrPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: borderRadius.md,
    },
    placeholderText: {
        marginTop: spacing.sm,
        color: '#94a3b8',
        fontSize: typography.bodySmall.fontSize,
    },
    instructions: {
        fontSize: typography.bodySmall.fontSize,
        color: '#64748b',
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xl,
        paddingVertical: spacing.lg,
    },
    actionButton: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    actionPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
    actionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionLabel: {
        fontSize: typography.caption.fontSize,
        color: '#94a3b8',
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    footerText: {
        fontSize: typography.caption.fontSize,
        color: '#64748b',
        textAlign: 'center',
        flex: 1,
    },
});
