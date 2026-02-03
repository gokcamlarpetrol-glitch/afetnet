/**
 * VOICE RECORDER UI - ELITE EDITION
 * Inline voice recording interface for messaging.
 * 
 * Features:
 * - Animated recording indicator with pulsing effect
 * - Duration display
 * - Cancel by swiping left
 * - Send on release
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    PanResponder,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANCEL_THRESHOLD = -80; // Swipe left to cancel

interface VoiceRecorderUIProps {
    isRecording: boolean;
    duration: number; // in seconds
    onCancel: () => void;
    onSend: () => void;
}

export function VoiceRecorderUI({
    isRecording,
    duration,
    onCancel,
    onSend,
}: VoiceRecorderUIProps) {
    const translateX = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const [showCancelHint, setShowCancelHint] = useState(false);

    // Pulsing animation for recording indicator
    useEffect(() => {
        if (isRecording) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                false
            );
        } else {
            pulseScale.value = 1;
        }
    }, [isRecording, pulseScale]);

    // Pan responder for swipe-to-cancel
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const { dx } = gestureState;
                if (dx < 0) {
                    translateX.value = Math.max(dx, -100);
                    setShowCancelHint(dx < CANCEL_THRESHOLD);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const { dx } = gestureState;
                if (dx < CANCEL_THRESHOLD) {
                    haptics.notificationWarning();
                    onCancel();
                } else {
                    haptics.impactMedium();
                    onSend();
                }
                translateX.value = withTiming(0);
                setShowCancelHint(false);
            },
        })
    ).current;

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const slideStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    // Format duration as MM:SS
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isRecording) return null;

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.container}
        >
            {/* Cancel hint */}
            <Animated.View style={[styles.cancelHint, showCancelHint && styles.cancelHintActive]}>
                <Ionicons name="trash" size={20} color={showCancelHint ? '#ef4444' : '#94a3b8'} />
                <Text style={[styles.cancelText, showCancelHint && styles.cancelTextActive]}>
                    İptal
                </Text>
            </Animated.View>

            {/* Slider content */}
            <Animated.View style={[styles.sliderContent, slideStyle]} {...panResponder.panHandlers}>
                {/* Recording indicator with pulse */}
                <View style={styles.recordingIndicator}>
                    <Animated.View style={[styles.pulseBg, pulseStyle]} />
                    <View style={styles.micCircle}>
                        <Ionicons name="mic" size={24} color="#fff" />
                    </View>
                </View>

                {/* Duration */}
                <Text style={styles.durationText}>{formatDuration(duration)}</Text>

                {/* Swipe hint */}
                <View style={styles.swipeHint}>
                    <Ionicons name="chevron-back" size={16} color="#94a3b8" />
                    <Text style={styles.swipeText}>Kaydır: İptal</Text>
                </View>
            </Animated.View>

            {/* Send button */}
            <Pressable style={styles.sendBtn} onPress={onSend}>
                <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
        gap: 12,
    },
    cancelHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    cancelHintActive: {},
    cancelText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94a3b8',
    },
    cancelTextActive: {
        color: '#ef4444',
    },
    sliderContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    recordingIndicator: {
        position: 'relative',
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseBg: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    micCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    durationText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#334155',
        fontVariant: ['tabular-nums'],
    },
    swipeHint: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
    },
    swipeText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
