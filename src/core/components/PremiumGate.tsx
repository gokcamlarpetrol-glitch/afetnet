/**
 * PREMIUM GATE - Overlay for Premium Features
 * Shows screen but prevents interaction
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PremiumGateProps {
  featureName: string;
}

export default function PremiumGate({ featureName }: PremiumGateProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={48} color="#3b82f6" />
        </View>
        
        <Text style={styles.title}>Premium Özellik</Text>
        
        <Text style={styles.description}>
          {featureName} özelliğini kullanmak için Premium üyelik gereklidir.
        </Text>

        <Pressable
          style={styles.upgradeButton}
          onPress={() => {
            // Navigation will be handled by parent component
            console.log('Premium upgrade requested');
          }}
        >
          <Ionicons name="star" size={20} color="#fff" />
          <Text style={styles.upgradeButtonText}>Premium'a Geç</Text>
        </Pressable>

        <Text style={styles.note}>
          Ekranı görüntüleyebilirsiniz ancak kullanmak için Premium gereklidir.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  note: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});

