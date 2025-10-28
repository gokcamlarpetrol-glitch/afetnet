import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

type NavigationProp = any;

const items = [
  { key: 'map', label: 'Harita', to: 'Map' },
  { key: 'nearby', label: 'Yakındakiler', to: 'Map' },
  { key: 'qr', label: 'QR Senk', to: 'Settings' },
  { key: 'ble', label: 'BLE Yayın', to: 'Settings' },
  { key: 'msgs', label: 'Mesajlar', to: 'Messages' },
];

export default function QuickActions() {
  const navigation = require('@react-navigation/native').useNavigation() as NavigationProp;
  return (
    <View style={styles.card}>
      <Text style={styles.h}>Kısayollar</Text>
      <View style={styles.grid}>
        {items.map(it => (
          <Pressable key={it.key} onPress={() => navigation.navigate(it.to)} style={styles.item}>
            <Text style={styles.txt}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#12162a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#20253b' },
  h: { color: '#b0bbd6', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { backgroundColor: '#0d1122', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#1b2140' },
  txt: { color: '#c6d3ef', fontWeight: '700' },
});



