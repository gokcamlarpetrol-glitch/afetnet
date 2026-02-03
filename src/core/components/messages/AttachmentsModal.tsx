/**
 * ATTACHMENTS MODAL - ELITE EDITION
 * Modal for selecting attachment types in messaging.
 * 
 * Features:
 * - 📷 Camera (take photo)
 * - 🖼️ Gallery (pick image)
 * - 🎤 Voice Message (record audio)
 * - 📍 Location (share current location)
 * - 📄 Document (future)
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from '../SafeBlurView';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AttachmentOption {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color: string;
    bgColor: string;
}

const ATTACHMENT_OPTIONS: AttachmentOption[] = [
    {
        id: 'camera',
        icon: 'camera',
        label: 'Kamera',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
    },
    {
        id: 'gallery',
        icon: 'images',
        label: 'Galeri',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
    },
    {
        id: 'voice',
        icon: 'mic',
        label: 'Ses Mesajı',
        color: '#22c55e',
        bgColor: 'rgba(34, 197, 94, 0.15)',
    },
    {
        id: 'location',
        icon: 'location',
        label: 'Konum',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
    },
];

interface AttachmentsModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectCamera: () => void;
    onSelectGallery: () => void;
    onSelectVoice: () => void;
    onSelectLocation: () => void;
}

export function AttachmentsModal({
    visible,
    onClose,
    onSelectCamera,
    onSelectGallery,
    onSelectVoice,
    onSelectLocation,
}: AttachmentsModalProps) {
    const handleSelect = (optionId: string) => {
        haptics.impactLight();
        onClose();

        // Small delay for better UX
        setTimeout(() => {
            switch (optionId) {
                case 'camera':
                    onSelectCamera();
                    break;
                case 'gallery':
                    onSelectGallery();
                    break;
                case 'voice':
                    onSelectVoice();
                    break;
                case 'location':
                    onSelectLocation();
                    break;
            }
        }, 100);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose}>
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(200)}
                        style={StyleSheet.absoluteFill}
                    />
                </Pressable>

                <Animated.View
                    entering={SlideInDown.springify().damping(20)}
                    exiting={SlideOutDown.springify()}
                    style={styles.contentContainer}
                >
                    <BlurView intensity={80} tint="light" style={styles.content}>
                        <View style={styles.header}>
                            <View style={styles.handle} />
                            <Text style={styles.title}>Ekle</Text>
                        </View>

                        <View style={styles.optionsGrid}>
                            {ATTACHMENT_OPTIONS.map((option) => (
                                <Pressable
                                    key={option.id}
                                    style={styles.optionItem}
                                    onPress={() => handleSelect(option.id)}
                                >
                                    <View style={[styles.optionIcon, { backgroundColor: option.bgColor }]}>
                                        <Ionicons name={option.icon} size={28} color={option.color} />
                                    </View>
                                    <Text style={styles.optionLabel}>{option.label}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <Pressable style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>İptal</Text>
                        </Pressable>
                    </BlurView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    contentContainer: {
        width: SCREEN_WIDTH,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#cbd5e1',
        borderRadius: 2,
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#334155',
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 20,
        gap: 12,
    },
    optionItem: {
        width: (SCREEN_WIDTH - 64) / 4,
        alignItems: 'center',
    },
    optionIcon: {
        width: 60,
        height: 60,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    optionLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b',
        textAlign: 'center',
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 16,
        marginHorizontal: 20,
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        borderRadius: 12,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
});
