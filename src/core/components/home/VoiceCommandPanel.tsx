/**
 * VOICE COMMAND PANEL - UI Buttons for Emergency Commands
 * Hands-free alternative: Quick access buttons for trapped victims
 * Commands: Yardım, Konum, Düdük, SOS
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { voiceCommandService } from '../../services/VoiceCommandService';
import * as haptics from '../../utils/haptics';
import { colors } from '../../theme';
import { createLogger } from '../../utils/logger';

const logger = createLogger('VoiceCommandPanel');

interface VoiceCommandPanelProps {
  onCommandExecuted?: (command: string) => void;
}

export default function VoiceCommandPanel({ onCommandExecuted }: VoiceCommandPanelProps) {
  const [executing, setExecuting] = useState<string | null>(null);

  const commands = [
    {
      id: 'yardim',
      label: 'Yardım',
      icon: 'help-circle' as const,
      gradient: ['#ef4444', '#dc2626'],
      command: 'yardim' as const,
    },
    {
      id: 'konum',
      label: 'Konum',
      icon: 'location' as const,
      gradient: ['#3b82f6', '#2563eb'],
      command: 'konum' as const,
    },
    {
      id: 'duduk',
      label: 'Düdük',
      icon: 'megaphone' as const,
      gradient: ['#f59e0b', '#d97706'],
      command: 'duduk' as const,
    },
    {
      id: 'sos',
      label: 'SOS',
      icon: 'warning' as const,
      gradient: ['#dc2626', '#b91c1c'],
      command: 'sos' as const,
    },
  ];

  const handleCommand = async (command: string) => {
    if (executing) return; // Prevent multiple simultaneous commands

    haptics.impactMedium();
    setExecuting(command);

    try {
      await voiceCommandService.triggerCommand(command as any);
      haptics.notificationSuccess();
      onCommandExecuted?.(command);
    } catch (error) {
      logger.error('Voice command error:', error);
      haptics.notificationError();
    } finally {
      // Reset after animation
      setTimeout(() => setExecuting(null), 500);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="mic" size={20} color={colors.text.secondary} />
        <Text style={styles.headerText}>Sesli Komutlar</Text>
      </View>

      <View style={styles.commandsGrid}>
        {commands.map((cmd) => {
          const isExecuting = executing === cmd.id;

          return (
            <TouchableOpacity
              key={cmd.id}
              style={styles.commandButton}
              onPress={() => handleCommand(cmd.command)}
              disabled={executing !== null}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={isExecuting ? ['#10b981', '#059669'] : (cmd.gradient as [string, string])}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.commandGradient,
                  isExecuting && styles.commandGradientExecuting,
                ]}
              >
                <Ionicons
                  name={isExecuting ? 'checkmark-circle' : cmd.icon}
                  size={32}
                  color="#ffffff"
                />
                <Text style={styles.commandLabel}>
                  {isExecuting ? 'Gönderiliyor...' : cmd.label}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.hint}>
        Acil durumlarda hızlı erişim için kullanın
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  commandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  commandButton: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
  },
  commandGradient: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  commandGradientExecuting: {
    opacity: 0.9,
  },
  commandLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

