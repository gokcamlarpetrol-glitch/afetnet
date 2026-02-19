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
  RefreshControl,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessageStore, Conversation } from '../../stores/messageStore';
import { colors } from '../../theme';
import { SwipeableConversationCard } from '../../components/messages/SwipeableConversationCard';
import * as haptics from '../../utils/haptics';
import MessageTemplates from './MessageTemplates';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { getDeviceId as getDeviceIdFromLib } from '../../utils/device';
import QRCode from 'react-native-qrcode-svg';
import { Modal, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { createLogger } from '../../utils/logger';
import { safeLowerCase, safeIncludes } from '../../utils/safeString';
import { groupChatService, type GroupConversation } from '../../services/GroupChatService';

const logger = createLogger('MessagesScreen');
// Stable separator component — avoids re-creating on every render
const ConversationSeparator = () => <View style={{ height: 12 }} />;

const isRoutableConversationId = (value?: string | null): value is string => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized.length) return false;
  if (normalized === 'broadcast') return false;
  if (normalized.startsWith('group:')) return false;
  if (normalized.startsWith('family-')) return false;
  return true;
};

// ELITE: Type-safe navigation props
interface MessagesScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

// ─── Skeleton card for loading state ─────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.avatar} />
      <View style={skeletonStyles.info}>
        <View style={skeletonStyles.name} />
        <View style={skeletonStyles.preview} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 24,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e2e8f0',
  },
  info: {
    flex: 1,
    gap: 8,
  },
  name: {
    height: 16,
    width: '55%',
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  preview: {
    height: 13,
    width: '80%',
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
});

export default function MessagesScreen({ navigation }: MessagesScreenProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Store selectors — only subscribe to what is needed ───────────────────
  const conversations = useMessageStore((state) => state.conversations);
  const typingUsers = useMessageStore((state) => state.typingUsers);
  const isInitializing = useMessageStore((state) => state.isInitializing);
  const getConversationMessages = useMessageStore((state) => state.getConversationMessages);

  // My identity for outgoing message detection
  const [myUserId, setMyUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      const { identityService } = require('../../services/IdentityService');
      const uid = identityService.getUid?.();
      if (uid) setMyUserId(uid);
    } catch {
      // best effort
    }
  }, []);

  // Group conversations from GroupChatService
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);

  useEffect(() => {
    const unsub = groupChatService.onGroupsChanged((groups) => {
      setGroupConversations(groups);
    });
    return () => unsub();
  }, []);

  // Merge DM conversations with group conversations into a unified list
  const routableConversations = useMemo(() => {
    const dmConversations = conversations.filter((conversation) => isRoutableConversationId(conversation.userId));

    const groupAsConversations: Conversation[] = groupConversations.map((group) => ({
      userId: `group:${group.id}`,
      userName: group.name,
      lastMessage: (group.lastMessage?.content || '').substring(0, 80),
      lastMessageTime: group.lastMessage?.timestamp || group.updatedAt || group.createdAt,
      unreadCount: group.unreadCount ?? 0,
    }));

    const merged = [...dmConversations, ...groupAsConversations];
    merged.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });

    return merged;
  }, [conversations, groupConversations]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Generate search suggestions — guarded by early return when no query
  useEffect(() => {
    const normalizedQuery = safeLowerCase(searchQuery).trim();
    if (normalizedQuery.length === 0) {
      setSearchSuggestions([]);
      return;
    }

    try {
      const suggestions = new Set<string>();

      routableConversations.forEach((conv) => {
        const name = safeLowerCase(conv.userName);
        if (safeIncludes(name, normalizedQuery) && name !== normalizedQuery) {
          suggestions.add(conv.userName);
        }
      });

      // Limit to 5 suggestions — no full message scan here (expensive)
      setSearchSuggestions(Array.from(suggestions).slice(0, 5));
    } catch (error) {
      logger.error('Error generating search suggestions:', error);
      setSearchSuggestions([]);
    }
  }, [searchQuery, routableConversations]);

  const myDeviceId = useMeshStore((state) => state.myDeviceId);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);

  // Initialize BLE Mesh and message store
  useEffect(() => {
    let mounted = true;

    const initMesh = async () => {
      try {
        await useMessageStore.getState().initialize();

        if (!bleMeshService.getIsRunning()) {
          try {
            await bleMeshService.start();
            if (__DEV__) {
              logger.info('BLE Mesh service started from MessagesScreen');
            }
          } catch (error) {
            logger.warn('BLE Mesh start failed (non-critical):', error);
          }
        }

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

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await useMessageStore.getState().initialize();
    } catch (error) {
      logger.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Memoize filtered conversations
  const filteredConversations = useMemo(() => {
    try {
      const normalizedQuery = safeLowerCase(debouncedSearchQuery).trim();
      if (normalizedQuery.length === 0) {
        return routableConversations;
      }

      return routableConversations.filter((conv) => {
        try {
          const name = safeLowerCase(conv.userName);
          const last = safeLowerCase(conv.lastMessage);

          if (safeIncludes(name, normalizedQuery) || safeIncludes(last, normalizedQuery)) {
            return true;
          }

          const convMessages = getConversationMessages(conv.userId);
          return convMessages.some((msg) => {
            const content = safeLowerCase(msg.content);
            return safeIncludes(content, normalizedQuery);
          });
        } catch (error) {
          logger.error('Error filtering conversation:', error);
          return false;
        }
      });
    } catch (error) {
      logger.error('Error filtering conversations:', error);
      return routableConversations;
    }
  }, [routableConversations, debouncedSearchQuery, getConversationMessages]);

  const handleDeleteConversation = useCallback((userId: string) => {
    try {
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
      const { identityService } = require('../../services/IdentityService');
      const identity = identityService.getIdentity();
      if (identity?.uid) {
        const qrPayload = identityService.getQRPayload?.();
        setQrValue(qrPayload || identity.uid);
        setQrModalVisible(true);
        return;
      }

      let id = myDeviceId || useMeshStore.getState().myDeviceId || bleMeshService.getMyDeviceId();

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
          'Bluetooth ve konum izinlerini açarak mesh ağını başlatın.',
        );
        try {
          await bleMeshService.start();
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

  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
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

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, []);

  // Refresh conversation list when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Reload from MMKV to pick up any messages delivered while in background
        useMessageStore.getState().initialize().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

  const renderConversation = useCallback(({ item, index }: { item: Conversation; index: number }) => {
    try {
      const isGroup = item.userId.startsWith('group:');
      const typingActive = Boolean(typingUsers[item.userId]);
      return (
        <SwipeableConversationCard
          item={item}
          index={index}
          isGroup={isGroup}
          myUserId={myUserId}
          typingActive={typingActive}
          onPress={() => {
            try {
              if (!item.userId || typeof item.userId !== 'string') {
                logger.warn('Invalid userId in conversation:', item);
                return;
              }
              if (isGroup) {
                const groupId = item.userId.replace(/^group:/, '');
                navigation?.navigate('FamilyGroupChat', { groupId });
              } else {
                navigation?.navigate('Conversation', {
                  userId: item.userId,
                  userName: item.userName,
                  ...(item.conversationId ? { conversationId: item.conversationId } : {}),
                });
              }
            } catch (error) {
              logger.error('Error navigating to conversation:', error);
            }
          }}
          onDelete={() => {
            if (isGroup) {
              const groupId = item.userId.replace(/^group:/, '');
              Alert.alert(
                'Gruptan Ayrıl',
                `"${item.userName}" grubundan ayrılmak istediğinizden emin misiniz?`,
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Ayrıl',
                    style: 'destructive',
                    onPress: () => {
                      groupChatService.leaveGroup(groupId).catch((error) => {
                        logger.error('Failed to leave group:', error);
                      });
                    },
                  },
                ],
              );
            } else {
              handleDeleteConversation(item.userId);
            }
          }}
        />
      );
    } catch (error) {
      logger.error('Error rendering conversation:', error);
      return null;
    }
  }, [navigation, handleDeleteConversation, typingUsers, myUserId]);

  // Fix: ListHeaderComponent returns JSX element directly (not a factory function)
  const ListHeaderComponent = useMemo(() => (
    <>
      {/* Quick Message Templates */}
      <MessageTemplates />

      {/* Conversations Header */}
      <View style={styles.conversationsHeader}>
        <Text style={styles.conversationsTitle}>Konuşmalar</Text>
        <Text style={styles.conversationsCount}>{filteredConversations.length}</Text>
      </View>
    </>
  ), [filteredConversations.length]);

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
              <Text style={styles.modalTitle}>Benim AfetNet ID'm</Text>
              {qrValue && (
                <View style={styles.modalQrWrapper}>
                  <QRCode value={qrValue} size={200} color="#0f172a" backgroundColor="#e2e8f0" />
                  <Text style={styles.modalIdText}>
                    {(() => {
                      try {
                        const parsed = JSON.parse(qrValue);
                        return parsed.code || parsed.uid || qrValue;
                      } catch { return qrValue; }
                    })()}
                  </Text>
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
                        let codeToCopy = qrValue;
                        try {
                          const parsed = JSON.parse(qrValue);
                          codeToCopy = parsed.code || parsed.uid || qrValue;
                        } catch { /* not JSON, copy as-is */ }
                        await Clipboard.setStringAsync(codeToCopy);
                        haptics.notificationSuccess();
                        logger.info('User code copied to clipboard');
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

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>Mesajlar</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {filteredConversations.length} konuşma
            </Text>
            <View style={styles.meshRow}>
              <Pressable
                style={styles.meshQrButton}
                onPress={handleShowQr}
                accessibilityRole="button"
                accessibilityLabel="QR kod göster"
                accessibilityHint="Cihaz kimliğinizi QR kod olarak gösterir"
              >
                <Ionicons name="qr-code-outline" size={16} color="#475569" />
                <Text style={styles.meshQrText}>ID Paylaş</Text>
              </Pressable>
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
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Ionicons name="search" size={20} color={searchFocused ? '#3b82f6' : '#64748b'} />
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
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

          {/* Search Suggestions */}
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

        {/* Loading skeleton */}
        {isInitializing && conversations.length === 0 ? (
          <View style={styles.skeletonContainer}>
            {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.userId}
            ListHeaderComponent={ListHeaderComponent}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={ConversationSeparator}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            removeClippedSubviews={false}
            nestedScrollEnabled={false}
            scrollEventThrottle={16}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={7}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#64748b"
                colors={['#3b82f6']}
              />
            }
            ListEmptyComponent={
              debouncedSearchQuery.trim().length > 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="search-outline" size={80} color="#cbd5e1" />
                  </View>
                  <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
                  <Text style={styles.emptySubtext}>
                    "{debouncedSearchQuery}" ile eşleşen konuşma bulunamadı. Farklı bir arama deneyin.
                  </Text>
                </View>
              ) : (
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
              )
            }
          />
        )}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    gap: 8,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  searchBarFocused: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(255, 255, 255, 1)',
    shadowOpacity: 0.12,
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
  skeletonContainer: {
    padding: 16,
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
});
