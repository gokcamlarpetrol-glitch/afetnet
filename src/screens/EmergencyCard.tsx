import * as FileSystem from 'expo-file-system';
import { logger } from '../utils/productionLogger';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { usePDRFuse } from '../hooks/usePDRFuse';
import { useIce } from '../store/ice';

export default function EmergencyCard() {
  const [generating, setGenerating] = useState(false);
  const { contacts } = useIce();
  const { currentPos } = usePDRFuse();

  // Mock user profile data - in real app this would come from user profile
  const userProfile = {
    name: 'Kullanıcı Adı', // Would be from profile store
    bloodType: 'A+', // Would be from profile store
    allergies: 'Polen, Penisilin', // Would be from profile store
    emergencyContact: 'Anne: +90 555 123 4567' // Would be from profile store
  };

  const generateQRContent = () => {
    const sosId = `sos_${Date.now()}`; // In real app, would be actual SOS ID
    const location = currentPos ? `${currentPos.lat.toFixed(6)},${currentPos.lon.toFixed(6)}` : 'unknown';
    
    return {
      app: 'AfetNet',
      sosId,
      timestamp: Date.now(),
      location,
      profile: {
        name: userProfile.name,
        bloodType: userProfile.bloodType,
        allergies: userProfile.allergies
      }
    };
  };

  const maskPhoneNumber = (phone: string): string => {
    if (phone.length < 4) return phone;
    const visible = phone.slice(-4);
    const masked = '*'.repeat(phone.length - 4);
    return masked + visible;
  };

  const handleSavePNG = async () => {
    setGenerating(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `afetnet_card_${timestamp}.png`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // In a real implementation, you would render the card to an image
      // For now, we'll create a simple text file as placeholder
      const cardContent = generateCardText();
      await FileSystem.writeAsStringAsync(fileUri, cardContent);

      Alert.alert(
        'Kart Kaydedildi',
        `Acil durum kartı kaydedildi: ${fileName}`,
        [
          { text: 'Tamam' },
          {
            text: 'Paylaş',
            onPress: () => handleShare(fileUri)
          }
        ]
      );
    } catch (error) {
      logger.error('Failed to save card:', error);
      Alert.alert('Hata', 'Kart kaydedilemedi');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async (fileUri?: string) => {
    try {
      if (!fileUri) {
        // Generate temporary file for sharing
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `afetnet_card_${timestamp}.txt`;
        fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        const cardContent = generateCardText();
        await FileSystem.writeAsStringAsync(fileUri, cardContent);
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Acil Durum Kartını Paylaş'
        });
      } else {
        Alert.alert('Hata', 'Paylaşım bu cihazda desteklenmiyor');
      }
    } catch (error) {
      logger.error('Failed to share card:', error);
      Alert.alert('Hata', 'Kart paylaşılamadı');
    }
  };

  const generateCardText = (): string => {
    const qrData = generateQRContent();
    const timestamp = new Date().toLocaleString('tr-TR');
    
    let cardText = `AFETNET ACİL DURUM KARTI\n`;
    cardText += `================================\n\n`;
    cardText += `Ad: ${userProfile.name}\n`;
    cardText += `Kan Grubu: ${userProfile.bloodType}\n`;
    cardText += `Alerjiler: ${userProfile.allergies}\n`;
    cardText += `Acil İletişim: ${userProfile.emergencyContact}\n\n`;
    
    if (currentPos) {
      cardText += `Son Konum: ${currentPos.lat.toFixed(6)}, ${currentPos.lon.toFixed(6)}\n`;
    }
    
    cardText += `SOS ID: ${qrData.sosId}\n`;
    cardText += `Tarih: ${timestamp}\n\n`;
    
    if (contacts.length > 0) {
      cardText += `ICE KİŞİLERİ:\n`;
      contacts.slice(0, 3).forEach((contact, index) => {
        cardText += `${index + 1}. ${contact.name}: ${maskPhoneNumber(contact.phone)}\n`;
        if (contact.relation) {
          cardText += `   (${contact.relation})\n`;
        }
      });
    }
    
    cardText += `\nQR KOD VERİSİ:\n${JSON.stringify(qrData, null, 2)}\n\n`;
    cardText += `Bu kart AfetNet uygulaması ile oluşturulmuştur.`;
    
    return cardText;
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Acil Durum Kartı (QR)</Text>

      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <Text style={styles.appName}>AFETNET</Text>
          <Text style={styles.cardTitle}>Acil Durum Kartı</Text>
        </View>

        <View style={styles.qrContainer}>
          <QRCode
            value={JSON.stringify(generateQRContent())}
            size={120}
            color="#000000"
            backgroundColor="#ffffff"
          />
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ad:</Text>
            <Text style={styles.infoValue}>{userProfile.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kan Grubu:</Text>
            <Text style={styles.infoValue}>{userProfile.bloodType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alerjiler:</Text>
            <Text style={styles.infoValue}>{userProfile.allergies}</Text>
          </View>
        </View>

        {currentPos && (
          <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>Son Konum</Text>
            <Text style={styles.locationText}>
              {currentPos.lat.toFixed(6)}, {currentPos.lon.toFixed(6)}
            </Text>
          </View>
        )}

        {contacts.length > 0 && (
          <View style={styles.iceSection}>
            <Text style={styles.sectionTitle}>Acil İletişim (ICE)</Text>
            {contacts.slice(0, 3).map((contact, index) => (
              <View key={contact.id} style={styles.iceContact}>
                <Text style={styles.iceName}>
                  {index + 1}. {contact.name}
                </Text>
                <Text style={styles.icePhone}>
                  {maskPhoneNumber(contact.phone)}
                </Text>
                {contact.relation && (
                  <Text style={styles.iceRelation}>
                    ({contact.relation})
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.timestampSection}>
          <Text style={styles.timestamp}>
            {new Date().toLocaleString('tr-TR')}
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={handleSavePNG}
          style={[styles.actionButton, styles.saveButton]}
          disabled={generating}
        >
          <Text style={styles.actionButtonText}>
            {generating ? 'Kaydediliyor...' : 'PNG olarak kaydet'}
          </Text>
        </Pressable>

        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={() => handleShare()}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Paylaş</Text>
        </Pressable>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Kullanım Bilgisi:</Text>
        <Text style={styles.infoText}>
          • Bu kart acil durumlarda kurtarma ekiplerine verilebilir{'\n'}
          • QR kod taranarak detaylı bilgilere ulaşılabilir{'\n'}
          • Kartı PNG olarak kaydedebilir veya paylaşabilirsiniz{'\n'}
          • Kişisel bilgilerinizi güncellemek için Profil ayarlarını kullanın
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    margin: 16,
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  cardTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileSection: {
    width: '100%',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    color: '#000000',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  locationSection: {
    width: '100%',
    marginBottom: 16,
  },
  locationText: {
    color: '#000000',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  iceSection: {
    width: '100%',
    marginBottom: 16,
  },
  iceContact: {
    marginBottom: 8,
  },
  iceName: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  icePhone: {
    color: '#6b7280',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  iceRelation: {
    color: '#9ca3af',
    fontSize: 10,
    fontStyle: 'italic',
  },
  timestampSection: {
    width: '100%',
    alignItems: 'center',
  },
  timestamp: {
    color: '#6b7280',
    fontSize: 10,
    fontStyle: 'italic',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    margin: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  saveButton: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#111827',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  infoTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
});
