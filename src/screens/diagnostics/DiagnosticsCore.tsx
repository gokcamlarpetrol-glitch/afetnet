import { Text, View } from 'react-native';

export default function Diagnostics() {

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 16 }}>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Diagnostics
      </Text>
      <Text style={{ color: '#94a3b8' }}>
        Diagnostics temporarily simplified for performance.
      </Text>
    </View>
  );
}
