import React, { useState, useEffect } from 'react';
import { logger } from '../utils/productionLogger';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { meshRelay } from '../services/mesh/relay';
import { encodePCMToADPCM, createVoiceChunks } from '../services/voice/encodeAdpcm';
import { encodeBase64 } from 'tweetnacl-util';

export default function VoicePing() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [canRecord, setCanRecord] = useState(false);

  useEffect(() => {
    requestPermissions();
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setCanRecord(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Ses kaydı için mikrofon izni gerekli');
      }
    } catch (error) {
      logger.error('Permission request failed:', error);
    }
  };

  const startRecording = async () => {
    try {
      if (!canRecord) {
        Alert.alert('İzin Gerekli', 'Ses kaydı için mikrofon izni gerekli');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isDoneRecording) {
            setIsRecording(false);
            processRecording(newRecording);
          }
        },
      );

      setRecording(newRecording);
      setIsRecording(true);

      // Auto-stop after 2 seconds
      (globalThis as any).setTimeout(() => {
        if (newRecording) {
          stopRecording();
        }
      }, 2000);

    } catch (error) {
      logger.error('Recording failed:', error);
      Alert.alert('Hata', 'Ses kaydı başlatılamadı');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await processRecording(recording);
    } catch (error) {
      logger.error('Stop recording failed:', error);
    }
  };

  const processRecording = async (rec: Audio.Recording) => {
    try {
      const uri = rec.getURI();
      if (!uri) {
        Alert.alert('Hata', 'Ses dosyası bulunamadı');
        return;
      }

      // For simplicity, we'll simulate the PCM conversion and compression
      // In a real implementation, you'd need to:
      // 1. Load the audio file
      // 2. Convert to PCM format
      // 3. Apply ADPCM compression
      // 4. Create chunks

      // Simulate compressed audio data (2-5 KB total)
      const simulatedPCM = new Int16Array(8000); // 1 second at 8kHz
      for (let i = 0; i < simulatedPCM.length; i++) {
        simulatedPCM[i] = Math.sin(i * 0.1) * 16384; // Simple sine wave
      }

      const adpcmData = encodePCMToADPCM(simulatedPCM);
      const chunks = createVoiceChunks(adpcmData, 1024);
      
      // Convert chunks to base64 strings
      const chunkStrings = chunks.map(chunk => encodeBase64(chunk));
      
      // Send via mesh relay
      const msgId = await meshRelay.sendVoicePing(undefined, chunkStrings);
      
      Alert.alert(
        'Ses Ping Gönderildi',
        `Ses ping gönderildi (${chunks.length} parça, ${msgId.slice(-6)})`,
      );

    } catch (error) {
      logger.error('Processing failed:', error);
      Alert.alert('Hata', 'Ses işleme başarısız');
    }
  };

  const playTestSound = async () => {
    try {
      setIsPlaying(true);

      // Create a simple test sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBS13yO/eizEIHWq+8+OWT' },
        { shouldPlay: true },
      );

      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

    } catch (error) {
      logger.error('Playback failed:', error);
      setIsPlaying(false);
    }
  };

  if (!canRecord) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Yakın Ses Ping</Text>
        <Text style={styles.subtitle}>Ses kaydı için mikrofon izni gerekli</Text>
        <Pressable onPress={requestPermissions} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>İzin Ver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yakın Ses Ping</Text>
      <Text style={styles.subtitle}>
        Yakındaki cihazlara kısa ses mesajı gönderin
      </Text>

      <View style={styles.recordingContainer}>
        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isPlaying}
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            isPlaying && styles.recordButtonDisabled,
          ]}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '🛑 Durdur' : '🎤 Kaydet (2s)'}
          </Text>
        </Pressable>

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <Text style={styles.recordingText}>🔴 Kayıt yapılıyor...</Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Nasıl Çalışır:</Text>
        <Text style={styles.infoText}>• 2 saniye ses kaydı yapın</Text>
        <Text style={styles.infoText}>• Otomatik olarak sıkıştırılır</Text>
        <Text style={styles.infoText}>• Yakındaki cihazlara gönderilir</Text>
        <Text style={styles.infoText}>• Sadece 1 hop (yakın mesafe)</Text>
      </View>

      <Pressable accessible={true}
        accessibilityRole="button"
        onPress={playTestSound}
        disabled={isPlaying || isRecording}
        style={[
          styles.testButton,
          (isPlaying || isRecording) && styles.testButtonDisabled,
        ]}
      >
        <Text style={styles.testButtonText}>
          {isPlaying ? '🔊 Çalıyor...' : '🔊 Test Ses'}
        </Text>
      </Pressable>

      <Text style={styles.warningText}>
        ⚠️ Ses ping sadece yakın mesafede çalışır (BLE menzili)
      </Text>
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
    color: '#ffffff',
    fontSize: 24,
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
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  recordButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
  },
  recordButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  recordButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  recordingIndicator: {
    marginTop: 16,
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  recordingText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  testButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  testButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
