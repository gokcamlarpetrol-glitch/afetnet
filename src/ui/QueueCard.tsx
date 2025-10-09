import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useApp } from '../store/app';

export default function QueueCard() {
  const { size, flush } = useApp();
  const count = size();
  
  return (
    <View style={styles.card}>
      <Text style={styles.h}>Kuyruk</Text>
      <View style={styles.row}>
        <Text style={styles.count}>{count}</Text>
        <Pressable onPress={() => flush({ manual: true })} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.btnText}>GÖNDER ({count})</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#12162a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#20253b' },
  h: { color: '#b0bbd6', fontSize: 14, marginBottom: 8, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { color: '#e9eefc', fontSize: 22, fontWeight: '800' },
  btn: { backgroundColor: '#29b36b', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  btnText: { color: '#051012', fontSize: 14, fontWeight: '800' }
});



