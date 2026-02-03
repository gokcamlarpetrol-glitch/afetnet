/**
 * MESSAGE OPTIONS MODAL - Elite Edition
 * Long-press menu for message actions
 * 
 * Features:
 * - Copy message
 * - Edit message (own messages only)
 * - Delete message (own messages only)
 * - Forward message
 * - Reply to message
 * - Add reaction
 * 
 * @author AfetNet Elite Messaging System
 */

import React, { useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Alert,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as haptics from '../../utils/haptics';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { Message } from '../../stores/messageStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MessageOptionsModalProps {
    visible: boolean;
    message: Message | null;
    isOwnMessage: boolean;
    onClose: () => void;
    onEdit: (messageId: string) => void;
    onDelete: (messageId: string) => void;
    onForward: (messageId: string) => void;
    onReply: (messageId: string) => void;
    onReaction?: (messageId: string, emoji: string) => void;
}

interface OptionItem {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color?: string;
    onPress: () => void;
    disabled?: boolean;
    destructive?: boolean;
}

// Common reactions
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageOptionsModal({
    visible,
    message,
    isOwnMessage,
    onClose,
    onEdit,
    onDelete,
    onForward,
    onReply,
    onReaction,
}: MessageOptionsModalProps) {

    // Copy message to clipboard
    const handleCopy = useCallback(async () => {
        if (!message?.content) return;

        await Clipboard.setStringAsync(message.content);
        haptics.notificationSuccess();
        Alert.alert('Kopyalandı', 'Mesaj panoya kopyalandı.');
        onClose();
    }, [message, onClose]);

    // Handle edit
    const handleEdit = useCallback(() => {
        if (!message) return;

        if (message.isDeleted) {
            Alert.alert('Hata', 'Silinen mesajlar düzenlenemez.');
            return;
        }

        haptics.impactMedium();
        onClose();
        onEdit(message.id);
    }, [message, onClose, onEdit]);

    // Handle delete
    const handleDelete = useCallback(() => {
        if (!message) return;

        Alert.alert(
            'Mesajı Sil',
            'Bu mesajı silmek istediğinizden emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: () => {
                        haptics.notificationWarning();
                        onClose();
                        onDelete(message.id);
                    },
                },
            ]
        );
    }, [message, onClose, onDelete]);

    // Handle forward
    const handleForward = useCallback(() => {
        if (!message) return;

        if (message.isDeleted) {
            Alert.alert('Hata', 'Silinen mesajlar iletilemez.');
            return;
        }

        haptics.impactLight();
        onClose();
        onForward(message.id);
    }, [message, onClose, onForward]);

    // Handle reply
    const handleReply = useCallback(() => {
        if (!message) return;

        haptics.impactLight();
        onClose();
        onReply(message.id);
    }, [message, onClose, onReply]);

    // Handle reaction
    const handleReaction = useCallback((emoji: string) => {
        if (!message || !onReaction) return;

        haptics.impactLight();
        onReaction(message.id, emoji);
        onClose();
    }, [message, onReaction, onClose]);

    // Build options list
    const options = useMemo<OptionItem[]>(() => {
        if (!message) return [];

        const items: OptionItem[] = [
            {
                id: 'copy',
                icon: 'copy-outline',
                label: 'Kopyala',
                onPress: handleCopy,
            },
            {
                id: 'reply',
                icon: 'arrow-undo-outline',
                label: 'Yanıtla',
                onPress: handleReply,
            },
            {
                id: 'forward',
                icon: 'arrow-redo-outline',
                label: 'İlet',
                onPress: handleForward,
                disabled: message.isDeleted,
            },
        ];

        // Only show edit/delete for own messages
        if (isOwnMessage) {
            items.push({
                id: 'edit',
                icon: 'create-outline',
                label: 'Düzenle',
                onPress: handleEdit,
                disabled: message.isDeleted,
            });
            items.push({
                id: 'delete',
                icon: 'trash-outline',
                label: 'Sil',
                color: typeof colors.danger === 'string' ? colors.danger : (colors.danger?.main || '#ef4444'),
                onPress: handleDelete,
                destructive: true,
            });
        }

        return items;
    }, [message, isOwnMessage, handleCopy, handleReply, handleForward, handleEdit, handleDelete]);

    if (!message) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <BlurView intensity={20} tint="dark" style={styles.blurOverlay}>
                    <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                        {/* Message Preview */}
                        <View style={styles.previewContainer}>
                            <Text style={styles.previewText} numberOfLines={3}>
                                {message.isDeleted ? 'Bu mesaj silindi' : message.content}
                            </Text>
                            {message.isEdited && !message.isDeleted && (
                                <Text style={styles.editedLabel}>düzenlendi</Text>
                            )}
                        </View>

                        {/* Quick Reactions */}
                        {onReaction && !message.isDeleted && (
                            <View style={styles.reactionsContainer}>
                                {REACTIONS.map((emoji) => (
                                    <Pressable
                                        key={emoji}
                                        style={styles.reactionButton}
                                        onPress={() => handleReaction(emoji)}
                                    >
                                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}

                        {/* Options List */}
                        <View style={styles.optionsContainer}>
                            {options.map((option, index) => (
                                <Pressable
                                    key={option.id}
                                    style={({ pressed }) => [
                                        styles.optionButton,
                                        index === 0 && styles.optionButtonFirst,
                                        index === options.length - 1 && styles.optionButtonLast,
                                        option.disabled && styles.optionButtonDisabled,
                                        pressed && styles.optionButtonPressed,
                                    ]}
                                    onPress={option.onPress}
                                    disabled={option.disabled}
                                >
                                    <Ionicons
                                        name={option.icon}
                                        size={20}
                                        color={option.disabled
                                            ? colors.text.tertiary
                                            : option.color || colors.text.primary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.optionLabel,
                                            option.disabled && styles.optionLabelDisabled,
                                            option.destructive && styles.optionLabelDestructive,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Cancel Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.cancelButton,
                                pressed && styles.cancelButtonPressed,
                            ]}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelLabel}>İptal</Text>
                        </Pressable>
                    </Pressable>
                </BlurView>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    blurOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl + 20,
        paddingHorizontal: spacing.md,
    },
    previewContainer: {
        backgroundColor: 'rgba(51, 65, 85, 0.6)',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    previewText: {
        fontSize: typography.body.fontSize,
        color: colors.text.primary,
        lineHeight: 22,
    },
    editedLabel: {
        fontSize: typography.caption.fontSize,
        color: colors.text.tertiary,
        marginTop: spacing.xs,
        fontStyle: 'italic',
    },
    reactionsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingVertical: spacing.sm,
    },
    reactionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(51, 65, 85, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reactionEmoji: {
        fontSize: 24,
    },
    optionsContainer: {
        backgroundColor: 'rgba(51, 65, 85, 0.6)',
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(100, 116, 139, 0.3)',
        gap: spacing.md,
    },
    optionButtonFirst: {
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
    },
    optionButtonLast: {
        borderBottomLeftRadius: borderRadius.lg,
        borderBottomRightRadius: borderRadius.lg,
        borderBottomWidth: 0,
    },
    optionButtonDisabled: {
        opacity: 0.4,
    },
    optionButtonPressed: {
        backgroundColor: 'rgba(71, 85, 105, 0.6)',
    },
    optionLabel: {
        fontSize: typography.body.fontSize,
        color: colors.text.primary,
        flex: 1,
    },
    optionLabelDisabled: {
        color: colors.text.tertiary,
    },
    optionLabelDestructive: {
        color: typeof colors.danger === 'string' ? colors.danger : (colors.danger?.main || '#ef4444'),
    },
    cancelButton: {
        backgroundColor: 'rgba(51, 65, 85, 0.6)',
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    cancelButtonPressed: {
        backgroundColor: 'rgba(71, 85, 105, 0.6)',
    },
    cancelLabel: {
        fontSize: typography.body.fontSize,
        color: colors.brand?.primary || '#0ea5e9',
        fontWeight: '600',
    },
});
