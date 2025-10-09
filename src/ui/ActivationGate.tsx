import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { loadActivation, saveActivation, defaultActivation, Activation } from '../store/activation';
import { setupDeepLinkListener } from '../lib/deeplink';

const DEPLOY_MODE: 'zero-touch' | 'keyed' | 'guided' = 'zero-touch';

interface ActivationGateProps {
  onReady: () => void;
}

export default function ActivationGate({ onReady }: ActivationGateProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeActivation = async () => {
      try {
        // Try to load existing activation
        const existing = await loadActivation();
        
        if (existing) {
          // Activation exists, proceed
          onReady();
          return;
        }

        // No existing activation
        if (DEPLOY_MODE === 'zero-touch') {
          // Auto-activate with default settings
          await saveActivation(defaultActivation());
          onReady();
          return;
        }

        if (DEPLOY_MODE === 'keyed') {
          // Check if secret is required
          const defaultAct = defaultActivation();
          await saveActivation(defaultAct);
          onReady();
          return;
        }

        if (DEPLOY_MODE === 'guided') {
          // Show activation screen with prefilled values
          const defaultAct = defaultActivation();
          setServerUrl(defaultAct.serverUrl);
          setSecret(defaultAct.secret || '');
        }
      } catch (error) {
        console.warn('Activation initialization failed:', error);
        // Fallback to zero-touch mode
        await saveActivation(defaultActivation());
        onReady();
      } finally {
        setIsLoading(false);
      }
    };

    initializeActivation();

    // Setup deep link listener for admin overrides
    const cleanup = setupDeepLinkListener(() => {
      // Reload activation when deep link is received
      initializeActivation();
    });

    return cleanup;
  }, [onReady]);

  const handleSave = async () => {
    try {
      const activation: Activation = {
        serverUrl: serverUrl.trim() || 'local://offline',
        secret: secret.trim() || undefined,
        createdAt: Date.now(),
      };

      await saveActivation(activation);
      onReady();
    } catch (error) {
      Alert.alert('Hata', 'Aktivasyon kaydedilemedi');
    }
  };

  const handleOfflineContinue = async () => {
    try {
      await saveActivation(defaultActivation());
      onReady();
    } catch (error) {
      Alert.alert('Hata', 'Varsayılan ayarlar kaydedilemedi');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>AfetNet</Text>
        <Text style={styles.subtitle}>Yükleniyor...</Text>
      </View>
    );
  }

  if (DEPLOY_MODE !== 'guided') {
    // Should not reach here in zero-touch or keyed mode
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AfetNet Aktivasyon</Text>
      <Text style={styles.subtitle}>Sunucu ayarlarını yapılandırın veya çevrimdışı devam edin</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Sunucu URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://sunucu.tld/afetnet"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Gizli Anahtar (opsiyonel)</Text>
        <TextInput
          style={styles.input}
          value={secret}
          onChangeText={setSecret}
          placeholder="sadece yöneticiniz verirse"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Kaydet</Text>
        </Pressable>

        <Pressable style={styles.offlineButton} onPress={handleOfflineContinue}>
          <Text style={styles.offlineButtonText}>Çevrimdışı Devam Et</Text>
        </Pressable>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          • Çevrimdışı mod tüm temel özellikleri kullanmanızı sağlar{'\n'}
          • Sunucu bağlantısı daha sonra QR kod ile eklenebilir{'\n'}
          • Yönetici ayarları için QR kod tarayın
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
    justifyContent: 'center',
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  label: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  offlineButton: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  offlineButtonText: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
});



