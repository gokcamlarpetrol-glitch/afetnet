import { useNavigation } from '@react-navigation/native';
import { logger } from '../utils/productionLogger';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SceneMap, TabBar, TabView } from 'react-native-tab-view';
import { formatAfnIdForDisplay } from '../identity/afnId';
import { Group, useGroups } from '../store/groups';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';

const GroupsListScene = () => {
  const { items } = useGroups();

  return (
    <ScrollView style={styles.scene}>
      {items.length === 0 ? (
        <Card title="Henüz grup yok">
          <Text style={styles.emptyText}>
            Grup oluşturun veya bir gruba katılın
          </Text>
        </Card>
      ) : (
        items.map((group) => (
          <Card key={group.id} title={group.name}>
            <View style={styles.groupInfo}>
              <Text style={styles.gidText}>{formatAfnIdForDisplay(group.gid)}</Text>
              <Text style={styles.memberCount}>
                {group.members.length} üye ({group.members.filter(m => m.verified).length} doğrulanmış)
              </Text>
              <View style={styles.groupActions}>
                <Button
                  label="Sohbet"
                  onPress={() => {
                    // Navigate to GroupChat
                    logger.debug('Navigate to GroupChat for:', group.name);
                  }}
                  variant="primary"
                  style={styles.actionButton}
                />
                <Button
                  label="QR"
                  onPress={() => {
                    // Show QR for group
                    logger.debug('Show QR for group:', group.gid);
                  }}
                  variant="ghost"
                  style={styles.actionButton}
                />
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const CreateGroupScene = () => {
  const { createLocal } = useGroups();
  const [groupName, setGroupName] = useState('');
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Hata', 'Grup adı gerekli');
      return;
    }

    const newGroup = createLocal(groupName.trim());
    setCreatedGroup(newGroup);
    setGroupName('');
  };

  const handleShareGid = async () => {
    if (!createdGroup) return;
    
    try {
      await Share.share({
        message: `AfetNet grubuna katıl: ${formatAfnIdForDisplay(createdGroup.gid)}`,
        title: 'Grup Daveti',
      });
    } catch (error) {
      logger.error('Share error:', error);
    }
  };

  const handleCopyGid = async () => {
    if (!createdGroup) return;
    
    await Clipboard.setStringAsync(createdGroup.gid);
    Alert.alert('Kopyalandı', 'AFN-GID panoya kopyalandı');
  };

  return (
    <ScrollView style={styles.scene}>
      <Card title="Yeni Grup Oluştur">
        <TextInput
          accessibilityRole="text"
          style={styles.input}
          placeholder="Grup adı"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
        <Button
          label="Grup Oluştur"
          onPress={handleCreateGroup}
          variant="primary"
          style={styles.createButton}
        />
      </Card>

      {createdGroup && (
        <Card title="Grup Oluşturuldu">
          <View style={styles.createdGroupInfo}>
            <Text style={styles.groupName}>{createdGroup.name}</Text>
            <Text style={styles.gidLabel}>AFN-GID:</Text>
            <Text style={styles.gidText}>{formatAfnIdForDisplay(createdGroup.gid)}</Text>
            
            <View style={styles.qrContainer}>
              <QRCode
                value={createdGroup.gid}
                size={200}
                color={palette.text.primary}
                backgroundColor={palette.background.primary}
              />
            </View>
            
            <View style={styles.groupActions}>
              <Button
                label="AFN-GID Kopyala"
                onPress={handleCopyGid}
                variant="ghost"
                style={styles.actionButton}
              />
              <Button
                label="Paylaş"
                onPress={handleShareGid}
                variant="primary"
                style={styles.actionButton}
              />
            </View>
            
            <Text style={styles.instructions}>
              Bu AFN-GID'yi paylaşarak diğerlerinin gruba katılmasını sağlayın.
              QR kodu tarayarak da katılım yapılabilir.
            </Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
};

const JoinGroupScene = () => {
  const { joinWithCode } = useGroups();
  const [gidInput, setGidInput] = useState('');
  const [groupName, setGroupName] = useState('');

  const handleJoinGroup = async () => {
    if (!gidInput.trim()) {
      Alert.alert('Hata', 'AFN-GID gerekli');
      return;
    }

    const result = joinWithCode(gidInput.trim(), groupName.trim() || 'Yeni Grup');
    
    if (result.ok) {
      Alert.alert('Başarılı', 'Gruba katıldınız!');
      setGidInput('');
      setGroupName('');
    } else {
      Alert.alert('Hata', result.error || 'Gruba katılınamadı');
    }
  };

  return (
    <ScrollView style={styles.scene}>
      <Card title="Gruba Katıl">
        <TextInput
          accessibilityRole="text"
          style={styles.input}
          placeholder="AFN-GID (AFN-GID-XXXX-XXXX)"
          value={gidInput}
          onChangeText={setGidInput}
          autoCapitalize="characters"
        />
        <TextInput
          accessibilityRole="text"
          style={styles.input}
          placeholder="Grup adı (isteğe bağlı)"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
        <Button
          label="Gruba Katıl"
          onPress={handleJoinGroup}
          variant="primary"
          style={styles.joinButton}
        />
        
        <View style={styles.joinActions}>
          <Button
            label="QR Tara"
            onPress={() => {
              // Navigate to QR scanner
              logger.debug('Navigate to QR scanner');
            }}
            variant="ghost"
            style={styles.actionButton}
          />
        </View>
        
        <Text style={styles.instructions}>
          AFN-GID'yi manuel olarak girin veya QR kodu tarayın.
          Grup adı boş bırakılırsa varsayılan ad kullanılır.
        </Text>
      </Card>
    </ScrollView>
  );
};

const renderScene = SceneMap({
  groups: GroupsListScene,
  create: CreateGroupScene,
  join: JoinGroupScene,
});

export default function GroupsScreen() {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'groups', title: 'Gruplarım' },
    { key: 'create', title: 'Grup Oluştur' },
    { key: 'join', title: 'Gruba Katıl' },
  ]);

  return (
    <View style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        renderTabBar={(props) => (
          <TabBar
            {...props as any}
            style={styles.tabBar}
            labelStyle={styles.tabLabel}
            indicatorStyle={styles.tabIndicator}
            activeColor={palette.primary}
            inactiveColor={palette.text.secondary}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary,
  },
  scene: {
    flex: 1,
    padding: spacing.md,
  },
  tabBar: {
    backgroundColor: palette.background.secondary,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabIndicator: {
    backgroundColor: palette.primary.main,
    height: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.text.secondary,
    fontSize: 16,
    marginVertical: spacing.lg,
  },
  groupInfo: {
    gap: spacing.sm,
  },
  gidText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: palette.text.primary,
    backgroundColor: palette.background.secondary,
    padding: spacing.xs,
    borderRadius: 4,
  },
  memberCount: {
    fontSize: 14,
    color: palette.text.secondary,
  },
  groupActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 16,
    color: palette.text.primary,
    backgroundColor: palette.background.secondary,
    marginBottom: spacing.sm,
  },
  createButton: {
    marginTop: spacing.sm,
  },
  joinButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  joinActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  createdGroupInfo: {
    alignItems: 'center',
    gap: spacing.md,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
  },
  gidLabel: {
    fontSize: 14,
    color: palette.text.secondary,
    fontWeight: '600',
  },
  qrContainer: {
    padding: spacing.md,
    backgroundColor: palette.background.secondary,
    borderRadius: 8,
  },
  instructions: {
    fontSize: 14,
    color: palette.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
