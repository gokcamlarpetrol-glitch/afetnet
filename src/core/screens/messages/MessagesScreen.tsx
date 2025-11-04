/**
 * MESSAGES SCREEN - Premium Design
 * Modern offline messaging interface
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMessageStore, Conversation } from '../../stores/messageStore';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { SwipeableConversationCard } from '../../components/messages/SwipeableConversationCard';
import * as haptics from '../../utils/haptics';
import MessageTemplates from './MessageTemplates';


export default function MessagesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setConversations(useMessageStore.getState().conversations);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const filteredConversations = conversations.filter(conv =>
    conv.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteConversation = (userId: string) => {
    Alert.alert(
      'Konuşmayı Sil',
      'Bu konuşmayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          onPress: () => {
            useMessageStore.getState().deleteConversation(userId);
          },
          style: 'destructive',
        },
      ]
    );
  };
  
  const handleNewMessage = () => {
    haptics.impactMedium();
    navigation?.navigate('NewMessage');
  };

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => (
    <SwipeableConversationCard
      item={item}
      index={index}
      onPress={() => navigation?.navigate('Conversation', { userId: item.userId })}
      onDelete={() => handleDeleteConversation(item.userId)}
    />
  );

  // Combine header elements for FlatList
  const ListHeaderComponent = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <LinearGradient
          colors={['#1e293b', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.searchBar}
        >
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Mesajlarda ara..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </Pressable>
          )}
        </LinearGradient>
      </View>

      {/* Quick Message Templates */}
      <MessageTemplates />

      {/* Conversations Header */}
      <View style={styles.conversationsHeader}>
        <Text style={styles.conversationsTitle}>Konuşmalar</Text>
        <Text style={styles.conversationsCount}>{filteredConversations.length}</Text>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header - Fixed */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mesajlar</Text>
          <Text style={styles.headerSubtitle}>
            {conversations.length} konuşma • Offline
          </Text>
        </View>
        <Pressable 
          style={styles.headerButton}
          onPress={handleNewMessage}
        >
          <Ionicons name="add-circle" size={28} color={colors.brand.primary} />
        </Pressable>
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
            <Pressable style={styles.emptyButton} onPress={handleNewMessage}>
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
    </View>
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
    alignItems: 'center',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  // FAB styles removed - using header button instead
});
