import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Clipboard } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import { usePeople } from '../store/people';
import { getPublicKey } from '../identity/keypair';
import { pubKeyToAfnId, formatAfnIdForDisplay } from '../identity/afnId';
import { pickContacts, formatPhoneForDisplay } from '../contacts/phonebook';
import { composeInvite, formatInviteForSharing } from '../invite/smsInvite';
import { idHandshakeManager } from '../pairing/idHandshake';
import { validateAfnId } from '../identity/afnId';

export default function People() {
  const [activeTab, setActiveTab] = useState<'identity' | 'add' | 'contacts'>('identity');
  const [manualAfnId, setManualAfnId] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [myAfnId, setMyAfnId] = useState('');
  const [qrData, setQrData] = useState('');

  const { 
    items: people, 
    meAfnId, 
    addOrUpdate, 
    remove, 
    findByAfnId,
    getPairedCount,
    getTotalCount 
  } = usePeople();

  useEffect(() => {
    initializeMyIdentity();
  }, []);

  const initializeMyIdentity = async () => {
    try {
      const pubKey = await getPublicKey();
      const afnId = pubKeyToAfnId(pubKey);
      setMyAfnId(afnId);
      
      // Create QR data for pairing
      const qrPayload = {
        type: 'AFN_PAIR',
        afnId,
        pubKey,
        timestamp: Date.now()
      };
      setQrData(JSON.stringify(qrPayload));
    } catch (error) {
      console.error('Failed to initialize identity:', error);
    }
  };

  const handleCopyAfnId = async () => {
    try {
      await Clipboard.setString(myAfnId);
      Alert.alert('Kopyalandı', 'AFN-ID panoya kopyalandı');
    } catch (error) {
      Alert.alert('Hata', 'Kopyalama başarısız');
    }
  };

  const handleShareAfnId = async () => {
    try {
      const shareText = formatInviteForSharing(myAfnId);
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        // For now, we'll copy to clipboard since we don't have a file to share
        await Clipboard.setString(shareText);
        Alert.alert('Paylaşım Hazır', 'Bilgiler panoya kopyalandı');
      } else {
        await Clipboard.setString(shareText);
        Alert.alert('Kopyalandı', 'Paylaşım bilgileri panoya kopyalandı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Paylaşım başarısız');
    }
  };

  const handleAddFromPhonebook = async () => {
    try {
      const contacts = await pickContacts();
      
      if (contacts.length === 0) {
        Alert.alert('Bilgi', 'Rehberden kişi seçilmedi');
        return;
      }

      // Show contact selection
      const contactItems = contacts.map((contact, index) => ({
        text: `${contact.name} - ${formatPhoneForDisplay(contact.phoneE164)}`,
        onPress: () => addContactFromPhonebook(contact)
      }));

      Alert.alert('Kişi Seç', 'Eklenecek kişiyi seçin:', [
        ...contactItems,
        { text: 'İptal', style: 'cancel' }
      ]);
    } catch (error) {
      console.error('Failed to pick contacts:', error);
      Alert.alert('Hata', 'Rehber erişimi başarısız');
    }
  };

  const addContactFromPhonebook = async (contact: { name: string; phoneE164: string }) => {
    try {
      const personId = addOrUpdate({
        displayName: contact.name,
        phoneE164: contact.phoneE164,
        paired: false
      });

      Alert.alert(
        'Kişi Eklendi',
        `${contact.name} kişilerinize eklendi.`,
        [
          { text: 'Tamam' },
          {
            text: 'Davet Gönder',
            onPress: () => sendInviteToPerson(personId, contact.phoneE164)
          }
        ]
      );
    } catch (error) {
      console.error('Failed to add contact:', error);
      Alert.alert('Hata', 'Kişi eklenemedi');
    }
  };

  const sendInviteToPerson = async (personId: string, phoneE164: string) => {
    try {
      await composeInvite(phoneE164, myAfnId);
      Alert.alert('Davet Gönderildi', 'SMS davet gönderildi');
    } catch (error) {
      console.error('Failed to send invite:', error);
      Alert.alert('Hata', 'Davet gönderilemedi');
    }
  };

  const handleAddByAfnId = () => {
    if (!manualAfnId.trim()) {
      Alert.alert('Hata', 'AFN-ID giriniz');
      return;
    }

    const validation = validateAfnId(manualAfnId.trim());
    if (!validation.ok) {
      Alert.alert('Hata', 'Geçersiz AFN-ID formatı');
      return;
    }

    const existing = findByAfnId(manualAfnId.trim());
    if (existing) {
      Alert.alert('Bilgi', 'Bu AFN-ID zaten kişilerinizde mevcut');
      return;
    }

    const personId = addOrUpdate({
      displayName: `AFN-${manualAfnId.slice(-4)}`,
      afnId: manualAfnId.trim(),
      paired: false
    });

    Alert.alert(
      'Kişi Eklendi',
      'AFN-ID ile kişi eklendi. Eşleşmeyi başlatmak için kişi detayına gidin.',
      [
        { text: 'Tamam' },
        {
          text: 'Eşleşmeyi Başlat',
          onPress: () => initiatePairing(personId, manualAfnId.trim())
        }
      ]
    );

    setManualAfnId('');
  };

  const initiatePairing = async (personId: string, targetAfnId: string) => {
    try {
      const requestId = await idHandshakeManager.initiatePairing(targetAfnId);
      Alert.alert(
        'Eşleşme Başlatıldı',
        `Eşleşme isteği gönderildi. AFN-ID: ${targetAfnId}`,
        [
          { text: 'Tamam' }
        ]
      );
    } catch (error) {
      console.error('Failed to initiate pairing:', error);
      Alert.alert('Hata', 'Eşleşme başlatılamadı');
    }
  };

  const handleRemovePerson = (personId: string, personName: string) => {
    Alert.alert(
      'Kişiyi Sil',
      `${personName} kişisini silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => remove(personId)
        }
      ]
    );
  };

  const renderIdentityTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.identityCard}>
        <Text style={styles.identityTitle}>Benim Kimliğim</Text>
        
        <View style={styles.afnIdContainer}>
          <Text style={styles.afnIdLabel}>AFN-ID:</Text>
          <Text style={styles.afnIdValue}>{myAfnId || 'Yükleniyor...'}</Text>
        </View>

        <View style={styles.qrContainer}>
          <Text style={styles.qrLabel}>QR Kod:</Text>
          {qrData ? (
            <QRCode
              value={qrData}
              size={200}
              color="#000000"
              backgroundColor="#ffffff"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>QR Kod Yükleniyor...</Text>
            </View>
          )}
        </View>

        <View style={styles.identityActions}>
          <Pressable
            onPress={handleCopyAfnId}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>AFN-ID Kopyala</Text>
          </Pressable>

          <Pressable
            onPress={handleShareAfnId}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Paylaş</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderAddTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Kişi Ekle</Text>

        <Pressable
          onPress={handleAddFromPhonebook}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Rehberden Ekle</Text>
        </Pressable>

        <View style={styles.manualAddContainer}>
          <Text style={styles.manualAddLabel}>AFN-ID ile Ekle:</Text>
          <TextInput
            style={styles.afnIdInput}
            placeholder="AFN-XXXX-XXXX-XXXX"
            value={manualAfnId}
            onChangeText={setManualAfnId}
            autoCapitalize="characters"
            placeholderTextColor="#94a3b8"
          />
          <Pressable
            onPress={handleAddByAfnId}
            style={[styles.addButton, styles.addButtonSecondary]}
          >
            <Text style={styles.addButtonText}>Ekle</Text>
          </Pressable>
        </View>

        <View style={styles.addInfo}>
          <Text style={styles.addInfoText}>
            • Rehberden ekleme: SMS davet gönderilir{'\n'}
            • AFN-ID ile ekleme: Manuel eşleşme başlatılır{'\n'}
            • QR kod ile ekleme: Mevcut QR tarayıcıyı kullanın
          </Text>
        </View>
      </View>
    </View>
  );

  const renderContactsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.contactsHeader}>
        <Text style={styles.contactsTitle}>
          Kişilerim ({getTotalCount()})
        </Text>
        <Text style={styles.contactsSubtitle}>
          Eşleşmiş: {getPairedCount()}
        </Text>
      </View>

      {people.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Henüz kişi eklenmemiş</Text>
          <Text style={styles.emptySubtext}>
            "Kişi Ekle" sekmesinden başlayın
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.contactsList}>
          {people.map((person) => (
            <View key={person.id} style={styles.contactItem}>
              <View style={styles.contactHeader}>
                <Text style={styles.contactName}>{person.displayName}</Text>
                <View style={styles.contactBadge}>
                  <Text style={styles.contactBadgeText}>
                    {person.paired ? '🔒 Şifreli' : 'Davet Bekliyor'}
                  </Text>
                </View>
              </View>

              {person.afnId && (
                <Text style={styles.contactAfnId}>
                  AFN-ID: {formatAfnIdForDisplay(person.afnId)}
                </Text>
              )}

              {person.phoneE164 && (
                <Text style={styles.contactPhone}>
                  {formatPhoneForDisplay(person.phoneE164)}
                </Text>
              )}

              <View style={styles.contactActions}>
                {!person.paired && person.afnId && (
                  <Pressable
                    onPress={() => initiatePairing(person.id, person.afnId!)}
                    style={[styles.contactActionButton, styles.primaryButton]}
                  >
                    <Text style={styles.contactActionButtonText}>
                      Eşleşmeyi Başlat
                    </Text>
                  </Pressable>
                )}

                {person.phoneE164 && (
                  <Pressable
                    onPress={() => sendInviteToPerson(person.id, person.phoneE164!)}
                    style={styles.contactActionButton}
                  >
                    <Text style={styles.contactActionButtonText}>
                      SMS Davet
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleRemovePerson(person.id, person.displayName)}
                  style={[styles.contactActionButton, styles.dangerButton]}
                >
                  <Text style={[styles.contactActionButtonText, styles.dangerButtonText]}>
                    Sil
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kişiler</Text>

      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab('identity')}
          style={[styles.tab, activeTab === 'identity' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'identity' && styles.activeTabText]}>
            Benim Kimliğim
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('add')}
          style={[styles.tab, activeTab === 'add' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>
            Kişi Ekle
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('contacts')}
          style={[styles.tab, activeTab === 'contacts' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
            Kişilerim
          </Text>
        </Pressable>
      </View>

      {activeTab === 'identity' && renderIdentityTab()}
      {activeTab === 'add' && renderAddTab()}
      {activeTab === 'contacts' && renderContactsTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    marginBottom: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
  },
  tabContent: {
    flex: 1,
  },
  identityCard: {
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  identityTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  afnIdContainer: {
    width: '100%',
    marginBottom: 20,
  },
  afnIdLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  afnIdValue: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'monospace',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrPlaceholderText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  identityActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  addCard: {
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 12,
  },
  addTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonSecondary: {
    backgroundColor: '#3b82f6',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  manualAddContainer: {
    marginBottom: 20,
  },
  manualAddLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  afnIdInput: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  addInfo: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
  },
  addInfoText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  contactsHeader: {
    marginBottom: 16,
  },
  contactsTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  contactsSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  contactBadge: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contactBadgeText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  contactAfnId: {
    color: '#3b82f6',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  contactPhone: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactActionButton: {
    backgroundColor: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  contactActionButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  dangerButtonText: {
    color: '#ffffff',
  },
});
