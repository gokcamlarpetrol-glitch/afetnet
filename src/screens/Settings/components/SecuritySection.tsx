import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

export const SecuritySection = () => {
  return (
    <View style={styles.sectionContent}>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
          }}>
            <Ionicons name="shield" size={24} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Güvenlik Ayarları</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
              Güvenlik ve gizlilik ayarlarını yönetin
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.settingButton}>
          <Ionicons name="finger-print" size={20} color="#ef4444" />
          <Text style={styles.settingButtonText}>Biometrik Kimlik Doğrulama</Text>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <Ionicons name="lock-closed" size={20} color="#8b5cf6" />
          <Text style={styles.settingButtonText}>Şifreleme Ayarları</Text>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          <Text style={styles.settingButtonText}>Güvenlik Denetimi</Text>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <Ionicons name="key" size={20} color="#f59e0b" />
          <Text style={styles.settingButtonText}>Anahtar Yönetimi</Text>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContent: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginBottom: 12,
  },
  settingButtonText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 16,
    marginLeft: 12,
  },
});
