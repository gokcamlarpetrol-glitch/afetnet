import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert } from 'react-native';
import { useIce, IceContact, SmsTemplate } from '../store/ice';
import { connectivityWatcher } from '../fallback/connectivity';
import { usePDRFuse } from '../hooks/usePDRFuse';

export default function ICE() {
  const {
    contacts,
    templates,
    queue,
    addContact,
    removeContact,
    updateContact,
    reorder,
    addTemplate,
    updateTemplate,
    removeTemplate,
    clearQueue,
    getNextQueued
  } = useIce();

  const [activeTab, setActiveTab] = useState<'contacts' | 'templates' | 'queue'>('contacts');
  const [editingContact, setEditingContact] = useState<Partial<IceContact> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<SmsTemplate> | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const { currentPos } = usePDRFuse();
  const pendingQueue = queue.filter(item => !item.sent);

  const handleAddContact = () => {
    if (!editingContact?.name || !editingContact?.phone) {
      Alert.alert('Hata', 'Ad ve telefon numarası gereklidir');
      return;
    }

    const contact: IceContact = {
      id: editingContact.id || `contact_${Date.now()}`,
      name: editingContact.name,
      phone: editingContact.phone,
      relation: editingContact.relation || '',
      priority: editingContact.priority || contacts.length + 1
    };

    if (editingContact.id) {
      updateContact(editingContact.id, contact);
    } else {
      addContact(contact);
    }

    setEditingContact(null);
    setShowAddContact(false);
  };

  const handleAddTemplate = () => {
    if (!editingTemplate?.label || !editingTemplate?.text) {
      Alert.alert('Hata', 'Etiket ve metin gereklidir');
      return;
    }

    const template: SmsTemplate = {
      id: editingTemplate.id || `template_${Date.now()}`,
      label: editingTemplate.label,
      text: editingTemplate.text
    };

    if (editingTemplate.id) {
      updateTemplate(template);
    } else {
      addTemplate(template);
    }

    setEditingTemplate(null);
    setShowAddTemplate(false);
  };

  const handleSendQueued = async () => {
    const success = await connectivityWatcher.sendQueuedManually();
    if (success) {
      Alert.alert('Başarılı', 'SMS gönderildi');
    }
  };

  const previewTemplate = (template: SmsTemplate) => {
    const location = currentPos ? `${currentPos.lat.toFixed(6)}, ${currentPos.lon.toFixed(6)}` : 'bilinmiyor';
    const status = 'SOS Aktif';
    const peopleCount = '2';

    return template.text
      .replace(/{Konum}/g, location)
      .replace(/{Durum}/g, status)
      .replace(/{KişiSayısı}/g, peopleCount);
  };

  const renderContact = ({ item, index }: { item: IceContact; index: number }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactHeader}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPriority}>#{item.priority}</Text>
      </View>
      <Text style={styles.contactPhone}>{item.phone}</Text>
      {item.relation && (
        <Text style={styles.contactRelation}>{item.relation}</Text>
      )}
      <View style={styles.contactActions}>
        <Pressable
          onPress={() => setEditingContact(item)}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Düzenle</Text>
        </Pressable>
        <Pressable
          onPress={() => removeContact(item.id)}
          style={[styles.actionButton, styles.dangerButton]}
        >
          <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Sil</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderTemplate = ({ item }: { item: SmsTemplate }) => (
    <View style={styles.templateItem}>
      <View style={styles.templateHeader}>
        <Text style={styles.templateLabel}>{item.label}</Text>
        <View style={styles.templateActions}>
          <Pressable
            onPress={() => setEditingTemplate(item)}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Düzenle</Text>
          </Pressable>
          {!item.id.startsWith('default_') && (
            <Pressable
              onPress={() => removeTemplate(item.id)}
              style={[styles.actionButton, styles.dangerButton]}
            >
              <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Sil</Text>
            </Pressable>
          )}
        </View>
      </View>
      <Text style={styles.templateText}>{item.text}</Text>
      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>Önizleme:</Text>
        <Text style={styles.previewText}>{previewTemplate(item)}</Text>
      </View>
    </View>
  );

  const renderQueueItem = ({ item }: { item: any }) => (
    <View style={styles.queueItem}>
      <View style={styles.queueHeader}>
        <Text style={styles.queuePhone}>{item.phone}</Text>
        <Text style={styles.queueStatus}>
          {item.sent ? 'Gönderildi' : 'Bekliyor'}
        </Text>
      </View>
      <Text style={styles.queueBody}>{item.body}</Text>
      <Text style={styles.queueTime}>
        {new Date(item.created).toLocaleString('tr-TR')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Acil İletişim (ICE)</Text>

      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab('contacts')}
          style={[styles.tab, activeTab === 'contacts' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
            Kişiler ({contacts.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('templates')}
          style={[styles.tab, activeTab === 'templates' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]}>
            Şablonlar ({templates.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('queue')}
          style={[styles.tab, activeTab === 'queue' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'queue' && styles.activeTabText]}>
            Sıra ({pendingQueue.length})
          </Text>
        </Pressable>
      </View>

      {activeTab === 'contacts' && (
        <View style={styles.tabContent}>
          <Pressable
            onPress={() => {
              setEditingContact({ priority: contacts.length + 1 });
              setShowAddContact(true);
            }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Kişi Ekle</Text>
          </Pressable>

          <FlatList
            data={contacts.sort((a, b) => a.priority - b.priority)}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            style={styles.list}
          />
        </View>
      )}

      {activeTab === 'templates' && (
        <View style={styles.tabContent}>
          <Pressable
            onPress={() => {
              setEditingTemplate({});
              setShowAddTemplate(true);
            }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Şablon Ekle</Text>
          </Pressable>

          <FlatList
            data={templates}
            renderItem={renderTemplate}
            keyExtractor={(item) => item.id}
            style={styles.list}
          />
        </View>
      )}

      {activeTab === 'queue' && (
        <View style={styles.tabContent}>
          {pendingQueue.length > 0 && (
            <Pressable
              onPress={handleSendQueued}
              style={[styles.addButton, styles.sendButton]}
            >
              <Text style={styles.addButtonText}>
                Şimdi Sıra Bekleyenleri Gönder
              </Text>
            </Pressable>
          )}

          {queue.length > 0 ? (
            <FlatList
              data={queue}
              renderItem={renderQueueItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Sıra bekleyen SMS bulunmuyor</Text>
            </View>
          )}

          {queue.length > 0 && (
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Sırayı Temizle',
                  'Tüm bekleyen SMS\'leri silmek istediğinizden emin misiniz?',
                  [
                    { text: 'İptal', style: 'cancel' },
                    { text: 'Temizle', onPress: clearQueue }
                  ]
                );
              }}
              style={[styles.actionButton, styles.dangerButton]}
            >
              <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
                Sırayı Temizle
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Add/Edit Contact Modal */}
      {showAddContact && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingContact?.id ? 'Kişi Düzenle' : 'Kişi Ekle'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ad Soyad"
              value={editingContact?.name || ''}
              onChangeText={(text) => setEditingContact(prev => ({ ...prev, name: text }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Telefon Numarası"
              value={editingContact?.phone || ''}
              onChangeText={(text) => setEditingContact(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="İlişki (opsiyonel)"
              value={editingContact?.relation || ''}
              onChangeText={(text) => setEditingContact(prev => ({ ...prev, relation: text }))}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setEditingContact(null);
                  setShowAddContact(false);
                }}
                style={styles.modalButton}
              >
                <Text style={styles.modalButtonText}>İptal</Text>
              </Pressable>
              <Pressable
                onPress={handleAddContact}
                style={[styles.modalButton, styles.primaryButton]}
              >
                <Text style={[styles.modalButtonText, styles.primaryButtonText]}>
                  Kaydet
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Add/Edit Template Modal */}
      {showAddTemplate && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTemplate?.id ? 'Şablon Düzenle' : 'Şablon Ekle'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Şablon Etiketi"
              value={editingTemplate?.label || ''}
              onChangeText={(text) => setEditingTemplate(prev => ({ ...prev, label: text }))}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="SMS Metni ({Konum}, {Durum}, {KişiSayısı} kullanabilirsiniz)"
              value={editingTemplate?.text || ''}
              onChangeText={(text) => setEditingTemplate(prev => ({ ...prev, text }))}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setEditingTemplate(null);
                  setShowAddTemplate(false);
                }}
                style={styles.modalButton}
              >
                <Text style={styles.modalButtonText}>İptal</Text>
              </Pressable>
              <Pressable
                onPress={handleAddTemplate}
                style={[styles.modalButton, styles.primaryButton]}
              >
                <Text style={[styles.modalButtonText, styles.primaryButtonText]}>
                  Kaydet
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
  addButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  contactItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
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
  },
  contactPriority: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
  },
  contactPhone: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 4,
  },
  contactRelation: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  templateItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  templateText: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 12,
  },
  previewContainer: {
    backgroundColor: '#1f2937',
    padding: 8,
    borderRadius: 6,
  },
  previewLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewText: {
    color: '#10b981',
    fontSize: 12,
    fontStyle: 'italic',
  },
  queueItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queuePhone: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  queueStatus: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  queueBody: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 8,
  },
  queueTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  actionButton: {
    backgroundColor: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  dangerButtonText: {
    color: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontStyle: 'italic',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#374151',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  modalButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
});
