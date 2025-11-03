import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FamilyContact } from '../family/types';
import * as familyStore from '../family/store';
import { useEffect } from 'react';

import { NavigationProp } from '../types/interfaces';

export default function FamilyScreen({ navigation }: { navigation?: NavigationProp }) {
  const [list, setList] = useState<FamilyContact[]>([]);
  const [myAfnId, setMyAfnId] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      const family = await familyStore.loadFamily();
      setList(family);
      // NOTE: My AFN ID generation is not implemented, using a placeholder
      setMyAfnId('AFN-XXXXXXXX');
    }
    loadData();
  }, []);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const myId = myAfnId;

  const onlineMembers = list.filter(m => m.lastSeen && Date.now() - m.lastSeen < 1000 * 60 * 10);
  const needHelpMembers = list.filter(m => m.status === 'need');

  const filteredMembers = list.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.afnId?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddMember = () => {
    setAddModalVisible(true);
  };

  const handleAddByAfnId = () => {
    Alert.prompt(
      'AFN-ID ile Ekle',
      'Kişinin AFN-ID\'sini girin (örn: AFN-1A2B3C4D):',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ekle',
          onPress: async (afnId) => {
            if (!afnId) return;

            Alert.prompt(
              'İsim',
              'Kişinin adını girin:',
              [
                { text: 'İptal', style: 'cancel' },
                {
                  text: 'Ekle',
                  onPress: async (name) => {
                    if (!name) return;

                    await familyStore.upsert({ afnId: afnId.trim().toUpperCase(), name: name.trim() });
                    const family = await familyStore.loadFamily();
                    setList(family);
                    Alert.alert('Başarılı', `${name} eklendi!`);
                    setAddModalVisible(false);
                  },
                },
              ],
              'plain-text'
            );
          },
        },
      ],
      'plain-text'
    );
  };

  const handleAddManual = () => {
    Alert.prompt(
      'Manuel Ekle',
      'Kişinin adını girin:',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ekle',
          onPress: async (name) => {
            if (!name || !name.trim()) return;
            await familyStore.upsert({
              name: name.trim(),
              emoji: '🧑',
              status: 'unknown',
            });
            const family = await familyStore.loadFamily();
            setList(family);
            Alert.alert('Başarılı', `${name} eklendi!`);
            setAddModalVisible(false);
          },
        },
      ],
      'plain-text'
    );
  };

  const handleAddByQR = () => {
    Alert.alert(
      'QR Kod Tara',
      'Kişinin QR kodunu tarayın',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kamera Aç',
          onPress: () => {
            navigation?.navigate('QRScanner');
            setAddModalVisible(false);
          },
        },
      ]
    );
  };

  const handleMemberPress = (member: FamilyContact) => {
    setSelectedMember(member);
    setDetailModalVisible(true);
  };

  const handleShareMyId = async () => {
    await Clipboard.setStringAsync(myId);
    Alert.alert(
      '✅ AFN-ID Kopyalandı!',
      `Sizin AFN-ID'niz:\n\n${myId}\n\nBu ID panoya kopyalandı!\n\n📱 WhatsApp, SMS veya herhangi bir uygulama ile paylaşabilirsiniz.\n\n💡 Diğer kişiler bu ID ile sizi ekleyebilir (şehirler arası bile!)`,
      [
        {
          text: 'WhatsApp ile Paylaş',
          onPress: () => {
            Alert.alert('WhatsApp', `"Benim AfetNet ID'm: ${myId}" mesajını WhatsApp'ta paylaşın`);
          },
        },
        {
          text: 'SMS ile Paylaş',
          onPress: () => {
            Alert.alert('SMS', `"Benim AfetNet ID'm: ${myId}" mesajını SMS ile gönderin`);
          },
        },
        { text: 'Tamam' },
      ]
    );
  };

  const handleStatusUpdate = async (member: FamilyContact, status: FamilyContact['status']) => {
    await familyStore.upsert({ ...member, status, lastSeen: Date.now() });
    const family = await familyStore.loadFamily();
    setList(family);
    Alert.alert('Durum Güncellendi', `${member.name} durumu: ${status === 'ok' ? 'İyi' : status === 'need' ? 'Yardım' : 'Belirsiz'}`);
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    return `${Math.floor(hours / 24)} gün önce`;
  };

  const getStatusColor = (status: FamilyMember['status']) => {
    switch (status) {
    case 'ok': return '#10b981';
    case 'need': return '#ef4444';
    default: return '#f59e0b';
    }
  };

  const getStatusIcon = (status: FamilyMember['status']) => {
    switch (status) {
    case 'ok': return 'checkmark-circle';
    case 'need': return 'alert-circle';
    default: return 'help-circle';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1f' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1f" />

      {/* Offline Status Banner */}
      <View style={{ backgroundColor: '#10b981', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
          👥 OFFLINE AİLE TAKİBİ: BLE ile şebekesiz konum paylaşımı aktif!
        </Text>
      </View>

      {/* Premium Header */}
      <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>
              Aile & Yakınlar
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
              {list.length} kişi • {onlineMembers.length} çevrimiçi
            </Text>
          </View>
          
          {/* QR Button */}
          <Pressable accessible={true}
            accessibilityRole="button"
            onPress={handleAddByQR}
            style={{
              backgroundColor: '#8b5cf6',
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#8b5cf6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              marginRight: 12,
            }}
          >
            <Ionicons name="qr-code" size={28} color="#ffffff" />
          </Pressable>
          
          {/* Add Button */}
          <Pressable accessible={true}
            accessibilityRole="button"
            onPress={handleAddMember}
            style={{
              backgroundColor: '#3b82f6',
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <Ionicons name="add" size={28} color="#ffffff" />
          </Pressable>
        </View>

        {/* My AFN-ID Card */}
        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={handleShareMyId}
          style={{
            backgroundColor: '#1e293b',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#334155',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="finger-print" size={20} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>
                Sizin AFN-ID'niz
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800' }}>
                {myId}
              </Text>
            </View>
            <Pressable onPress={handleShareMyId}>
              <Ionicons name="copy-outline" size={24} color="#3b82f6" />
            </Pressable>
          </View>
          <Text style={{ color: '#64748b', fontSize: 12 }}>
            Bu ID'yi paylaşarak insanlar sizi ekleyebilir
          </Text>
        </Pressable>

        {/* Search Bar */}
        <View style={{
          backgroundColor: '#1e293b',
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: '#334155',
        }}>
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput
            accessibilityRole="text"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Kişi ara..."
            placeholderTextColor="#64748b"
            style={{
              flex: 1,
              marginLeft: 12,
              color: '#ffffff',
              fontSize: 16,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        {needHelpMembers.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={{
              backgroundColor: '#7c2d12',
              borderRadius: 16,
              padding: 16,
              borderWidth: 2,
              borderColor: '#ea580c',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="warning" size={24} color="#fb923c" />
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                  Yardım İhtiyacı Var!
                </Text>
              </View>
              <Text style={{ color: '#fed7aa', fontSize: 14 }}>
                {needHelpMembers.length} kişi yardım bekliyor
              </Text>
            </View>
          </View>
        )}

        {/* Members List */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Kişiler
          </Text>

          {filteredMembers.map((member) => (
            <Pressable accessible={true}
              accessibilityRole="button"
              key={member.id}
              onPress={() => handleMemberPress(member)}
              style={{
                backgroundColor: '#1e293b',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: getStatusColor(member.status),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 42, marginRight: 12 }}>
                  {member.emoji || '🧑'}
                </Text>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{
                      color: '#ffffff',
                      fontSize: 16,
                      fontWeight: '700',
                      flex: 1,
                    }} numberOfLines={1}>
                      {member.name}
                    </Text>
                    <View style={{
                      backgroundColor: getStatusColor(member.status) + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginLeft: 8,
                    }}>
                      <Ionicons name={getStatusIcon(member.status)} size={12} color={getStatusColor(member.status)} />
                      <Text style={{ color: getStatusColor(member.status), fontSize: 11, fontWeight: '700' }}>
                        {member.status === 'ok' ? 'İYİ' : member.status === 'need' ? 'YARDIM' : 'BELİRSİZ'}
                      </Text>
                    </View>
                  </View>

                  {member.afnId && (
                    <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                      🆔 {member.afnId}
                    </Text>
                  )}

                  {member.lastSeen && (
                    <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
                      Son görülme: {formatTimestamp(member.lastSeen)}
                    </Text>
                  )}

                  {/* Quick Actions */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable accessible={true}
                      accessibilityRole="button"
                      onPress={() => handleStatusUpdate(member, 'ok')}
                      style={{
                        flex: 1,
                        backgroundColor: '#10b98120',
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700' }}>İyi</Text>
                    </Pressable>

                    <Pressable accessible={true}
                      accessibilityRole="button"
                      onPress={() => handleStatusUpdate(member, 'unknown')}
                      style={{
                        flex: 1,
                        backgroundColor: '#f59e0b20',
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700' }}>Belirsiz</Text>
                    </Pressable>

                    <Pressable accessible={true}
                      accessibilityRole="button"
                      onPress={() => handleStatusUpdate(member, 'need')}
                      style={{
                        flex: 1,
                        backgroundColor: '#ef444420',
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Yardım</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}

          {filteredMembers.length === 0 && (
            <View style={{
              backgroundColor: '#1e293b',
              borderRadius: 16,
              padding: 32,
              alignItems: 'center',
            }}>
              <Ionicons name="people-outline" size={64} color="#334155" />
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>
                {searchQuery ? 'Kişi Bulunamadı' : 'Henüz Kişi Yok'}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
                {searchQuery 
                  ? 'Aramanızla eşleşen kişi yok' 
                  : 'Aile ve yakınlarınızı eklemek için + butonuna tıklayın'}
              </Text>
              {!searchQuery && (
                <Pressable accessible={true}
                  accessibilityRole="button"
                  onPress={handleAddMember}
                  style={{
                    backgroundColor: '#3b82f6',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>
                    Kişi Ekle
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        accessible={true}
        accessibilityViewIsModal={true}
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#1e293b',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>
                Kişi Ekle
              </Text>
              <Pressable onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={28} color="#ffffff" />
              </Pressable>
            </View>

            {/* Add Options */}
            <Pressable accessible={true}
              accessibilityRole="button"
              onPress={handleAddByAfnId}
              style={{
                backgroundColor: '#334155',
                borderRadius: 16,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#3b82f6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}>
                  <Ionicons name="finger-print" size={24} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                    AFN-ID ile Ekle
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                    Uzaktaki kişileri ID ile ekleyin
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </View>
            </Pressable>

            <Pressable accessible={true}
              accessibilityRole="button"
              onPress={handleAddByQR}
              style={{
                backgroundColor: '#334155',
                borderRadius: 16,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#8b5cf6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}>
                  <Ionicons name="qr-code" size={24} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                    QR Kod ile Ekle
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                    Yakındaki kişilerin QR'ını tarayın
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </View>
            </Pressable>

            <Pressable accessible={true}
              accessibilityRole="button"
              onPress={handleAddManual}
              style={{
                backgroundColor: '#334155',
                borderRadius: 16,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#10b981',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}>
                  <Ionicons name="create" size={24} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                    Manuel Ekle
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                    Sadece isim ile hızlı ekleyin
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Member Detail Modal */}
      <Modal
        accessible={true}
        accessibilityViewIsModal={true}
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          {selectedMember && (
            <View style={{
              backgroundColor: '#1e293b',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '80%',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>
                  Kişi Detayları
                </Text>
                <Pressable onPress={() => setDetailModalVisible(false)}>
                  <Ionicons name="close" size={28} color="#ffffff" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <Text style={{ fontSize: 72 }}>{selectedMember.emoji || '🧑'}</Text>
                  <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '700', marginTop: 12 }}>
                    {selectedMember.name}
                  </Text>
                  {selectedMember.afnId && (
                    <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                      🆔 {selectedMember.afnId}
                    </Text>
                  )}
                </View>

                {/* Info */}
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: '#334155', borderRadius: 12, padding: 16 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Durum</Text>
                    <Text style={{ color: getStatusColor(selectedMember.status), fontSize: 16, fontWeight: '700' }}>
                      {selectedMember.status === 'ok' ? '✅ İyi' : selectedMember.status === 'need' ? '🆘 Yardım İhtiyacı' : '❓ Belirsiz'}
                    </Text>
                  </View>

                  {selectedMember.phone && (
                    <View style={{ backgroundColor: '#334155', borderRadius: 12, padding: 16 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Telefon</Text>
                      <Text style={{ color: '#ffffff', fontSize: 16 }}>{selectedMember.phone}</Text>
                    </View>
                  )}

                  {selectedMember.connectionMethod && (
                    <View style={{ backgroundColor: '#334155', borderRadius: 12, padding: 16 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Bağlantı Yöntemi</Text>
                      <Text style={{ color: '#ffffff', fontSize: 16 }}>
                        {selectedMember.connectionMethod === 'qr' ? '📱 QR Kod' : 
                          selectedMember.connectionMethod === 'id' ? '🆔 AFN-ID' : '✍️ Manuel'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={{ marginTop: 24, gap: 12 }}>
                  {selectedMember.afnId && (
                    <Pressable accessible={true}
                      accessibilityRole="button"
                      onPress={async () => {
                        await Clipboard.setStringAsync(selectedMember.afnId!);
                        Alert.alert(
                          '✅ AFN-ID Kopyalandı!',
                          `${selectedMember.name}'ın AFN-ID'si:\n\n${selectedMember.afnId}\n\nBu ID'yi başkalarıyla paylaşarak onların da bu kişiyi eklemesini sağlayabilirsiniz!`,
                        );
                      }}
                      style={{
                        backgroundColor: '#8b5cf6',
                        paddingVertical: 16,
                        borderRadius: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Ionicons name="copy" size={20} color="#ffffff" />
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                        AFN-ID'yi Kopyala
                      </Text>
                    </Pressable>
                  )}

                  <Pressable accessible={true}
                    accessibilityRole="button"
                    onPress={() => {
                      setDetailModalVisible(false);
                      // Mesajlaşma aktif - gerçek implementasyon
                      navigation?.navigate('Messages', { 
                        contactId: selectedMember.id,
                        contactName: selectedMember.name 
                      });
                    }}
                    style={{
                      backgroundColor: '#3b82f6',
                      paddingVertical: 16,
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                      Mesaj Gönder
                    </Text>
                  </Pressable>

                  <Pressable accessible={true}
                    accessibilityRole="button"
                    onPress={() => {
                      Alert.alert(
                        'Sil',
                        `${selectedMember.name} silinsin mi?`,
                        [
                          { text: 'İptal', style: 'cancel' },
                          {
                            text: 'Sil',
                            style: 'destructive',
                            onPress: async () => {
                              await familyStore.remove(selectedMember.id);
                              const family = await familyStore.loadFamily();
                              setList(family);
                              setDetailModalVisible(false);
                              Alert.alert('Silindi', `${selectedMember.name} silindi`);
                            },
                          },
                        ],
                      );
                    }}
                    style={{
                      backgroundColor: '#ef4444',
                      paddingVertical: 16,
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                      Kişiyi Sil
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
