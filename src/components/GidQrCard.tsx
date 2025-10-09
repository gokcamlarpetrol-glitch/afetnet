import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing } from '../ui/theme';
import { formatGidForDisplay } from '../identity/groupId';

interface GidQrCardProps {
  gid: string;
  groupName?: string;
  onClose?: () => void;
}

export default function GidQrCard({ gid, groupName, onClose }: GidQrCardProps) {
  const handleCopyGid = async () => {
    await Clipboard.setStringAsync(gid);
    // Could show a toast here
  };

  const handleShare = async () => {
    // This would typically use expo-sharing
    console.log('Share GID:', gid);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Grup Daveti</Text>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={palette.text.primary} />
          </Pressable>
        )}
      </View>

      {groupName && (
        <Text style={styles.groupName}>{groupName}</Text>
      )}

      <View style={styles.qrContainer}>
        <QRCode
          value={gid}
          size={200}
          color={palette.text.primary}
          backgroundColor={palette.background.primary}
        />
      </View>

      <Text style={styles.gidLabel}>AFN-GID:</Text>
      <Text style={styles.gidText}>{formatGidForDisplay(gid)}</Text>

      <Text style={styles.instructions}>
        Bu QR kodu tarayarak veya AFN-GID'yi manuel olarak girerek gruba katılabilirsiniz.
      </Text>

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={handleCopyGid}>
          <Ionicons name="copy" size={20} color={palette.primary} />
          <Text style={styles.actionText}>Kopyala</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share" size={20} color={palette.primary} />
          <Text style={styles.actionText}>Paylaş</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.background.primary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  groupName: {
    fontSize: 16,
    color: palette.text.secondary,
    marginBottom: spacing.md,
  },
  qrContainer: {
    padding: spacing.md,
    backgroundColor: palette.background.secondary,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  gidLabel: {
    fontSize: 14,
    color: palette.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  gidText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: palette.text.primary,
    backgroundColor: palette.background.secondary,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  instructions: {
    fontSize: 14,
    color: palette.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    fontSize: 14,
    color: palette.primary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
});
