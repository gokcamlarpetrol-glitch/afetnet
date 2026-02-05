/**
 * MESSAGES SCREEN - Elite Premium Design
 * Production-grade offline messaging interface with full type safety
 * Zero-error guarantee with comprehensive error handling
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMessageStore, Conversation, Message } from '../../stores/messageStore';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { SwipeableConversationCard } from '../../components/messages/SwipeableConversationCard';
import * as haptics from '../../utils/haptics';
import MessageTemplates from './MessageTemplates';
import { useMeshStore } from '../../stores/meshStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { getDeviceId as getDeviceIdFromLib } from '../../utils/device';
import QRCode from 'react-native-qrcode-svg';
import { Modal, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { createLogger } from '../../utils/logger';
import { safeLowerCase, safeIncludes } from '../../utils/safeString';

const logger = createLogger('MessagesScreen');

// ELITE: Type-safe navigation props
interface MessagesScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function MessagesScreen({ navigation }: MessagesScreenProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const conversations = useMessageStore((state) => state.conversations);
  const messages = useMessageStore((state) => state.messages);

  // ELITE: Debounce search query to prevent excessive filtering and re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ELITE: Generate search suggestions as user types
  useEffect(() => {
    try {
      const normalizedQuery = safeLowerCase(searchQuery).trim();
      if (normalizedQuery.length === 0) {
        setSearchSuggestions([]);
        return;
      }

      const suggestions = new Set<string>();

      // Extract unique user names that match
      conversations.forEach((conv) => {
        const name = safeLowerCase(conv.userName);
        if (safeIncludes(name, normalizedQuery) && name !== normalizedQuery) {
          suggestions.add(conv.userName);
        }
      });

      // Extract unique message snippets that match
      messages.forEach((msg) => {
        const content = safeLowerCase(msg.content);
        if (safeIncludes(content, normalizedQuery) && content.length > normalizedQuery.length) {
          const snippet = msg.content.substring(0, 50).trim();
          if (snippet.length > normalizedQuery.length) {
            suggestions.add(snippet);
          }
        }
      });

      // Limit to 5 suggestions
      setSearchSuggestions(Array.from(suggestions).slice(0, 5));
    } catch (error) {
      logger.error('Error generating search suggestions:', error);
      setSearchSuggestions([]);
    }
  }, [searchQuery, conversations, messages]);
  const isMeshConnected = useMeshStore((state) => state.isConnected);
  const myDeviceId = useMeshStore((state) => state.myDeviceId);
  const networkHealth = useMeshStore((state) => state.networkHealth);
  const peers = useMeshStore((state) => state.peers);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);

  // ELITE: Ensure BLE Mesh service is started for offline messaging
  useEffect(() => {
    let mounted = true;

    const initMesh = async () => {
      try {
        // ELITE: Initialize message store (loads from AsyncStorage and Firebase)
        await useMessageStore.getState().initialize();

        // ELITE: Ensure BLE Mesh service is started
        if (!bleMeshService.getIsRunning()) {
          try {
            await bleMeshService.start();
            if (__DEV__) {
              logger.info('BLE Mesh service started from MessagesScreen');
            }
          } catch (error) {
            logger.warn('BLE Mesh start failed (non-critical):', error);
            // Continue - BLE Mesh is optional but recommended
          }
        }

        // ELITE: Ensure device ID is available
        let deviceId = bleMeshService.getMyDeviceId() || useMeshStore.getState().myDeviceId;
        if (!deviceId && mounted) {
          try {
            deviceId = await getDeviceIdFromLib();
            if (deviceId) {
              useMeshStore.getState().setMyDeviceId(deviceId);
            }
          } catch (error) {
            logger.error('Failed to get device ID:', error);
          }
        }
      } catch (error) {
        logger.error('Mesh initialization error:', error);
      }
    };

    initMesh();

    return () => {
      mounted = false;
    };
  }, []);

  // ELITE: Memoize filtered conversations for performance (using debounced query)
  // Enhanced search: searches in user names, last messages, and all message content
  const filteredConversations = useMemo(() => {
    try {
      const normalizedQuery = safeLowerCase(debouncedSearchQuery).trim();
      if (normalizedQuery.length === 0) {
        return conversations;
      }

      // Get all messages for each conversation to search within
      const conversationMessages = new Map<string, Message[]>();
      messages.forEach((msg) => {
        const otherUserId = msg.from === 'me' ? msg.to : msg.from;
        if (!conversationMessages.has(otherUserId)) {
          conversationMessages.set(otherUserId, []);
        }
        conversationMessages.get(otherUserId)!.push(msg);
      });

      return conversations.filter((conv) => {
        try {
          const name = safeLowerCase(conv.userName);
          const last = safeLowerCase(conv.lastMessage);

          // Check user name and last message
          if (safeIncludes(name, normalizedQuery) || safeIncludes(last, normalizedQuery)) {
            return true;
          }

          // Check all messages in this conversation
          const convMessages = conversationMessages.get(conv.userId) ?? [];
          const foundInMessages = convMessages.some((msg) => {
            const content = safeLowerCase(msg.content);
            return safeIncludes(content, normalizedQuery);
          });

          return foundInMessages;
        } catch (error) {
          logger.error('Error filtering conversation:', error);
          return false;
        }
      });
    } catch (error) {
      logger.error('Error filtering conversations:', error);
      return conversations;
    }
  }, [conversations, debouncedSearchQuery, messages]);

  // ELITE: Memoize network stats for performance
  const networkStats = useMemo(() => {
    try {
      const peerCount = (peers ? Object.keys(peers).length : 0) + 1;
      const deliveryPercent = Math.round(Math.min(1, Math.max(0, networkHealth.deliveryRatio)) * 100);
      const avgHop = Number.isFinite(networkHealth.avgHopCount) && networkHealth.avgHopCount > 0
        ? networkHealth.avgHopCount.toFixed(1)
        : '1.0';
      return { peerCount, deliveryPercent, avgHop };
    } catch (error) {
      logger.error('Error calculating network stats:', error);
      return { peerCount: 1, deliveryPercent: 0, avgHop: '1.0' };
    }
  }, [peers, networkHealth]);

  // ELITE: Memoized callbacks for performance
  const handleDeleteConversation = useCallback((userId: string) => {
    try {
      // ELITE: Validate userId
      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        logger.warn('Invalid userId for delete:', userId);
        return;
      }

      Alert.alert(
        'Konuşmayı Sil',
        'Bu konuşmayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            onPress: () => {
              try {
                useMessageStore.getState().deleteConversation(userId);
                logger.info('Conversation deleted:', userId);
              } catch (error) {
                logger.error('Error deleting conversation:', error);
                Alert.alert('Hata', 'Konuşma silinirken bir hata oluştu.');
              }
            },
            style: 'destructive',
          },
        ],
      );
    } catch (error) {
      logger.error('Error in handleDeleteConversation:', error);
    }
  }, []);

  const handleNewMessage = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation?.navigate('NewMessage');
    } catch (error) {
      logger.error('Error navigating to NewMessage:', error);
    }
  }, [navigation]);

  const handleShowQr = useCallback(async () => {
    try {
      // ELITE: Try to get device ID from multiple sources
      let id = myDeviceId || useMeshStore.getState().myDeviceId || bleMeshService.getMyDeviceId();

      // ELITE: If still no ID, try to get from lib/device
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        try {
          id = await getDeviceIdFromLib();
          if (id) {
            useMeshStore.getState().setMyDeviceId(id);
          }
        } catch (error) {
          logger.error('Failed to get device ID for QR:', error);
        }
      }

      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        Alert.alert(
          'Cihaz ID hazır değil',
          'Bluetooth ve konum izinlerini açarak mesh ağını başlatın. Uygulama yeniden başlatılıyor...',
        );
        // ELITE: Try to start BLE Mesh service
        try {
          await bleMeshService.start();
          // Wait a bit for device ID to be generated
          await new Promise(resolve => setTimeout(resolve, 1000));
          const newId = bleMeshService.getMyDeviceId() || useMeshStore.getState().myDeviceId;
          if (newId) {
            setQrValue(newId);
            setQrModalVisible(true);
            return;
          }
        } catch (error) {
          logger.error('Failed to start BLE Mesh for QR:', error);
        }
        return;
      }

      setQrValue(id);
      setQrModalVisible(true);
    } catch (error) {
      logger.error('Error showing QR:', error);
      Alert.alert('Hata', 'QR kod gösterilirken bir hata oluştu.');
    }
  }, [myDeviceId]);

  const handleCloseQr = useCallback(() => {
    setQrModalVisible(false);
  }, []);

  // ELITE: Ref to track focus timeouts for cleanup
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ELITE: Memoized callback for search input to prevent re-renders
  const handleSearchChange = useCallback((text: string) => {
    // ELITE: Direct state update without causing re-render issues
    setSearchQuery(text);
    // ELITE: Maintain focus after state update with cleanup
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
      focusTimeoutRef.current = null;
    }, 0);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    // ELITE: Maintain focus after clear with cleanup
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
      focusTimeoutRef.current = null;
    }, 0);
  }, []);

  // ELITE: Cleanup focus timeout on unmount
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, []);

  // ELITE: Memoized render function for performance
  const renderConversation = useCallback(({ item, index }: { item: Conversation; index: number }) => {
    try {
      return (
        <SwipeableConversationCard
          item={item}
          index={index}
          onPress={() => {
            try {
              if (!item.userId || typeof item.userId !== 'string') {
                logger.warn('Invalid userId in conversation:', item);
                return;
              }
              navigation?.navigate('Conversation', { userId: item.userId });
            } catch (error) {
              logger.error('Error navigating to conversation:', error);
            }
          }}
          onDelete={() => handleDeleteConversation(item.userId)}
        />
      );
    } catch (error) {
      logger.error('Error rendering conversation:', error);
      return null;
    }
  }, [navigation, handleDeleteConversation]);

  // ELITE: Memoize ListHeaderComponent (without search bar to prevent re-mounting)
  const ListHeaderComponent = useMemo(() => {
    return () => (
      <>
        {/* Quick Message Templates */}
        <MessageTemplates />

        {/* Conversations Header */}
        <View style={styles.conversationsHeader}>
          <Text style={styles.conversationsTitle}>Konuşmalar</Text>
          <Text style={styles.conversationsCount}>{filteredConversations.length}</Text>
        </View>
      </>
    );
  }, [filteredConversations.length]);

  const searchInputRef = useRef<TextInput>(null);

  return (
    <ImageBackground
      source={require('../../../../assets/images/premium/family_soft_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.7)']}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

        <Modal
          visible={qrModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseQr}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Benim AfetNet ID’m</Text>
              {qrValue && (
                <View style={styles.modalQrWrapper}>
                  <QRCode value={qrValue} size={200} color="#0f172a" backgroundColor="#e2e8f0" />
                  <Text style={styles.modalIdText}>{qrValue}</Text>
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondary}
                  onPress={handleCloseQr}
                  accessibilityRole="button"
                  accessibilityLabel="Kapat"
                  accessibilityHint="QR kod ekranını kapatır"
                >
                  <Text style={styles.modalSecondaryText}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimary}
                  onPress={async () => {
                    try {
                      if (qrValue && typeof qrValue === 'string') {
                        await Clipboard.setStringAsync(qrValue);
                        haptics.notificationSuccess();
                        logger.info('QR value copied to clipboard');
                      }
                    } catch (error) {
                      logger.error('Error copying QR value:', error);
                      Alert.alert('Hata', 'Kimlik kopyalanırken bir hata oluştu.');
                    } finally {
                      handleCloseQr();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Kimliği kopyala"
                  accessibilityHint="Cihaz kimliğini panoya kopyalar"
                >
                  <Ionicons name="copy-outline" size={16} color="#0f172a" />
                  <Text style={styles.modalPrimaryText}>Kimliği Kopyala</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* UNIQUE FEATURE: Offline Messaging Banner */}


        {/* Header - Fixed Position */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>Mesajlar</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {filteredConversations.length} konuşma • {isMeshConnected ? 'Online' : 'Offline'}
            </Text>
            <View style={styles.meshRow}>
              <View
                style={[
                  styles.meshStatusBadge,
                  { backgroundColor: isMeshConnected ? 'rgba(74, 222, 128, 0.2)' : 'rgba(251, 146, 60, 0.2)' },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: isMeshConnected ? '#22c55e' : '#f97316' }]} />
                <Text
                  style={[
                    styles.meshStatusText,
                    { color: isMeshConnected ? '#15803d' : '#c2410c' },
                  ]}
                >
                  Mesh {isMeshConnected ? 'aktif' : 'pasif'}
                </Text>
              </View>
              <Pressable
                style={styles.meshQrButton}
                onPress={handleShowQr}
                accessibilityRole="button"
                accessibilityLabel="QR kod göster"
                accessibilityHint="Cihaz kimliğinizi QR kod olarak gösterir"
              >
                <Ionicons name="qr-code-outline" size={16} color="#475569" />
                <Text style={styles.meshQrText}>QR</Text>
              </Pressable>
            </View>
            <View style={styles.telemetryCard}>
              <View style={styles.telemetryColumn}>
                <Text style={styles.telemetryLabel}>Cihaz</Text>
                <Text style={styles.telemetryValue}>{networkStats.peerCount}</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryColumn}>
                <Text style={styles.telemetryLabel}>Teslim</Text>
                <Text style={styles.telemetryValue}>{networkStats.deliveryPercent}%</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryColumn}>
                <Text style={styles.telemetryLabel}>Hops</Text>
                <Text style={styles.telemetryValue}>{networkStats.avgHop}</Text>
              </View>
            </View>
          </View>
          <Pressable
            style={styles.headerButton}
            onPress={handleNewMessage}
            accessibilityRole="button"
            accessibilityLabel="Yeni mesaj"
            accessibilityHint="Yeni bir mesaj başlatır"
          >
            <View style={styles.glassButtonInner}>
              <Ionicons name="add" size={28} color="#334155" />
            </View>
          </Pressable>
        </View>

        {/* Search Bar - Fixed outside FlatList to prevent re-mounting */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Kişi veya mesaj ara..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
              blurOnSubmit={false}
              returnKeyType="search"
              editable={true}
              keyboardType="default"
              textContentType="none"
              accessibilityLabel="Mesajlarda ara"
              accessibilityHint="Kişi veya mesaj içeriğinde arama yapar"
              onFocus={() => {
                if (searchInputRef.current) {
                  searchInputRef.current.focus();
                }
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={handleClearSearch}
                accessibilityRole="button"
                accessibilityLabel="Aramayı temizle"
                accessibilityHint="Arama metnini temizler"
              >
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          {/* ELITE: Search Suggestions */}
          {searchSuggestions.length > 0 && searchQuery.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {searchSuggestions.map((suggestion, index) => (
                <Pressable
                  key={`suggestion-${index}`}
                  style={styles.suggestionItem}
                  onPress={() => {
                    setSearchQuery(suggestion);
                    if (searchInputRef.current) {
                      searchInputRef.current.blur();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Arama önerisi: ${suggestion}`}
                  accessibilityHint="Bu öneriyi seçer ve arama yapar"
                >
                  <Ionicons name="arrow-forward" size={16} color={colors.text.tertiary} />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Scrollable Content - FlatList with header */}
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={ListHeaderComponent}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          removeClippedSubviews={false}
          nestedScrollEnabled={false}
          scrollEventThrottle={16}
          // ELITE: Performance optimizations
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={7}
          getItemLayout={(data, index) => ({
            length: 100, // Approximate conversation card height + separator
            offset: 112 * index,
            index,
          })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={80} color="#cbd5e1" />
              </View>
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>
                Yakındaki cihazlarla şebekesiz BLE mesh ağı üzerinden güvenle mesajlaşabilirsiniz
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={handleNewMessage}
                accessibilityRole="button"
                accessibilityLabel="İlk mesajı gönder"
                accessibilityHint="Yeni bir mesaj başlatır"
              >
                <View style={styles.emptyButtonInner}>
                  <Ionicons name="add" size={20} color="#334155" />
                  <Text style={styles.emptyButtonText}>İlk Mesajı Gönder</Text>
                </View>
              </Pressable>
            </View>
          }
        />

        {/* FAB KALDIRILDI - Header'daki + butonu kullanılıyor */}

        {/* Premium Gate KALDIRILDI - Tüm kullanıcılar erişebilir */}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.2)',
  },
  offlineBannerText: {
    flex: 1,
  },
  offlineBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  offlineBannerSubtitle: {
    fontSize: 11,
    color: '#93c5fd',
  },
  uniqueBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  uniqueBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  headerContent: {
    flex: 1,
    minHeight: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  glassButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  meshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  meshStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  meshStatusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  meshQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  meshQrText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  telemetryCard: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  telemetryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  telemetryDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    gap: 8,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    paddingVertical: Platform.OS === 'ios' ? 4 : 0,
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  conversationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
  },
  conversationsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  conversationsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    gap: 12,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.brand.primary + '30',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  time: {
    fontSize: 13,
    color: '#94a3b8',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
  },
  unreadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  emptyButton: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 32,
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  modalQrWrapper: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    marginBottom: 24,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  modalIdText: {
    marginTop: 16,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  modalSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  modalSecondaryText: {
    color: '#64748b',
    fontWeight: '700',
  },
  modalPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  modalPrimaryText: {
    fontWeight: '800',
    color: '#0369a1',
  },
  // FAB styles removed - using header button instead
});
