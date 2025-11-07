/**
 * MESSAGES SCREEN - Premium Design
 * Modern offline messaging interface
 */

import React, { useState } from 'react';
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
import { useMeshStore } from '../../stores/meshStore';
import QRCode from 'react-native-qrcode-svg';
import { Modal, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';


export default function MessagesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const conversations = useMessageStore((state) => state.conversations);
  const isMeshConnected = useMeshStore((state) => state.isConnected);
  const myDeviceId = useMeshStore((state) => state.myDeviceId);
  const networkHealth = useMeshStore((state) => state.networkHealth);
  const peers = useMeshStore((state) => state.peers);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredConversations = conversations.filter((conv) => {
    const name = conv.userName?.toLowerCase?.() ?? '';
    const last = conv.lastMessage?.toLowerCase?.() ?? '';
    if (normalizedQuery.length === 0) {
      return true;
    }
    return name.includes(normalizedQuery) || last.includes(normalizedQuery);
  });

  const peerCount = (peers ? Object.keys(peers).length : 0) + 1;
  const deliveryPercent = Math.round(Math.min(1, Math.max(0, networkHealth.deliveryRatio)) * 100);
  const avgHop = Number.isFinite(networkHealth.avgHopCount) && networkHealth.avgHopCount > 0
    ? networkHealth.avgHopCount.toFixed(1)
    : '1.0';

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

  const handleShowQr = () => {
    const id = myDeviceId || useMeshStore.getState().myDeviceId;
    if (!id) {
      Alert.alert(
        'Cihaz ID hazır değil',
        'Bluetooth ve konum izinlerini açarak mesh ağını başlatın.'
      );
      return;
    }
    setQrValue(id);
    setQrModalVisible(true);
  };

  const handleCloseQr = () => {
    setQrModalVisible(false);
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
              <TouchableOpacity style={styles.modalSecondary} onPress={handleCloseQr}>
                <Text style={styles.modalSecondaryText}>Kapat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={async () => {
                  if (qrValue) {
                    await Clipboard.setStringAsync(qrValue);
                    haptics.notificationSuccess();
                  }
                  handleCloseQr();
                }}
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
            <Pressable style={styles.meshQrButton} onPress={handleShowQr}>
              <Ionicons name="qr-code-outline" size={18} color="#60a5fa" />
              <Text style={styles.meshQrText}>QR</Text>
            </Pressable>
          </View>
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryColumn}>
              <Text style={styles.telemetryLabel}>Cihaz</Text>
              <Text style={styles.telemetryValue}>{peerCount}</Text>
            </View>
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryColumn}>
              <Text style={styles.telemetryLabel}>Teslim</Text>
              <Text style={styles.telemetryValue}>{deliveryPercent}%</Text>
            </View>
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryColumn}>
              <Text style={styles.telemetryLabel}>Hops</Text>
              <Text style={styles.telemetryValue}>{avgHop}</Text>
            </View>
          </View>
        </View>
        <Pressable 
          style={styles.headerButton}
          onPress={handleNewMessage}
        >
          <Ionicons name="add-circle" size={34} color={colors.brand.primary} />
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
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)',
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
