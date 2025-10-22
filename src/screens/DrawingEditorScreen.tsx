import { Text, View } from 'react-native';

export default function PlaceholderScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
        🚧 Geliştiriliyor
      </Text>
      <Text style={{ color: '#94a3b8', fontSize: 16, marginTop: 10, textAlign: 'center' }}>
        Bu özellik geliştirilme aşamasında
      </Text>
      <Text style={{ color: '#64748b', fontSize: 14, marginTop: 20, textAlign: 'center' }}>
        Gelecek güncellemede aktif olacak
      </Text>
    </View>
  );
}
