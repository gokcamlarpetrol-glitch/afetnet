/**
 * MESSAGE BUBBLE ENHANCED - ELITE EDITION
 * Premium message bubble with animations, gestures, and status icons
 * 
 * Features:
 * - Animated entrance (FadeInUp)
 * - Swipe gesture for reply
 * - Long-press haptic feedback
 * - Rich status indicators (clock → check → double-check → blue-check)
 * - Reply preview
 * - Reaction bar
 * - Failed message retry button
 * - Voice message waveform player
 */

import React, { useRef, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Pressable,
    PanResponder,
    Vibration,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { MeshMessage, MeshMessageReaction, MessageReaction } from '../../services/mesh/MeshStore';

interface MessageBubbleEnhancedProps {
    message: MeshMessage;
    isMe: boolean;
    showTail?: boolean;
    showAvatar?: boolean;
    onReply?: (message: MeshMessage) => void;
    onRetry?: (messageId: string) => void;
    onReact?: (messageId: string, emoji: MessageReaction) => void;
    onLongPress?: (message: MeshMessage) => void;
}

// ELITE: Status icon mapping
const StatusIcon: React.FC<{ status: MeshMessage['status'] }> = ({ status }) => {
    switch (status) {
        case 'pending':
            return <Ionicons name="time-outline" size={14} color="#999" />;
        case 'sending':
            return <Ionicons name="hourglass-outline" size={14} color="#999" />;
        case 'sent':
            return <Ionicons name="checkmark" size={14} color="#999" />;
        case 'delivered':
            return <Ionicons name="checkmark-done" size={14} color="#999" />;
        case 'read':
            return <Ionicons name="checkmark-done" size={14} color="#007AFF" />;
        case 'failed':
            return <Ionicons name="alert-circle" size={14} color="#FF3B30" />;
        default:
            return null;
    }
};

// ELITE: Reaction bar
const ReactionBar: React.FC<{ reactions: MeshMessageReaction[] }> = ({ reactions }) => {
    if (!reactions || reactions.length === 0) return null;

    // Group reactions by emoji
    const grouped = reactions.reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <View style={reactionStyles.container}>
            {Object.entries(grouped).map(([emoji, count]) => (
                <View key={emoji} style={reactionStyles.badge}>
                    <Text style={reactionStyles.emoji}>{emoji}</Text>
                    {count > 1 && <Text style={reactionStyles.count}>{count}</Text>}
                </View>
            ))}
        </View>
    );
};

const reactionStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    emoji: {
        fontSize: 12,
    },
    count: {
        fontSize: 11,
        color: '#666',
        marginLeft: 2,
    },
});

export const MessageBubbleEnhanced: React.FC<MessageBubbleEnhancedProps> = ({
    message,
    isMe,
    showTail = true,
    onReply,
    onRetry,
    onReact,
    onLongPress,
}) => {
    const [showReactionPicker, setShowReactionPicker] = useState(false);

    // Animation values
    const enterAnim = useRef(new Animated.Value(0)).current;
    const swipeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Pan responder for swipe-to-reply
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30;
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow right swipe for reply (for received messages)
                const maxSwipe = isMe ? 0 : 60;
                const swipeValue = Math.min(Math.max(0, gestureState.dx), maxSwipe);
                swipeAnim.setValue(swipeValue);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (!isMe && gestureState.dx > 50) {
                    // Trigger reply
                    if (Platform.OS === 'ios') {
                        Vibration.vibrate(10);
                    }
                    onReply?.(message);
                }
                // Animate back
                Animated.spring(swipeAnim, {
                    toValue: 0,
                    friction: 8,
                    useNativeDriver: true,
                }).start();
            },
        })
    ).current;

    // Entry animation
    React.useEffect(() => {
        Animated.spring(enterAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();

        // ELITE: Cleanup animations on unmount to prevent memory leaks
        return () => {
            enterAnim.stopAnimation();
            swipeAnim.stopAnimation();
            scaleAnim.stopAnimation();
        };
    }, [enterAnim, swipeAnim, scaleAnim]);

    // Long press handler
    const handleLongPress = useCallback(() => {
        if (Platform.OS === 'ios') {
            Vibration.vibrate(10);
        }
        setShowReactionPicker(true);
        onLongPress?.(message);

        // Subtle scale animation
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
    }, [message, onLongPress, scaleAnim]);

    // Handle reaction selection
    const handleReaction = (emoji: MessageReaction) => {
        setShowReactionPicker(false);
        onReact?.(message.id, emoji);
    };

    const isFailed = message.status === 'failed';

    return (
        <Animated.View
            style={[
                styles.container,
                isMe ? styles.containerMe : styles.containerOther,
                {
                    opacity: enterAnim,
                    transform: [
                        { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                        { translateX: swipeAnim },
                        { scale: scaleAnim },
                    ],
                },
            ]}
            {...panResponder.panHandlers}
        >
            {/* Swipe indicator */}
            <Animated.View
                style={[
                    styles.swipeIndicator,
                    {
                        opacity: swipeAnim.interpolate({ inputRange: [0, 30], outputRange: [0, 1] }),
                    },
                ]}
            >
                <Ionicons name="arrow-undo" size={20} color="#007AFF" />
            </Animated.View>

            <Pressable
                onLongPress={handleLongPress}
                delayLongPress={300}
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    {/* Reply preview */}
                    {message.replyTo && message.replyPreview && (
                        <View style={styles.replyPreview}>
                            <View style={styles.replyBar} />
                            <Text style={styles.replyText} numberOfLines={1}>
                                {message.replyPreview}
                            </Text>
                        </View>
                    )}

                    {/* Message content */}
                    <Text style={[styles.content, isMe ? styles.contentMe : styles.contentOther]}>
                        {message.content}
                    </Text>

                    {/* Reactions */}
                    <ReactionBar reactions={message.reactions || []} />

                    {/* Footer: Time + Status */}
                    <View style={styles.footer}>
                        <Text style={styles.time}>
                            {new Date(message.timestamp).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Text>
                        {isMe && <StatusIcon status={message.status} />}
                    </View>

                    {/* Tail */}
                    {showTail && (
                        <View
                            style={[
                                styles.tail,
                                isMe ? styles.tailMe : styles.tailOther,
                            ]}
                        />
                    )}
                </View>

                {/* Retry button for failed messages */}
                {isFailed && onRetry && (
                    <Pressable
                        style={styles.retryButton}
                        onPress={() => onRetry(message.id)}
                    >
                        <Ionicons name="refresh-circle" size={28} color="#FF3B30" />
                    </Pressable>
                )}
            </Pressable>

            {/* Reaction picker */}
            {showReactionPicker && (
                <BlurView intensity={80} tint="light" style={styles.reactionPicker}>
                    {(['❤️', '👍', '😊', '🙏', '🆘'] as MessageReaction[]).map((emoji) => (
                        <Pressable
                            key={emoji}
                            style={styles.reactionOption}
                            onPress={() => handleReaction(emoji)}
                        >
                            <Text style={styles.reactionEmoji}>{emoji}</Text>
                        </Pressable>
                    ))}
                </BlurView>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 2,
        marginHorizontal: 12,
        maxWidth: '80%',
    },
    containerMe: {
        alignSelf: 'flex-end',
    },
    containerOther: {
        alignSelf: 'flex-start',
    },
    swipeIndicator: {
        position: 'absolute',
        left: -30,
        top: '50%',
        marginTop: -10,
    },
    bubble: {
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 6,
        borderRadius: 18,
        minWidth: 60,
    },
    bubbleMe: {
        backgroundColor: '#007AFF',
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: '#E9E9EB',
        borderBottomLeftRadius: 4,
    },
    replyPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        paddingBottom: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    },
    replyBar: {
        width: 3,
        height: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: 2,
        marginRight: 8,
    },
    replyText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        flex: 1,
    },
    content: {
        fontSize: 16,
        lineHeight: 20,
    },
    contentMe: {
        color: '#FFFFFF',
    },
    contentOther: {
        color: '#000000',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 4,
    },
    time: {
        fontSize: 11,
        color: 'rgba(0, 0, 0, 0.4)',
    },
    tail: {
        position: 'absolute',
        bottom: 0,
        width: 12,
        height: 12,
    },
    tailMe: {
        right: -6,
        borderBottomLeftRadius: 16,
        backgroundColor: '#007AFF',
    },
    tailOther: {
        left: -6,
        borderBottomRightRadius: 16,
        backgroundColor: '#E9E9EB',
    },
    retryButton: {
        position: 'absolute',
        right: -36,
        top: '50%',
        marginTop: -14,
    },
    reactionPicker: {
        position: 'absolute',
        top: -50,
        left: '50%',
        marginLeft: -90,
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 24,
        overflow: 'hidden',
    },
    reactionOption: {
        padding: 8,
    },
    reactionEmoji: {
        fontSize: 24,
    },
});

export default MessageBubbleEnhanced;
