import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFamily } from '../store/familyStore';

type NavigationProp = any;

export default function FamilyPreview() {
  const { members } = useFamily();
  const navigation = require('@react-navigation/native').useNavigation() as NavigationProp;
  const top = members.slice(0, 2);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.h}>Aile</Text>
        <Pressable onPress={() => navigation.navigate('Family')}>
          <Text style={styles.link}>Tümü</Text>
        </Pressable>
      </View>
      {top.length === 0 ? (
        <Text style={styles.s}>Ailenizi ekleyin ve durumlarını görün.</Text>
      ) : (
        top.map(m => (
          <View key={m.id} style={styles.item}>
            <Text style={styles.name}>{m.name}</Text>
            <Text style={styles.state}>{m.state ?? '—'}</Text>
          </View>
        ))
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#12162a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#20253b' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  h: { color: '#b0bbd6', fontSize: 14, fontWeight: '700' },
  link: { color: '#8bd0ff', fontWeight: '700' },
  s: { color: '#9db0cd', fontSize: 13 },
  item: { backgroundColor: '#0d1122', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#1b2140' },
  name: { color: '#e9eefc', fontWeight: '700' },
  state: { color: '#9db0cd', fontSize: 12 },
});



