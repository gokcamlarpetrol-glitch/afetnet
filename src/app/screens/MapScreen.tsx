import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useI18n } from '../../hooks/useI18n';

export const MapScreen: React.FC = () => {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('map.title')}</Text>
      <Text style={styles.subtitle}>{t('map.offline')}</Text>
      {/* MapLibre GL implementation would go here */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});