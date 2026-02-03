import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from '../../../components/SafeBlurView';
import { Ionicons } from '@expo/vector-icons';

interface AIStatusSummaryProps {
    userName?: string;
    location?: string;
    status?: string;
}

export const AIStatusSummary: React.FC<AIStatusSummaryProps> = ({
  userName = 'Kullanıcı',
  location = 'Konum Belirleniyor',
  status = 'Sistem Normal',
}) => {
  // Get time of day for greeting
  const hour = new Date().getHours();
  let greeting = 'İyi Günler';
  if (hour < 12) greeting = 'Günaydın';
  else if (hour > 18) greeting = 'İyi Akşamlar';

  return (
    <View style={styles.container}>
      <BlurView intensity={10} tint="light" style={styles.blur}>
        <View style={styles.iconBox}>
          <Ionicons name="shield-checkmark" size={16} color="#10B981" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>
            {greeting}, <Text style={styles.name}>{userName}</Text>
          </Text>
          <Text style={styles.status}>
            {location} • <Text style={styles.statusHighlight}>{status}</Text>
          </Text>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  name: {
    color: '#FFF',
    fontWeight: '700',
  },
  status: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusHighlight: {
    color: '#10B981',
    fontWeight: '600',
  },
});
