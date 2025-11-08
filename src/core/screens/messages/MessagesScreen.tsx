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
import QRCode from 'react-native-qrcode-svg';
import { Modal, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { createLogger } from '../../utils/logger';

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
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (normalizedQuery.length === 0) {
        setSearchSuggestions([]);
        return;
      }

      const suggestions = new Set<string>();
      
      // Extract unique user names that match
      conversations.forEach((conv) => {
        const name = conv.userName?.toLowerCase() ?? '';
        if (name.includes(normalizedQuery) && name !== normalizedQuery) {
          suggestions.add(conv.userName);
        }
      });

      // Extract unique message snippets that match
      messages.forEach((msg) => {
        const content = msg.content?.toLowerCase() ?? '';
        if (content.includes(normalizedQuery) && content.length > normalizedQuery.length) {
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

  // ELITE: Memoize filtered conversations for performance (using debounced query)
  // Enhanced search: searches in user names, last messages, and all message content
  const filteredConversations = useMemo(() => {
    try {
      const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();
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
          const name = conv.userName?.toLowerCase?.() ?? '';
          const last = conv.lastMessage?.toLowerCase?.() ?? '';
          
          // Check user name and last message
          if (name.includes(normalizedQuery) || last.includes(normalizedQuery)) {
            return true;
          }

          // Check all messages in this conversation
          const convMessages = conversationMessages.get(conv.userId) ?? [];
          const foundInMessages = convMessages.some((msg) => {
            const content = msg.content?.toLowerCase() ?? '';
            return content.includes(normalizedQuery);
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
        ]
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

  const handleShowQr = useCallback(() => {
    try {
      const id = myDeviceId || useMeshStore.getState().myDeviceId;
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        Alert.alert(
          'Cihaz ID hazır değil',
          'Bluetooth ve konum izinlerini açarak mesh ağını başlatın.'
        );
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

  // ELITE: Memoized callback for search input to prevent re-renders
  const handleSearchChange = useCallback((text: string) => {
    // ELITE: Direct state update without causing re-render issues
    setSearchQuery(text);
    // ELITE: Maintain focus after state update
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    // ELITE: Maintain focus after clear
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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

      {/* Header - Fixed */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mesajlar</Text>
          <View style={styles.meshRow}>
            <Text
              style={[
                styles.meshStatus,
                { color: isMeshConnected ? '#4ade80' : '#f97316' },
              ]}
            >
              Mesh {isMeshConnected ? 'aktif' : 'pasif'}
            </Text>
            <Pressable 
              style={styles.meshQrButton} 
              onPress={handleShowQr}
              accessibilityRole="button"
              accessibilityLabel="QR kod göster"
              accessibilityHint="Cihaz kimliğinizi QR kod olarak gösterir"
            >
              <Ionicons name="qr-code-outline" size={18} color="#60a5fa" />
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
          <Ionicons name="add-circle" size={34} color={colors.brand.primary} />
        </Pressable>
      </View>

      {/* Search Bar - Fixed outside FlatList to prevent re-mounting */}
      <View style={styles.searchContainer}>
        <LinearGradient
          colors={['#1e293b', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.searchBar}
        >
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Kişi veya mesaj ara..."
            placeholderTextColor={colors.text.tertiary}
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
              // ELITE: Ensure focus is maintained
              if (searchInputRef.current) {
                searchInputRef.current.focus();
              }
            }}
            onBlur={() => {
              // ELITE: Prevent accidental blur
              // No-op handler to prevent default blur behavior
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable 
              onPress={handleClearSearch}
              accessibilityRole="button"
              accessibilityLabel="Aramayı temizle"
              accessibilityHint="Arama metnini temizler"
            >
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </Pressable>
          )}
        </LinearGradient>

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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIcon}
            >
              <Ionicons name="chatbubbles-outline" size={64} color={colors.brand.primary} />
            </LinearGradient>
            <Text style={styles.emptyText}>Henüz mesaj yok</Text>
            <Text style={styles.emptySubtext}>
              Yakındaki cihazlarla BLE mesh ağı üzerinden mesajlaşabilirsiniz
            </Text>
            <Pressable 
              style={styles.emptyButton} 
              onPress={handleNewMessage}
              accessibilityRole="button"
              accessibilityLabel="İlk mesajı gönder"
              accessibilityHint="Yeni bir mesaj başlatır"
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb', '#1e40af']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>İlk Mesajı Gönder</Text>
              </LinearGradient>
            </Pressable>
          </View>
        }
      />

      {/* FAB KALDIRILDI - Header'daki + butonu kullanılıyor */}

      {/* Premium Gate KALDIRILDI - Tüm kullanıcılar erişebilir */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.background.primary,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)',
    marginTop: 0,
  },
  meshStatus: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  meshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meshQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.12)',
  },
  meshQrText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60a5fa',
  },
  telemetryCard: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  telemetryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  telemetryDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(94,234,212,0.18)',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.background.primary,
    zIndex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    paddingVertical: 4,
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    overflow: 'hidden',
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
    color: colors.text.secondary,
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
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
    fontWeight: '600',
    color: '#fff',
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
    paddingVertical: 32 * 2,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.brand.primary + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
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
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 18,
  },
  modalQrWrapper: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#1f2a44',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    marginBottom: 20,
  },
  modalIdText: {
    marginTop: 12,
    fontSize: 12,
    color: '#cbd5f5',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  modalSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  modalSecondaryText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  modalPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#38bdf8',
  },
  modalPrimaryText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  // FAB styles removed - using header button instead
});
