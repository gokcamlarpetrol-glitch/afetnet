import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, TextInput } from 'react-native';
import { useFamily } from '../store/family';
import { NavigationProp } from '../types/interfaces';

interface QRScannerProps {
  navigation?: NavigationProp;
}

export default function QRScanner({ navigation }: QRScannerProps) {
  const [scanned, setScanned] = useState(false);
  const [manualAfnId, setManualAfnId] = useState('');
  const { addByAfnId } = useFamily();

  const handleManualAdd = async () => {
    if (scanned || !manualAfnId.trim()) return;

    setScanned(true);

    try {
      const afnId = manualAfnId.trim();

      // AFN-ID formatını kontrol et
      if (!afnId || afnId.length < 10) {
        Alert.alert('Hata', 'Geçerli bir AFN-ID giriniz (en az 10 karakter)');
        setScanned(false);
        return;
      }

      // Aile üyesi ekle
      const success = await addByAfnId(afnId, 'Manuel Giriş');

      if (success) {
        Alert.alert('Başarılı', `Aile üyesi eklendi: ${afnId}`, [
          { text: 'Tamam', onPress: () => navigation?.goBack() }
        ]);
      } else {
        Alert.alert('Hata', 'Aile üyesi eklenemedi. AFN-ID geçersiz olabilir.');
        setScanned(false);
      }
    } catch (error) {
      Alert.alert('Hata', 'Aile üyesi eklenemedi');
      setScanned(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Aile Üyesi Ekle</Text>
        <Text style={styles.subtitle}>AFN-ID'yi manuel olarak girin</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>AFN-ID</Text>
        <TextInput
          style={styles.input}
          value={manualAfnId}
          onChangeText={setManualAfnId}
          placeholder="AFN-ID'yi giriniz..."
          placeholderTextColor="#94a3b8"
          editable={!scanned}
          maxLength={50}
        />

        <Text style={styles.helpText}>
          QR kod tarama geçici olarak devre dışı. AFN-ID'yi manuel olarak girebilirsiniz.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.addButton, (!manualAfnId.trim() || scanned) && styles.disabledButton]}
          onPress={handleManualAdd}
          disabled={!manualAfnId.trim() || scanned}
        >
          <Text style={styles.addButtonText}>Ekle</Text>
        </Pressable>

        <Pressable
          style={styles.cancelButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.cancelButtonText}>İptal</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    gap: 12,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#64748b',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

