import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ContactImporter } from '../../core/family/contacts';
import { ShareCodeGenerator } from '../../core/family/code';
import { FamilyMemberRepository } from '../../core/data/repositories';
import { FamilyMember } from '../../core/data/models';
import { SMSEncoder } from '../../core/logic/sms';

export const FamilyScreen: React.FC = () => {
  const { t } = useI18n();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const contactImporter = ContactImporter.getInstance();
  const shareCodeGenerator = ShareCodeGenerator.getInstance();
  const familyRepository = FamilyMemberRepository.getInstance();

  useEffect(() => {
    loadFamilyMembers();
  }, []);

  const loadFamilyMembers = async () => {
    try {
      const members = await familyRepository.getAll();
      setFamilyMembers(members);
    } catch (error) {
      console.error('Failed to load family members:', error);
    }
  };

  const handleImportContacts = async () => {
    setLoading(true);
    try {
      const contacts = await contactImporter.importFromDevice();
      
      if (contacts.length === 0) {
        Alert.alert('Bilgi', 'İçe aktarılacak kişi bulunamadı.');
        return;
      }

      // Show contact selection dialog
      Alert.alert(
        'Kişiler',
        `${contacts.length} kişi bulundu. Hepsini aileye eklemek ister misiniz?`,
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Ekle', 
            onPress: async () => {
              let addedCount = 0;
              for (const contact of contacts.slice(0, 10)) { // Limit to 10
                const result = await contactImporter.addToFamily(contact);
                if (result) addedCount++;
              }
              
              Alert.alert('Başarılı', `${addedCount} kişi aileye eklendi.`);
              await loadFamilyMembers();
            }
          },
        ]
      );
    } catch (error) {
      console.error('Failed to import contacts:', error);
      Alert.alert('Hata', 'Kişiler içe aktarılırken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSafePing = async (member: FamilyMember) => {
    try {
      if (!member.phoneNumber) {
        Alert.alert('Hata', 'Bu kişinin telefon numarası yok.');
        return;
      }

      const safeMessage = SMSEncoder.createStatusSMS({
        t: 1,
        id: `safe_${Date.now()}`,
        ts: Date.now(),
        loc: { lat: 41.0082, lon: 28.9784, acc: 10 },
        prio: 0,
        flags: { underRubble: false, injured: false, anonymity: false },
        ppl: 1,
        note: 'Güvendeyim',
        batt: 80,
        ttl: 3,
        sig: '',
      });

      await SMSEncoder.openSmsComposer(member.phoneNumber, safeMessage);
    } catch (error) {
      console.error('Failed to send safe ping:', error);
      Alert.alert('Hata', 'Güvenlik mesajı gönderilirken bir hata oluştu.');
    }
  };

  const handleShowShareCode = async (member: FamilyMember) => {
    try {
      const shareCodeInfo = await shareCodeGenerator.getShareCodeInfo(member.shareCode);
      
      if (!shareCodeInfo.isValid) {
        Alert.alert('Geçersiz Kod', 'Paylaşım kodu geçersiz veya süresi dolmuş.');
        return;
      }

      const hoursLeft = Math.floor((shareCodeInfo.timeUntilExpiry || 0) / (1000 * 60 * 60));
      
      Alert.alert(
        'Paylaşım Kodu',
        `Kod: ${member.shareCode}\n\nSüre: ${hoursLeft} saat kaldı\n\nBu kodu aile üyenizle paylaşın.`,
        [
          { text: 'Kopyala', onPress: () => {
            // Would copy to clipboard
            console.log('Share code copied:', member.shareCode);
          }},
          { text: 'Tamam' },
        ]
      );
    } catch (error) {
      console.error('Failed to show share code:', error);
      Alert.alert('Hata', 'Paylaşım kodu gösterilirken bir hata oluştu.');
    }
  };

  const filteredMembers = familyMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.phoneNumber?.includes(searchQuery) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('family.title')}</Text>
        <Text style={styles.subtitle}>{t('family.contacts')}</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Aile üyesi ara..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Kişilerden Ekle"
          onPress={handleImportContacts}
          style={styles.actionButton}
          loading={loading}
        />
        <Button
          title="Manuel Ekle"
          onPress={() => setShowAddContact(true)}
          style={styles.actionButton}
          variant="secondary"
        />
      </View>

      {/* Family Members List */}
      <View style={styles.membersList}>
        {filteredMembers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Arama kriterlerine uygun kişi bulunamadı.' : 'Henüz aile üyesi eklenmemiş.'}
            </Text>
          </Card>
        ) : (
          filteredMembers.map((member) => (
            <Card key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <Text style={styles.memberName}>{member.name}</Text>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: member.isOnline ? '#34C759' : '#FF3B30' }
                ]} />
              </View>
              
              {member.phoneNumber && (
                <Text style={styles.memberInfo}>📞 {member.phoneNumber}</Text>
              )}
              {member.email && (
                <Text style={styles.memberInfo}>📧 {member.email}</Text>
              )}
              
              <Text style={styles.lastSeen}>
                Son görülme: {new Date(member.lastSeen).toLocaleString('tr-TR')}
              </Text>
              
              <Text style={styles.trustLevel}>
                Güven seviyesi: {'⭐'.repeat(member.trustLevel)}
              </Text>

              <View style={styles.memberActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleSendSafePing(member)}
                >
                  <Text style={styles.actionButtonText}>Güvenlik Mesajı</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={() => handleShowShareCode(member)}
                >
                  <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                    Paylaşım Kodu
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  membersList: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  memberCard: {
    marginBottom: 16,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  memberInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lastSeen: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  trustLevel: {
    fontSize: 12,
    color: '#FFD700',
    marginBottom: 12,
  },
  memberActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
});