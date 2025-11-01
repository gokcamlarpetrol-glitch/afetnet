/**
 * FAMILY SCREEN - Family Member Tracking (PREMIUM)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { usePremiumStore } from '../../stores/premiumStore';
import PremiumGate from '../../components/PremiumGate';

export default function FamilyScreen() {
  const [isPremium, setIsPremium] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsPremium(usePremiumStore.getState().isPremium);
      setMembers(useFamilyStore.getState().members);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleAddMember = () => {
    Alert.prompt(
      'Aile Üyesi Ekle',
      'İsim girin:',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ekle',
          onPress: (name) => {
            if (name && name.trim()) {
              useFamilyStore.getState().addMember({
                name: name.trim(),
                status: 'unknown',
                lastSeen: Date.now(),
              });
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusColor = (status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return '#10b981';
      case 'need-help': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return 'Güvende';
      case 'need-help': return 'Yardım Gerekiyor';
      default: return 'Bilinmiyor';
    }
  };

  const renderMember = ({ item }: { item: FamilyMember }) => {
    const timeSince = Math.floor((Date.now() - item.lastSeen) / 1000 / 60);
    const timeText = timeSince < 1 ? 'Şimdi' : `${timeSince} dk önce`;

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberHeader}>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberTime}>{timeText}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        {item.location && (
          <Text style={styles.locationText}>
            📍 {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Aile</Text>
          <Text style={styles.headerSubtitle}>
            {members.length} üye
          </Text>
        </View>
        <Pressable style={styles.addButton} onPress={handleAddMember}>
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Member List */}
      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people" size={64} color="#475569" />
            <Text style={styles.emptyText}>Henüz aile üyesi eklenmemiş</Text>
            <Pressable style={styles.emptyButton} onPress={handleAddMember}>
              <Text style={styles.emptyButtonText}>İlk Üyeyi Ekle</Text>
            </Pressable>
          </View>
        }
      />

      {/* Premium Gate */}
      {!isPremium && <PremiumGate featureName="Aile Takibi" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  memberCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberTime: {
    color: '#64748b',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  locationText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

