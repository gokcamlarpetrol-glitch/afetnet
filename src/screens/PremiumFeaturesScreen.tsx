import { Text, View } from "react-native";

export default function PremiumFeaturesScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ color: "white", fontSize: 24, fontWeight: "bold", textAlign: 'center' }}>
        ⭐ Premium Özellikler
      </Text>
      <Text style={{ color: "#94a3b8", fontSize: 16, marginTop: 10, textAlign: 'center' }}>
        Premium özellikler geliştiriliyor
      </Text>
      <Text style={{ color: "#64748b", fontSize: 14, marginTop: 20, textAlign: 'center' }}>
        Bu özellik gelecek güncellemede aktif olacak
      </Text>
    </View>
  );
}