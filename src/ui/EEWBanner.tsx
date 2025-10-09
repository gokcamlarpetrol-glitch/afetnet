import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useEEW } from '../store/eewStore';

export default function EEWBanner() {
  const { live, last } = useEEW();
  const item = live ?? last;
  return (
    <View style={styles.card}>
      <Text style={styles.h}>Deprem Uyarısı</Text>
      {item ? (
        <>
          <Text style={styles.m}>Şiddet: {item.mag?.toFixed(1) ?? '—'}</Text>
          <Text style={styles.s}>Merkez: {item.place ?? '—'}</Text>
          <Text style={styles.s}>Zaman: {new Date(item.time).toLocaleString()}</Text>
        </>
      ) : (
        <Text style={styles.s}>Şu an deprem bildirimi yok.</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#12162a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#20253b' },
  h: { color: '#9ac7ff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  m: { color: '#e9eefc', fontSize: 18, fontWeight: '700' },
  s: { color: '#b8c2d9', fontSize: 13, marginTop: 2 }
});
