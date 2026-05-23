/**
 * EULA FALLBACK SCREEN — TIER1-07 defense-in-depth Layer 1
 *
 * Renders BLOCKING UI when EULAModal crashes (BlurView ROM bugs, Zustand
 * hydration race, etc.) — replaces the old `fallback={null}` which silently
 * bypassed mandatory ToS/KVKK consent (Apple 1.2/5.1.1 + KVKK Madde 7 risk).
 *
 * Design:
 *  - Zero deps on Zustand stores, BlurView, navigation, theming
 *  - Pure RN primitives (View, Text, Pressable, ActivityIndicator)
 *  - Non-dismissible — there's no close/skip path
 *  - "Yeniden Başlat" reloads the JS bundle → modal gets a fresh attempt
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Linking } from 'react-native';

const SUPPORT_EMAIL = 'destek@afetnet.app';

async function reloadApp(): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const updatesModule = require('expo-updates') as { reloadAsync?: () => Promise<void> };
        if (typeof updatesModule.reloadAsync === 'function') {
            await updatesModule.reloadAsync();
            return;
        }
    } catch {
        // expo-updates unavailable in some runtimes
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { DevSettings } = require('react-native');
        if (DevSettings && typeof DevSettings.reload === 'function') {
            DevSettings.reload();
            return;
        }
    } catch {
        // DevSettings unavailable in production
    }
}

export default function EULAFallbackScreen(): React.ReactElement {
    const [restarting, setRestarting] = useState(false);

    const handleRestart = (): void => {
        if (restarting) return;
        setRestarting(true);
        void reloadApp();
    };

    const handleSupport = (): void => {
        const url = `mailto:${SUPPORT_EMAIL}?subject=EULA%20Ekran%C4%B1%20A%C3%A7%C4%B1lm%C4%B1yor`;
        Linking.openURL(url).catch(() => {
            /* mail app yok — sessiz geç */
        });
    };

    return (
        <View style={styles.overlay} pointerEvents="auto">
            <View style={styles.card}>
                <Text style={styles.title}>Kullanım Sözleşmesi Açılamadı</Text>
                <Text style={styles.body}>
                    Uygulamayı kullanabilmek için Kullanım Sözleşmesi&apos;ni
                    onaylaman gerekiyor. Sözleşme ekranı şu an açılamıyor.
                </Text>
                <Text style={styles.body}>
                    Lütfen uygulamayı yeniden başlat. Sorun devam ederse
                    bizimle iletişime geç.
                </Text>

                <Pressable
                    style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.primaryButtonPressed,
                        restarting && styles.buttonDisabled,
                    ]}
                    onPress={handleRestart}
                    disabled={restarting}
                    accessibilityRole="button"
                    accessibilityLabel="Uygulamayı yeniden başlat"
                >
                    {restarting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.primaryButtonText}>Yeniden Başlat</Text>
                    )}
                </Pressable>

                <Pressable
                    style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.secondaryButtonPressed,
                    ]}
                    onPress={handleSupport}
                    accessibilityRole="button"
                    accessibilityLabel="Destek ekibine e-posta gönder"
                >
                    <Text style={styles.secondaryButtonText}>
                        Destek: {SUPPORT_EMAIL}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        zIndex: 9999,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 12,
        textAlign: 'center',
    },
    body: {
        fontSize: 15,
        lineHeight: 22,
        color: '#334155',
        marginBottom: 12,
        textAlign: 'center',
    },
    primaryButton: {
        marginTop: 12,
        backgroundColor: '#1F4E79',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonPressed: {
        backgroundColor: '#173B5C',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        marginTop: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    secondaryButtonPressed: {
        opacity: 0.7,
    },
    secondaryButtonText: {
        color: '#1F4E79',
        fontSize: 14,
        fontWeight: '500',
    },
});
