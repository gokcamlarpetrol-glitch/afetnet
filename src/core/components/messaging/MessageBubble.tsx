import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Linking, Alert, Modal, Platform, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp, Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MeshMessage } from '../../services/mesh/MeshStore';
import { VoicePlayerInline } from './VoicePlayerInline';
import { sanitizeForDisplay } from '../../utils/messageSanitizer';
import { styles } from '../../screens/messages/ConversationScreen.styles';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MessageBubble');

// ELITE: Typed MessageBubble props
export interface MessageBubbleProps {
  message: MeshMessage;
  isMe: boolean;
  showTail: boolean;
  onLongPress?: () => void;
  replyToContent?: string;
}

const resolveBubbleMediaFields = (message: MeshMessage) => {
  const metadata = (message as MeshMessage & {
    metadata?: {
      mediaType?: MeshMessage['mediaType'];
      mediaUrl?: string;
      mediaDuration?: number;
      location?: MeshMessage['location'];
    };
  }).metadata;

  return {
    mediaType: message.mediaType || metadata?.mediaType,
    mediaUrl: message.mediaUrl || metadata?.mediaUrl,
    mediaDuration: message.mediaDuration ?? metadata?.mediaDuration,
    location: message.location || metadata?.location,
  };
};

export const LocationCard = ({ location, isMe }: { location: { lat: number; lng: number; address?: string }; isMe: boolean }) => {
  // Guard: skip interactive render if location coordinates are invalid
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return (
      <View style={styles.locationCard}>
        <View style={styles.locationIconCircle}>
          <Ionicons name="location-outline" size={20} color="#94a3b8" />
        </View>
        <View style={styles.locationInfo}>
          <Text style={[styles.locationTitle, { color: '#94a3b8' }]}>📍 Konum verisi geçersiz</Text>
        </View>
      </View>
    );
  }

  const handleOpen = () => {
    const url = Platform.select({
      ios: `maps://?ll=${location.lat},${location.lng}&q=${location.lat},${location.lng}`,
      android: `geo:${location.lat},${location.lng}?q=${location.lat},${location.lng}`,
      default: `https://maps.google.com/?q=${location.lat},${location.lng}`,
    });
    Linking.openURL(url as string).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${location.lat},${location.lng}`).catch((error) => {
        logger.warn('Failed to open location URL in ConversationScreen:', error);
      });
    });
  };

  return (
    <Pressable onPress={handleOpen} style={styles.locationCard}>
      <View style={styles.locationIconCircle}>
        <Ionicons name="location" size={20} color="#ef4444" />
      </View>
      <View style={styles.locationInfo}>
        <Text style={[styles.locationTitle, { color: isMe ? '#1e3a8a' : '#334155' }]}>
          📍 Paylaşılan Konum
        </Text>
        {location.address ? (
          <Text style={[styles.locationAddress, { color: isMe ? '#3b82f6' : '#64748b' }]} numberOfLines={2}>
            {location.address}
          </Text>
        ) : (
          <Text style={[styles.locationAddress, { color: isMe ? '#3b82f6' : '#64748b' }]}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </Text>
        )}
        <Text style={styles.locationLink}>Haritada Aç →</Text>
      </View>
    </Pressable>
  );
};

// Bubble Component
export const MessageBubble = React.memo(({ message, isMe, showTail, replyToContent }: MessageBubbleProps) => {
  const isDeleted = !!(message as MeshMessage & { isDeleted?: boolean }).isDeleted || message.content === 'Bu mesaj silindi';
  const isEdited = !!(message as MeshMessage & { isEdited?: boolean }).isEdited;
  const [lightboxVisible, setLightboxVisible] = React.useState(false);
  const [imageLoadError, setImageLoadError] = React.useState(false);
  const {
    mediaType: resolvedMediaType,
    mediaUrl: resolvedMediaUrl,
    mediaDuration: resolvedMediaDuration,
    location: resolvedLocation,
  } = resolveBubbleMediaFields(message);

  // FIX: Reset imageLoadError when mediaUrl changes (e.g., stale file:// → valid https://)
  // Without this, a transient load failure permanently shows the error placeholder even after
  // the media URL is updated to a valid cloud URL via retry re-upload.
  React.useEffect(() => {
    setImageLoadError(false);
  }, [resolvedMediaUrl]);

  // Sanitize content for display
  const displayContent = sanitizeForDisplay(message.content);

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
      case 'pending':
        return 'time-outline';
      case 'sent':
        return 'checkmark';
      case 'delivered':
        return 'checkmark-done';
      case 'read':
        return 'checkmark-done';
      case 'failed':
        return 'close-circle';
      default:
        return 'checkmark';
    }
  };

  const getStatusColor = () => {
    if (message.status === 'failed') return '#ef4444';
    if (message.status === 'read') return '#53bdeb'; // WhatsApp blue for read ticks
    return '#64748b';
  };

  // ELITE: Render media content based on message type
  const renderContent = () => {
    // Deleted ghost — no interactions, italic grey
    if (isDeleted) {
      return <Text style={{ fontSize: 14, fontStyle: 'italic', color: '#94a3b8' }}>Bu mesaj silindi</Text>;
    }

    // CRITICAL FIX: Resolve mediaType from top-level OR metadata fallback
    // Old messages may have mediaType only in metadata (nested)
    // Image message
    if (resolvedMediaType === 'image') {
      if (resolvedMediaUrl) {
        return (
          <View>
            <Pressable onPress={() => setLightboxVisible(true)}>
              <View>
                {imageLoadError ? (
                  <View style={[styles.mediaPlaceholder, { minHeight: 120 }]}>
                    <Ionicons name="image-outline" size={32} color="#94a3b8" />
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Fotoğraf yüklenemedi</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: resolvedMediaUrl }}
                    style={styles.mediaImage}
                    resizeMode="cover"
                    onError={() => setImageLoadError(true)}
                  />
                )}
                {/* Upload progress overlay when sending */}
                {message.status === 'sending' && (
                  <View style={styles.mediaUploadOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </View>
            </Pressable>
            {displayContent && displayContent !== '📷 Fotoğraf' && (
              <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther, { marginTop: 6 }]}>
                {displayContent}
              </Text>
            )}
            {/* Lightbox modal */}
            <Modal
              visible={lightboxVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setLightboxVisible(false)}
            >
              <View style={styles.lightboxContainer}>
                <Pressable style={styles.lightboxClose} onPress={() => setLightboxVisible(false)}>
                  <Ionicons name="close" size={30} color="#fff" />
                </Pressable>
                <Image
                  source={{ uri: resolvedMediaUrl }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              </View>
            </Modal>
          </View>
        );
      }
      // Fallback: no URL yet (upload in progress or mesh-only)
      return (
        <View style={styles.mediaPlaceholder}>
          {message.status === 'sending' ? (
            <ActivityIndicator size="small" color={isMe ? '#1e3a8a' : '#64748b'} />
          ) : (
            <Ionicons name="image-outline" size={32} color={isMe ? '#1e3a8a' : '#64748b'} />
          )}
          <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther]}>📷 Fotoğraf</Text>
        </View>
      );
    }

    // Voice message
    if (resolvedMediaType === 'voice') {
      if (resolvedMediaUrl) {
        // CRITICAL FIX: Pass message with resolved media fields — old messages may have
        // mediaUrl/mediaDuration only in metadata, not top-level.
        const resolvedMsg = {
          ...message,
          mediaUrl: resolvedMediaUrl,
          mediaDuration: resolvedMediaDuration ?? 0,
        };
        return <VoicePlayerInline message={resolvedMsg} isMe={isMe} />;
      }
      // Fallback: no URL
      return (
        <View style={styles.mediaPlaceholder}>
          <Ionicons name="mic-outline" size={24} color={isMe ? '#1e3a8a' : '#64748b'} />
          <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther]}>🎤 Sesli Mesaj</Text>
        </View>
      );
    }

    // Location message
    if ((resolvedMediaType === 'location' && resolvedLocation) || (!resolvedMediaType && resolvedLocation)) {
      return <LocationCard location={resolvedLocation} isMe={isMe} />;
    }

    // Default: text message
    return (
      <Text style={[styles.msgText, isMe ? styles.textMe : styles.textOther]}>
        {displayContent}
      </Text>
    );
  };

  const senderName = message.senderName || '';

  // Group reactions by emoji for chip display
  const reactionGroups = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const map = new Map<string, number>();
    for (const r of message.reactions) {
      map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
    }
    return Array.from(map.entries()).map(([emoji, count]) => ({ emoji, count }));
  }, [message.reactions]);

  return (
    <Animated.View
      entering={FadeInUp.springify()}
      layout={Layout.springify()}
      style={[
        styles.bubbleRow,
        isMe ? styles.rowMe : styles.rowOther,
        !showTail && { marginBottom: 2 },
      ]}
    >
      <View style={{ flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
        {/* Sender name above incoming bubbles */}
        {!isMe && senderName ? (
          <Text style={styles.senderNameLabel}>{senderName}</Text>
        ) : null}
        <View style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
          !showTail && (isMe ? styles.noTailMe : styles.noTailOther),
          message.status === 'failed' && styles.bubbleFailed,
          resolvedMediaType === 'image' && resolvedMediaUrl && styles.bubbleImage,
          isDeleted && bubbleStyles.bubbleDeleted,
        ]}>
          {/* Reply quote block */}
          {!isDeleted && replyToContent ? (
            <View style={[bubbleStyles.replyQuote, isMe ? bubbleStyles.replyQuoteMe : bubbleStyles.replyQuoteOther]}>
              <Text style={bubbleStyles.replyQuoteText} numberOfLines={2}>{replyToContent}</Text>
            </View>
          ) : null}

          {renderContent()}

          <View style={styles.metaRow}>
            <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeOther]}>
              {new Date(message.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
            </Text>
            {isEdited && !isDeleted ? (
              <Text style={bubbleStyles.editedLabel}>(düzenlendi)</Text>
            ) : null}
            {isMe && (
              <Ionicons
                name={getStatusIcon()}
                size={12}
                color={getStatusColor()}
              />
            )}
          </View>
        </View>

        {/* Reaction chips below bubble */}
        {reactionGroups.length > 0 ? (
          <View style={[bubbleStyles.reactionsRow, isMe ? bubbleStyles.reactionsRowMe : bubbleStyles.reactionsRowOther]}>
            {reactionGroups.map(({ emoji, count }) => (
              <View key={emoji} style={bubbleStyles.reactionChip}>
                <Text style={bubbleStyles.reactionChipText}>{emoji} {count}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}, (prev, next) => {
  const prevResolved = resolveBubbleMediaFields(prev.message);
  const nextResolved = resolveBubbleMediaFields(next.message);
  const prevLocation = prevResolved.location;
  const nextLocation = nextResolved.location;
  const sameLocation = prevLocation?.lat === nextLocation?.lat
    && prevLocation?.lng === nextLocation?.lng
    && prevLocation?.address === nextLocation?.address;

  return (
    prev.message.id === next.message.id
    && prev.message.status === next.message.status
    && prev.message.content === next.message.content
    && prevResolved.mediaUrl === nextResolved.mediaUrl
    && prevResolved.mediaType === nextResolved.mediaType
    && prevResolved.mediaDuration === nextResolved.mediaDuration
    && prev.message.mediaThumbnail === next.message.mediaThumbnail
    && sameLocation
    && prev.message.reactions === next.message.reactions
    && prev.isMe === next.isMe
    && prev.showTail === next.showTail
    && prev.replyToContent === next.replyToContent
  );
});

/** Inline styles for bubble sub-components */
export const bubbleStyles = StyleSheet.create({
  deletedText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  bubbleDeleted: {
    opacity: 0.7,
  },
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  replyQuoteMe: {
    borderLeftColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  replyQuoteOther: {
    borderLeftColor: '#64748b',
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
  },
  replyQuoteText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  editedLabel: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#94a3b8',
    marginRight: 2,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  reactionsRowMe: {
    justifyContent: 'flex-end',
  },
  reactionsRowOther: {
    justifyContent: 'flex-start',
  },
  reactionChip: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reactionChipText: {
    fontSize: 12,
  },
});
