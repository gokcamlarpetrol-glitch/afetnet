import React, { useState, useEffect } from 'react';
import { logger } from '../utils/productionLogger';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useTraining, TrainingScenario } from '../store/training';
import { useIncidents } from '../store/incidents';
import { usePDRFuse } from '../hooks/usePDRFuse';
import { logEvent } from '../store/devlog';

export default function Training() {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { 
    enabled, 
    scenario, 
    count, 
    activeIncidents,
    setEnabled, 
    setScenario, 
    setCount,
    clearActiveIncidents 
  } = useTraining();
  
  const { upsertFromSOS, removeIncident } = useIncidents();
  const { currentPos } = usePDRFuse();

  const generateSyntheticSOS = () => {
    if (!currentPos) {
      Alert.alert('Hata', 'Konum bilgisi gerekli');
      return;
    }

    setIsGenerating(true);

    try {
      // Clear existing training incidents
      activeIncidents.forEach(id => {
        removeIncident(id);
      });
      clearActiveIncidents();

      // Generate synthetic incidents based on scenario
      const incidents: Array<{ id: string; lat: number; lon: number; statuses: string[]; ts: number }> = [];
      
      switch (scenario) {
        case 'single':
          incidents.push(generateSingleIncident(currentPos));
          break;
          
        case 'multi':
          for (let i = 0; i < count; i++) {
            incidents.push(generateMultiIncident(currentPos, i));
          }
          break;
          
        case 'triangulate':
          for (let i = 0; i < Math.min(count, 3); i++) {
            incidents.push(generateTriangulateIncident(currentPos, i));
          }
          break;
      }

      // Add incidents to store
      incidents.forEach(incident => {
        upsertFromSOS(incident);
        useTraining.getState().addActiveIncident(incident.id);
        logEvent('TRAINING', `Generated synthetic incident: ${incident.id}`);
      });

      Alert.alert(
        'Eğitim Verisi Oluşturuldu',
        `${incidents.length} sahte SOS olayı oluşturuldu`
      );

    } catch (error) {
      logger.error('Failed to generate training data:', error);
      Alert.alert('Hata', 'Eğitim verisi oluşturulamadı');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSingleIncident = (pos: { lat: number; lon: number }) => {
    const id = `training_single_${Date.now()}`;
    return {
      id,
      lat: pos.lat + (Math.random() - 0.5) * 0.001, // ~50m radius
      lon: pos.lon + (Math.random() - 0.5) * 0.001,
      statuses: ['Yaralı Var', 'Kat: -1'],
      ts: Date.now()
    };
  };

  const generateMultiIncident = (pos: { lat: number; lon: number }, index: number) => {
    const id = `training_multi_${Date.now()}_${index}`;
    const angle = (index / count) * 2 * Math.PI;
    const distance = 0.002 + Math.random() * 0.003; // 200-500m
    
    const lat = pos.lat + distance * Math.cos(angle);
    const lon = pos.lon + distance * Math.sin(angle);
    
    const statusOptions = [
      ['2 Kişiyiz'],
      ['Yaralı Var'],
      ['Kat: -1'],
      ['Acil Nefes Darlığı'],
      ['Sesimi Duyuyorsanız']
    ];
    
    return {
      id,
      lat,
      lon,
      statuses: statusOptions[Math.floor(Math.random() * statusOptions.length)],
      ts: Date.now()
    };
  };

  const generateTriangulateIncident = (pos: { lat: number; lon: number }, index: number) => {
    const id = `training_triangulate_${Date.now()}_${index}`;
    
    // Create incidents in a triangle pattern for triangulation testing
    const trianglePoints = [
      { lat: pos.lat + 0.002, lon: pos.lon }, // North
      { lat: pos.lat - 0.001, lon: pos.lon + 0.0017 }, // Southeast
      { lat: pos.lat - 0.001, lon: pos.lon - 0.0017 } // Southwest
    ];
    
    const point = trianglePoints[index % trianglePoints.length];
    
    return {
      id,
      lat: point.lat + (Math.random() - 0.5) * 0.0005, // Small random offset
      lon: point.lon + (Math.random() - 0.5) * 0.0005,
      statuses: ['Triangulation Test'],
      ts: Date.now()
    };
  };

  const handleStartTraining = () => {
    if (!enabled) {
      setEnabled(true);
      generateSyntheticSOS();
    } else {
      Alert.alert(
        'Eğitim Modu Zaten Aktif',
        'Yeni veri oluşturmak için önce mevcut verileri temizleyin'
      );
    }
  };

  const handleClearTraining = () => {
    Alert.alert(
      'Eğitim Verilerini Temizle',
      'Tüm sahte olaylar silinecek. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: () => {
            activeIncidents.forEach(id => {
              removeIncident(id);
            });
            clearActiveIncidents();
            setEnabled(false);
            logEvent('TRAINING', 'Training data cleared');
            Alert.alert('Temizlendi', 'Eğitim verileri silindi');
          }
        }
      ]
    );
  };

  const getScenarioDescription = (scenario: TrainingScenario): string => {
    switch (scenario) {
      case 'single':
        return 'Tek olay testi - yakın mesafede bir SOS';
      case 'multi':
        return `Çoklu olay testi - ${count} farklı konumda SOS`;
      case 'triangulate':
        return 'Triangulation testi - üçgen düzeninde konumlandırma';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      {enabled && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>🎓 EĞİTİM MODU AKTİF</Text>
        </View>
      )}

      <Text style={styles.title}>Eğitim Modu</Text>
      <Text style={styles.subtitle}>
        Sahte SOS olayları oluşturarak sistem testi yapın
      </Text>

      {/* Scenario Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Senaryo Seçimi</Text>
        {(['single', 'multi', 'triangulate'] as TrainingScenario[]).map((scenarioOption) => (
          <Pressable accessible={true}
          accessibilityRole="button"
            key={scenarioOption}
            onPress={() => setScenario(scenarioOption)}
            style={[
              styles.scenarioButton,
              scenario === scenarioOption && styles.scenarioButtonActive
            ]}
          >
            <Text style={[
              styles.scenarioButtonText,
              scenario === scenarioOption && styles.scenarioButtonTextActive
            ]}>
              {scenarioOption === 'single' && 'Tek Olay'}
              {scenarioOption === 'multi' && 'Çoklu Olay'}
              {scenarioOption === 'triangulate' && 'Triangulation'}
            </Text>
          </Pressable>
        ))}
        
        <Text style={styles.scenarioDescription}>
          {getScenarioDescription(scenario)}
        </Text>
      </View>

      {/* Count Selection (for multi scenario) */}
      {scenario === 'multi' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Olay Sayısı: {count}</Text>
          <View style={styles.countControls}>
            <Pressable accessible={true}
          accessibilityRole="button"
              onPress={() => setCount(Math.max(1, count - 1))}
              style={styles.countButton}
            >
              <Text style={styles.countButtonText}>-</Text>
            </Pressable>
            <Text style={styles.countText}>{count}</Text>
            <Pressable accessible={true}
          accessibilityRole="button"
              onPress={() => setCount(Math.min(10, count + 1))}
              style={styles.countButton}
            >
              <Text style={styles.countButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Durum</Text>
        <Text style={styles.statusText}>
          {enabled 
            ? `Aktif - ${activeIncidents.length} sahte olay`
            : 'Pasif'
          }
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {!enabled ? (
          <Pressable accessible={true}
          accessibilityRole="button"
            onPress={handleStartTraining}
            disabled={isGenerating}
            style={[
              styles.startButton,
              isGenerating && styles.startButtonDisabled
            ]}
          >
            <Text style={styles.startButtonText}>
              {isGenerating ? 'Oluşturuluyor...' : 'Başlat'}
            </Text>
          </Pressable>
        ) : (
          <Pressable accessible={true}
          accessibilityRole="button"
            onPress={handleClearTraining}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Temizle</Text>
          </Pressable>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Nasıl Kullanılır:</Text>
        <Text style={styles.infoText}>• Senaryo seçin ve "Başlat"a basın</Text>
        <Text style={styles.infoText}>• Sahte SOS olayları Incident Board'da görünür</Text>
        <Text style={styles.infoText}>• Mission ekranında triangulation testi yapın</Text>
        <Text style={styles.infoText}>• Gerçek BLE sinyali gönderilmez</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  banner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
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
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  scenarioButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  scenarioButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  scenarioButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  scenarioButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  scenarioDescription: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  countControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  countButton: {
    backgroundColor: '#3b82f6',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  countText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  actionContainer: {
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  infoContainer: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
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
    marginBottom: 4,
  },
});
