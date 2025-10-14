import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatAfnIdForDisplay } from '../identity/afnId';
import { gSeal, generateVerificationPhrase } from '../lib/cryptoGroup';
import { useGroups } from '../store/groups';
import { usePeople } from '../store/people';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';
import { logger } from '../utils/productionLogger';

type GroupMessage = {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  priority: 'NORMAL' | 'HIGH';
};

export default function GroupChatScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { groups, updateLastActivity, getSharedKey } = useGroups();
  const { meAfnId } = usePeople();
  
  const groupId = (route.params as any)?.groupId;
  const group = groups.find(g => g.id === groupId);
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyEndTime, setEmergencyEndTime] = useState(0);
  const [verificationPhrase, setVerificationPhrase] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    if (group) {
      updateLastActivity(group.id);
    }
  }, [group, updateLastActivity]);

  useEffect(() => {
    // Auto-disable emergency mode after 60 seconds
    if (emergencyMode && emergencyEndTime > 0) {
      const timer = setTimeout(() => {
        setEmergencyMode(false);
        setEmergencyEndTime(0);
      }, emergencyEndTime - Date.now());
      
      return () => clearTimeout(timer);
    }
  }, [emergencyMode, emergencyEndTime]);

  if (!group) {
    return (
      <View style={styles.container}>
        <Card title="Hata">
          <Text style={styles.errorText}>Grup bulunamadı</Text>
          <Button
            label="Geri Dön"
            onPress={() => navigation.goBack()}
            variant="primary"
            style={styles.backButton}
          />
        </Card>
      </View>
    );
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      const sharedKey = getSharedKey(group.id);
      if (!sharedKey) {
        Alert.alert('Hata', 'Grup şifreleme anahtarı bulunamadı');
        return;
      }

      // Encrypt message
      const messageBytes = new TextEncoder().encode(message.trim());
      const { nonceB64, boxB64 } = gSeal(sharedKey, messageBytes);

      // Create message object
      const newMessage: GroupMessage = {
        id: Date.now().toString(),
        sender: meAfnId,
        content: message.trim(),
        timestamp: Date.now(),
        priority: emergencyMode ? 'HIGH' : 'NORMAL',
      };

      // Add to local messages
      setMessages(prev => [...prev, newMessage]);
      
      // Send via mesh (this would integrate with the mesh relay)
      logger.debug('Sending encrypted group message:', {
        groupId: group.gid,
        messageId: newMessage.id,
        boxB64,
        nonceB64,
        priority: newMessage.priority,
      });

      setMessage('');
      updateLastActivity(group.id);
    } catch (error) {
      logger.error('Failed to send message:', error);
      Alert.alert('Hata', 'Mesaj gönderilemedi');
    }
  };

  const handleToggleEmergency = () => {
    if (!emergencyMode) {
      setEmergencyMode(true);
      setEmergencyEndTime(Date.now() + 60000); // 60 seconds
    } else {
      setEmergencyMode(false);
      setEmergencyEndTime(0);
    }
  };

  const handleShowVerification = async () => {
    const sharedKey = getSharedKey(group.id);
    if (!sharedKey) {
      Alert.alert('Hata', 'Grup şifreleme anahtarı bulunamadı');
      return;
    }

    const phrase = await generateVerificationPhrase(sharedKey);
    setVerificationPhrase(phrase);
    setShowVerification(true);
  };

  const handleVerificationMatch = () => {
    // This would send GVERA message to the group
    logger.debug('Sending verification match for phrase:', verificationPhrase);
    Alert.alert('Doğrulama', 'Eşleşme onaylandı');
    setShowVerification(false);
    setVerificationPhrase(null);
  };

  const handleCopyGid = async () => {
    await Clipboard.setStringAsync(group.gid);
    Alert.alert('Kopyalandı', 'AFN-GID panoya kopyalandı');
  };

  const handleShareGroup = async () => {
    try {
      await Share.share({
        message: `AfetNet grubuna katıl: ${formatAfnIdForDisplay(group.gid)}`,
        title: 'Grup Daveti',
      });
    } catch (error) {
      logger.error('Share error:', error);
    }
  };

  const verifiedMembers = group.members.filter(m => m.verified);
  const totalMembers = group.members.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text.primary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.gidText}>{formatAfnIdForDisplay(group.gid)}</Text>
        </View>
        <Pressable onPress={handleCopyGid} style={styles.copyButton}>
          <Ionicons name="copy" size={20} color={palette.text.secondary} />
        </Pressable>
      </View>

      {/* Emergency Banner */}
      {emergencyMode && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>ACİL YAYIN MODU AKTİF</Text>
        </View>
      )}

      {/* Members Info */}
      <Card title="Üyeler" style={styles.membersCard}>
        <Text style={styles.memberCount}>
          {totalMembers} üye ({verifiedMembers.length} doğrulanmış)
        </Text>
        <ScrollView horizontal style={styles.memberList}>
          {group.members.map((member, index) => (
            <View key={member.afnId} style={styles.memberChip}>
              <Text style={styles.memberName}>
                {member.name || `Üye ${index + 1}`}
              </Text>
              {member.verified && (
                <Ionicons name="checkmark-circle" size={16} color={palette.success.main} />
              )}
            </View>
          ))}
        </ScrollView>
      </Card>

      {/* Messages */}
      <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {messages.length === 0 ? (
          <Text style={styles.emptyMessages}>Henüz mesaj yok</Text>
        ) : (
          messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === meAfnId ? styles.myMessage : styles.otherMessage,
                msg.priority === 'HIGH' && styles.emergencyMessage,
              ]}
            >
              <Text style={styles.messageContent}>{msg.content}</Text>
              <Text style={styles.messageTime}>
                {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              {msg.priority === 'HIGH' && (
                <Ionicons name="warning" size={16} color={palette.error.main} />
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Message Composer */}
      <View style={styles.composer}>
        <TextInput
          accessibilityRole="text"
          style={styles.messageInput}
          placeholder="Mesaj yazın..."
          value={message}
          onChangeText={setMessage}
          maxLength={240}
          multiline
        />
        <View style={styles.composerActions}>
          <Pressable accessible={true}
            onPress={handleToggleEmergency}
            style={[
              styles.emergencyButton,
              emergencyMode && styles.emergencyButtonActive,
            ]}
          >
            <Ionicons
              name="warning"
              size={20}
              color={emergencyMode ? palette.error.main : palette.text.secondary}
            />
          </Pressable>
          <Button
            label="Gönder"
            onPress={handleSendMessage}
            variant="primary"
            style={styles.sendButton}
          />
        </View>
      </View>

      {/* Group Actions */}
      <View style={styles.groupActions}>
        <Button
          label="Doğrulama Cümlesi"
          onPress={handleShowVerification}
          variant="ghost"
          style={styles.actionButton}
        />
        <Button
          label="QR ile Davet"
          onPress={handleShareGroup}
          variant="ghost"
          style={styles.actionButton}
        />
      </View>

      {/* Verification Modal */}
      {showVerification && verificationPhrase && (
        <View style={styles.verificationModal}>
          <View style={styles.verificationContent}>
            <Text style={styles.verificationTitle}>Doğrulama Cümlesi</Text>
            <Text style={styles.verificationPhrase}>{verificationPhrase}</Text>
            <Text style={styles.verificationInstructions}>
              Bu cümleyi yüksek sesle okuyun ve diğer üyelerle eşleştiğini doğrulayın.
            </Text>
            <View style={styles.verificationActions}>
              <Button
                label="Eşleşti"
                onPress={handleVerificationMatch}
                variant="primary"
                style={styles.verificationButton}
              />
              <Button
                label="İptal"
                onPress={() => {
                  setShowVerification(false);
                  setVerificationPhrase(null);
                }}
                variant="ghost"
                style={styles.verificationButton}
              />
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
    backgroundColor: palette.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: palette.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: palette.text.primary,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
  },
  gidText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: palette.text.secondary,
  },
  copyButton: {
    padding: spacing.xs,
  },
  emergencyBanner: {
    backgroundColor: palette.error.main,
    padding: spacing.sm,
    alignItems: 'center',
  },
  emergencyText: {
    color: palette.error.main,
    fontWeight: 'bold',
    fontSize: 14,
  },
  membersCard: {
    margin: spacing.md,
  },
  memberCount: {
    fontSize: 14,
    color: palette.text.secondary,
    marginBottom: spacing.sm,
  },
  memberList: {
    flexDirection: 'row',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    marginRight: spacing.xs,
  },
  memberName: {
    fontSize: 12,
    color: palette.text.primary,
    marginRight: spacing.xs,
  },
  messagesContainer: {
    flex: 1,
    padding: spacing.md,
  },
  messagesContent: {
    paddingBottom: spacing.md,
  },
  emptyMessages: {
    textAlign: 'center',
    color: palette.text.secondary,
    fontSize: 16,
    marginTop: spacing.xl,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: palette.primary.main,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: palette.background.secondary,
  },
  emergencyMessage: {
    borderWidth: 2,
    borderColor: palette.error.main,
  },
  messageContent: {
    fontSize: 16,
    color: palette.text.primary,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 12,
    color: palette.text.secondary,
    marginTop: spacing.xs,
  },
  composer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: palette.background.secondary,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: palette.text.primary,
    backgroundColor: palette.background.primary,
    maxHeight: 100,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  emergencyButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  emergencyButtonActive: {
    backgroundColor: palette.error.main + '20',
    borderRadius: 20,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
  },
  groupActions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  verificationModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  verificationContent: {
    backgroundColor: palette.background.primary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    maxWidth: '90%',
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
  },
  verificationPhrase: {
    fontSize: 16,
    color: palette.primary.main,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: palette.background.secondary,
    borderRadius: 8,
  },
  verificationInstructions: {
    fontSize: 14,
    color: palette.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  verificationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  verificationButton: {
    flex: 1,
  },
  errorText: {
    textAlign: 'center',
    color: palette.text.secondary,
    fontSize: 16,
    marginVertical: spacing.lg,
  },
});
