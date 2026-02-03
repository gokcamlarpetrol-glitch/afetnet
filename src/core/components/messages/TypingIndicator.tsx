/**
 * TYPING INDICATOR - ELITE EDITION
 * Animated bouncing dots showing when someone is typing
 * 
 * Features:
 * - Three bouncing dots animation
 * - User avatar display (optional)
 * - Smooth fade in/out transitions
 * - Premium glassmorphism design
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';

interface TypingIndicatorProps {
    userName?: string;
    userAvatar?: string;
    visible: boolean;
    style?: object;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
    userName,
    visible,
    style,
}) => {
    // Fade animation
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Dot bounce animations
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Fade in
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();

            // Start bouncing animation
            const createBounce = (animValue: Animated.Value, delay: number) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.timing(animValue, {
                            toValue: -8,
                            duration: 300,
                            easing: Easing.out(Easing.cubic),
                            useNativeDriver: true,
                        }),
                        Animated.timing(animValue, {
                            toValue: 0,
                            duration: 300,
                            easing: Easing.in(Easing.cubic),
                            useNativeDriver: true,
                        }),
                        Animated.delay(400 - delay),
                    ])
                );
            };

            const animation1 = createBounce(dot1, 0);
            const animation2 = createBounce(dot2, 150);
            const animation3 = createBounce(dot3, 300);

            animation1.start();
            animation2.start();
            animation3.start();

            return () => {
                animation1.stop();
                animation2.stop();
                animation3.stop();
            };
        } else {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, fadeAnim, dot1, dot2, dot3]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
            <BlurView intensity={20} tint="light" style={styles.blurContainer}>
                <View style={styles.content}>
                    {userName && (
                        <Text style={styles.userName}>{userName} yazıyor</Text>
                    )}
                    <View style={styles.dotsContainer}>
                        <Animated.View
                            style={[
                                styles.dot,
                                { transform: [{ translateY: dot1 }] }
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                { transform: [{ translateY: dot2 }] }
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                { transform: [{ translateY: dot3 }] }
                            ]}
                        />
                    </View>
                </View>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignSelf: 'flex-start',
        marginLeft: 16,
        marginBottom: 8,
    },
    blurContainer: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    userName: {
        fontSize: 12,
        color: '#666',
        marginRight: 8,
        fontWeight: '500',
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#007AFF',
    },
});

export default TypingIndicator;
