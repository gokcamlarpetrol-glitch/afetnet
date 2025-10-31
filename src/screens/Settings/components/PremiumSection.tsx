import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import * as Nav from '@react-navigation/native';
import { usePremium } from '../../../store/premium';
import PremiumActiveScreen from '../../PremiumActive';

export const PremiumSection = () => {
  const { isPremium } = usePremium();
  const navigation = (Nav as any).useNavigation?.() || { navigate: () => {} };

  if (!isPremium) {
    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        {/* Free User Premium Section */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            }}>
              <Ionicons name="lock-closed" size={24} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Premium Üyelik Gerekli</Text>
              <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                Tüm özellikler için Premium satın alın
              </Text>
            </View>
          </View>

          <View style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.2)',
          }}>
            <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              Ücretsiz Özellikler
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Deprem bildirimleri (Sınırsız)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Temel deprem takibi
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Temel ayarlar
              </Text>
            </View>
          </View>

          <View style={{
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.2)',
          }}>
            <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              Premium Özellikler
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Aile takibi ve mesajlaşma
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Offline harita ve navigasyon
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                SOS ve kurtarma araçları
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Şebekesiz offline mesajlaşma
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Bluetooth mesh ağı iletişimi
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                AI destekli afet analizi
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Eğitim ve simülasyon modları
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Gelişmiş raporlama ve analiz
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                Öncelikli destek
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.premiumButton}
            onPress={() => {
              try {
                navigation.navigate('Paywall');
              } catch (error) {
                if (__DEV__) {
                  console.error('Navigation error:', error);
                }
              }
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Premium abonelik satın al"
          >
            <Ionicons name="star" size={20} color="#fff" />
            <Text style={styles.premiumButtonText}>Premium Satın Al</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.premiumButton, { marginTop: 12, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3b82f6' }]}
            onPress={async () => {
              try {
                // Import restorePurchases from revenuecat
                const { restorePurchases } = await import('../../../lib/revenuecat');
                await restorePurchases();
              } catch (error) {
                if (__DEV__) {
                  console.error('Restore error:', error);
                }
              }
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Satın alımları geri yükle"
          >
            <Ionicons name="refresh" size={20} color="#3b82f6" />
            <Text style={[styles.premiumButtonText, { color: '#3b82f6' }]}>Satın Alımları Geri Yükle</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Premium kullanıcı için tam PremiumActiveScreen göster
  return <PremiumActiveScreen />;
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
  premiumButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  premiumButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
