import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet, Alert } from 'react-native';
import { usePairing } from '../store/pairing';
import { meshRelay } from '../services/mesh/relay';

interface Message {
  id: string;
  text: string;
  from: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered';
  encrypted: boolean;
}

export default function Chat() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [deliveryStatuses, setDeliveryStatuses] = useState<Map<string, 'pending' | 'sent' | 'delivered'>>(new Map());

  const { pairedContacts, groups } = usePairing();

  useEffect(() => {
    // Set up mesh relay events
    meshRelay.setEvents({
      onDM: (msg, decrypted) => {
        if (decrypted) {
          const message: Message = {
            id: msg.id,
            text: decrypted,
            from: msg.to || msg.group || 'unknown',
            timestamp: Date.now(),
            status: 'delivered',
            encrypted: msg.enc
          };
          setMessages(prev => [...prev, message]);
        }
      },
      onACK: (msg) => {
        // Update delivery status when ACK received
        setDeliveryStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(msg.ref, 'delivered');
          return newMap;
        });
      }
    });
  }, []);

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    if (!selectedContact && !selectedGroup) return;

    const messageId = await meshRelay.sendDM(
      selectedContact || undefined,
      selectedGroup || undefined,
      messageText.trim()
    );

    const message: Message = {
      id: messageId,
      text: messageText.trim(),
      from: 'me',
      timestamp: Date.now(),
      status: 'pending',
      encrypted: true
    };

    setMessages(prev => [...prev, message]);
    setDeliveryStatuses(prev => new Map(prev).set(messageId, 'pending'));
    setMessageText('');
  };

  const getDeliveryIcon = (status: 'pending' | 'sent' | 'delivered') => {
    switch (status) {
      case 'pending': return '⬤';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      default: return '⬤';
    }
  };

  const renderContact = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => {
        setSelectedContact(item.id);
        setSelectedGroup(null);
      }}
      style={[
        styles.contactItem,
        selectedContact === item.id && styles.contactItemSelected
      ]}
    >
      <Text style={styles.contactName}>{item.name}</Text>
      <Text style={styles.contactId}>{item.id.slice(-6)}</Text>
    </Pressable>
  );

  const renderGroup = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => {
        setSelectedGroup(item.id);
        setSelectedContact(null);
      }}
      style={[
        styles.contactItem,
        selectedGroup === item.id && styles.contactItemSelected
      ]}
    >
      <Text style={styles.contactName}>{item.name}</Text>
      <Text style={styles.contactId}>{item.memberPubKeysB64.length} üye</Text>
    </Pressable>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.from === 'me';
    const status = deliveryStatuses.get(item.id) || item.status;
    
    return (
      <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
        <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.encrypted ? '🔒 ' : ''}{item.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
              {new Date(item.timestamp).toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {isMe && (
              <Text style={styles.deliveryStatus}>
                {getDeliveryIcon(status)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const currentTarget = selectedContact || selectedGroup;
  const currentTargetName = selectedContact 
    ? pairedContacts.find(c => c.id === selectedContact)?.name
    : groups.find(g => g.id === selectedGroup)?.name;

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab('contacts')}
          style={[styles.tab, activeTab === 'contacts' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}>
            Kişi
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('groups')}
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
            Grup
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Contact/Group List */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            {activeTab === 'contacts' ? 'Eşleşmiş Kişiler' : 'Gruplar'}
          </Text>
          <FlatList
            data={activeTab === 'contacts' ? pairedContacts : groups}
            renderItem={activeTab === 'contacts' ? renderContact : renderGroup}
            keyExtractor={(item) => item.id}
            style={styles.list}
          />
        </View>

        {/* Chat Area */}
        <View style={styles.chatContainer}>
          {currentTarget ? (
            <>
              <Text style={styles.chatTitle}>
                {currentTargetName || 'Bilinmeyen'}
              </Text>
              
              <FlatList
                data={messages.filter(m => 
                  (selectedContact && m.from === selectedContact) ||
                  (selectedGroup && m.from === selectedGroup) ||
                  m.from === 'me'
                )}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                inverted
              />

              <View style={styles.inputContainer}>
                <TextInput
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Mesaj yazın (max 120 karakter)"
                  placeholderTextColor="#64748b"
                  style={styles.textInput}
                  maxLength={120}
                  multiline
                />
                <Pressable
                  onPress={sendMessage}
                  disabled={!messageText.trim()}
                  style={[
                    styles.sendButton,
                    !messageText.trim() && styles.sendButtonDisabled
                  ]}
                >
                  <Text style={styles.sendButtonText}>Gönder</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {activeTab === 'contacts' 
                  ? 'Bir kişi seçin' 
                  : 'Bir grup seçin'
                }
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    marginBottom: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#1f2937',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  listContainer: {
    width: 200,
    backgroundColor: '#111827',
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  listTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
    backgroundColor: '#1f2937',
  },
  list: {
    flex: 1,
  },
  contactItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  contactItemSelected: {
    backgroundColor: '#1f2937',
  },
  contactName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  contactId: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  chatTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    padding: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  messagesList: {
    flex: 1,
    padding: 12,
  },
  messageContainer: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  messageContainerMe: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  messageBubbleMe: {
    backgroundColor: '#3b82f6',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#ffffff',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  messageTimeMe: {
    color: '#e0e7ff',
  },
  deliveryStatus: {
    color: '#94a3b8',
    fontSize: 12,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
});
