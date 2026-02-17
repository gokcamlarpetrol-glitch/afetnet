/**
 * CREATE GROUP SCREEN — ELITE PROFESSIONAL
 * Select family members, set group name, and create a new group conversation.
 * Uses GroupChatService for Firestore group creation.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    Pressable,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { useFamilyStore } from '../../stores/familyStore';
import { groupChatService } from '../../services/GroupChatService';
import { identityService } from '../../services/IdentityService';
import { contactService } from '../../services/ContactService';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CreateGroupScreen');
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;

interface CreateGroupScreenProps {
    navigation: {
        navigate: (screen: string, params?: Record<string, unknown>) => void;
        goBack: () => void;
    };
}

interface SelectableMember {
    id: string; // Stable UI key
    name: string;
    deviceId: string; // Mesh/device fallback metadata
    uid?: string; // Canonical Firebase UID required for cloud group membership
    selected: boolean;
}

const trimIdentity = (value?: string | null): string => (value || '').trim();

const resolveMemberUid = (member: {
    uid?: string;
    deviceId?: string;
}): string => {
    const candidates = [member.uid, member.deviceId]
        .map(trimIdentity)
        .filter((value) => value.length > 0);

    const directUid = candidates.find((value) => UID_REGEX.test(value));
    if (directUid) {
        return directUid;
    }

    for (const candidate of candidates) {
        const resolved = trimIdentity(contactService.resolveCloudUid(candidate));
        if (UID_REGEX.test(resolved)) {
            return resolved;
        }
    }

    return '';
};

const toSelectableMembers = (
    members: ReturnType<typeof useFamilyStore.getState>['members'],
    previous: SelectableMember[] = [],
): SelectableMember[] => {
    const previousSelection = new Map(previous.map((entry) => [entry.id, entry.selected]));

    return members.map((member, index) => {
        const stableId =
            trimIdentity(member.uid) ||
            trimIdentity(member.deviceId) ||
            `member_${index}`;

        return {
            id: stableId,
            name: member.name || 'Aile Üyesi',
            deviceId: trimIdentity(member.deviceId) || stableId,
            uid: resolveMemberUid(member),
            selected: previousSelection.get(stableId) ?? false,
        };
    });
};

const getCurrentUserSafe = () => {
    try {
        return getAuth().currentUser;
    } catch {
        return null;
    }
};

export default function CreateGroupScreen({ navigation }: CreateGroupScreenProps) {
    const [groupName, setGroupName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const { members } = useFamilyStore();

    const [selectableMembers, setSelectableMembers] = useState<SelectableMember[]>(() =>
        toSelectableMembers(members),
    );

    useEffect(() => {
        setSelectableMembers((previous) => toSelectableMembers(members, previous));
    }, [members]);

    const selectedCount = useMemo(
        () => selectableMembers.filter((m) => m.selected).length,
        [selectableMembers],
    );

    const toggleMember = useCallback((memberId: string) => {
        haptics.impactLight();
        setSelectableMembers((prev) =>
            prev.map((m) => (m.id === memberId ? { ...m, selected: !m.selected } : m)),
        );
    }, []);

    const handleCreateGroup = useCallback(async () => {
        const trimmedName = groupName.trim();
        if (!trimmedName) {
            Alert.alert('Hata', 'Lütfen bir grup adı girin.');
            return;
        }
        if (selectedCount < 1) {
            Alert.alert('Hata', 'En az bir üye seçin.');
            return;
        }

        setIsCreating(true);
        haptics.impactMedium();

        try {
            const user = getCurrentUserSafe();
            if (!user) {
                Alert.alert('Hata', 'Oturum açmanız gerekiyor.');
                return;
            }

            const selected = selectableMembers.filter((m) => m.selected);
            const selectedWithoutUid = selected.filter((member) => !member.uid);
            if (selectedWithoutUid.length > 0) {
                Alert.alert(
                    'Eksik UID',
                    `Şu üyeler için bulut UID bulunamadı: ${selectedWithoutUid
                        .map((member) => member.name)
                        .slice(0, 3)
                        .join(', ')}${selectedWithoutUid.length > 3 ? '...' : ''}\n\nBu üyeleri önce UID içeren QR ile tekrar ekleyin.`,
                );
                return;
            }

            const memberUids = selected
                .map((member) => member.uid || '')
                .filter((uid) => uid.length > 0);
            const memberNames: Record<string, string> = {};
            const memberDeviceIds: Record<string, string> = {};

            // Add current user
            memberNames[user.uid] = user.displayName || identityService.getIdentity()?.displayName || 'Ben';
            memberDeviceIds[user.uid] = identityService.getUid() || identityService.getMyId() || '';

            // Add selected members
            selected.forEach((m) => {
                if (!m.uid) return;
                memberNames[m.uid] = m.name;
                memberDeviceIds[m.uid] = m.deviceId || m.uid;
            });

            const groupId = await groupChatService.createGroup(
                trimmedName,
                memberUids,
                memberNames,
                memberDeviceIds,
            );

            if (groupId) {
                haptics.notificationSuccess();
                navigation.navigate('FamilyGroupChat', { groupId });
            } else {
                Alert.alert('Hata', 'Grup oluşturulamadı. Lütfen tekrar deneyin.');
            }
        } catch (error) {
            logger.error('createGroup failed:', error);
            Alert.alert('Hata', 'Grup oluşturulurken bir hata oluştu.');
        } finally {
            setIsCreating(false);
        }
    }, [groupName, selectedCount, selectableMembers, navigation]);

    const renderMember = useCallback(
        ({ item }: { item: SelectableMember }) => (
            <Pressable
                style={[styles.memberItem, item.selected && styles.memberItemSelected]}
                onPress={() => toggleMember(item.id)}
            >
                <View style={[styles.avatar, item.selected && styles.avatarSelected]}>
                    <Ionicons
                        name={item.selected ? 'checkmark' : 'person'}
                        size={20}
                        color={item.selected ? '#fff' : colors.text.secondary}
                    />
                </View>
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberId}>
                        {item.uid ? `UID: ${item.uid.substring(0, 12)}...` : 'UID bulunamadı'}
                    </Text>
                </View>
                {item.selected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary.main} />
                )}
            </Pressable>
        ),
        [toggleMember],
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </Pressable>
                <Text style={styles.headerTitle}>Yeni Grup</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Group Name Input */}
            <View style={styles.nameSection}>
                <View style={styles.groupIconCircle}>
                    <Ionicons name="people" size={28} color={colors.primary.main} />
                </View>
                <TextInput
                    style={styles.nameInput}
                    placeholder="Grup adı girin..."
                    placeholderTextColor={colors.text.tertiary}
                    value={groupName}
                    onChangeText={setGroupName}
                    maxLength={50}
                    autoFocus
                />
            </View>

            {/* Member Selection */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Üye Seç</Text>
                <Text style={styles.selectedCount}>{selectedCount} seçili</Text>
            </View>

            {selectableMembers.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
                    <Text style={styles.emptyText}>Henüz aile üyesi eklenmemiş</Text>
                    <Text style={styles.emptySubtext}>
                        Önce Aile menüsünden üye ekleyin
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={selectableMembers}
                    renderItem={renderMember}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.memberList}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Create Button */}
            <View style={styles.footer}>
                <Pressable
                    style={[
                        styles.createButton,
                        (!groupName.trim() || selectedCount < 1 || isCreating) && styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateGroup}
                    disabled={!groupName.trim() || selectedCount < 1 || isCreating}
                >
                    {isCreating ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Ionicons name="add-circle" size={22} color="#fff" />
                            <Text style={styles.createButtonText}>Grup Oluştur</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background.card,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text.primary,
    },
    nameSection: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    groupIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: `${colors.primary.main}20`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    nameInput: {
        flex: 1,
        fontSize: 17,
        color: colors.text.primary,
        paddingVertical: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    selectedCount: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary.main,
    },
    memberList: {
        paddingHorizontal: 16,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: colors.background.card,
    },
    memberItemSelected: {
        backgroundColor: `${colors.primary.main}10`,
        borderWidth: 1,
        borderColor: `${colors.primary.main}30`,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: `${colors.text.secondary}20`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarSelected: {
        backgroundColor: colors.primary.main,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    memberId: {
        fontSize: 12,
        color: colors.text.secondary,
        marginTop: 2,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: 4,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary.main,
        borderRadius: 14,
        paddingVertical: 16,
        gap: 8,
    },
    createButtonDisabled: {
        opacity: 0.5,
    },
    createButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },
});
