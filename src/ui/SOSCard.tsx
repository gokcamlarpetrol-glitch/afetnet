import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useApp } from '../store/app';
import { getCoords } from '../lib/location';

export default function SOSCard() {
  const { enqueue } = useApp();
  
  const sendSOS = async () => {
    try {
      const c = await getCoords();
      enqueue({
        type: 'help',
        note: 'SOS Yardım Talebi',
        people: 1,
        priority: 'high',
        lat: c.lat, 
        lon: c.lon,
      });
    } catch {
      // SOS send error (silently ignored to not interrupt user)
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.h}>SOS / Yardım Talebi</Text>
      <Pressable onPress={sendSOS} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.btnText}>YARDIM İSTE</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#12162a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#20253b' },
  h: { color: '#b0bbd6', fontSize: 14, marginBottom: 8, fontWeight: '700' },
  btn: { backgroundColor: '#e15058', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.7 },
});
