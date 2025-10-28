/**
 * EARTHQUAKE WARNING MODAL
 * 
 * Full-screen warning UI with:
 * - Countdown timer
 * - Safety recommendations
 * - Quick action buttons
 * - Audio alerts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { earthquakeWarningService, WarningDisplayState } from '../services/EarthquakeWarningService';
import { logger } from '../utils/productionLogger';

export default function EarthquakeWarningModal() {
  const [warning, setWarning] = useState<WarningDisplayState | null>(null);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const flashAnim = new Animated.Value(0);
  const pulseAnim = new Animated.Value(1);
  
  useEffect(() => {
    // Check for active warning
    const checkWarning = () => {
      const current = earthquakeWarningService.getCurrentWarning();
      if (current && current.isActive) {
        setWarning(current);
        setVisible(true);
        setCountdown(current.secondsRemaining);
        
        // Start visual alerts
        startFlashAnimation();
        startPulseAnimation();
      } else if (!current && visible) {
        setVisible(false);
        setWarning(null);
      }
    };
    
    const interval = setInterval(checkWarning, 1000);
    return () => clearInterval(interval);
  }, [visible]);
  
  useEffect(() => {
    if (warning && warning.isActive) {
      setCountdown(warning.secondsRemaining);
    }
  }, [warning]);
  
  const startFlashAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  if (!warning || !visible) {
    return null;
  }
  
  const backgroundColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(220, 38, 38, 0.95)', 'rgba(153, 27, 27, 1)'], // Dark red to darker red
  });
  
  const actionColors = {
    drop: '#FF6B6B',
    cover: '#FFA500',
    hold: '#FFD700',
    evacuate: '#90EE90',
  };
  
  const actionNames = {
    drop: 'Yere Düşün',
    cover: 'Sağlam Bir Şeyin Altına Girin',
    hold: 'Sağlam Bir Yapıya Tutunun',
    evacuate: 'Güvenli Açık Alan Tara',
  };
  
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={() => {}}
    >
      <Animated.View style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>🚨 DEPREM UYARISI 🚨</Text>
        </View>
        
        {/* Countdown Display */}
        <Animated.View style={[styles.countdownContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.countdownTime}>
            {countdown}
          </Text>
          <Text style={styles.countdownLabel}>saniye</Text>
        </Animated.View>
        
        {/* Event Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.magnitudeText}>Şiddet: M{warning.magnitude.toFixed(1)}</Text>
          <Text style={styles.regionText}>{warning.region}</Text>
          <Text style={styles.intensityText}>
            Tahmini Sarsıntı: {warning.intensity}/12 (MMI)
          </Text>
        </View>
        
        {/* Recommended Action */}
        <View style={styles.actionContainer}>
          <Text style={styles.actionTitle}>YAPMANIZ GEREKEN:</Text>
          <Text style={[styles.actionText, { color: actionColors[warning.action] }]}>
            {actionNames[warning.action]}
          </Text>
        </View>
        
        {/* Safety Steps */}
        <View style={styles.stepsContainer}>
          {warning.recommendedSteps.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <Text style={styles.stepNumber}>{index + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        
        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.sosButton]}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              logger.warn('🚨 SOS Button pressed during earthquake warning');
              // TODO: Trigger SOS
            }}
          >
            <Text style={styles.buttonText}>🚨 ACİL YARDIM 🚨</Text>
          </Pressable>
          
          <Pressable
            style={[styles.button, styles.dismissButton]}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              earthquakeWarningService.dismissWarning();
              setVisible(false);
            }}
          >
            <Text style={styles.buttonText}>Bildirimi Kapat</Text>
          </Pressable>
        </View>
        
        {/* Critical message at bottom */}
        <Text style={styles.criticalMessage}>
          ⚡ DİKKAT: Sarsıntı olmaya başladıysa YERE ÇÖMEL, KORUN, TUTUN! ⚡
        </Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  countdownTime: {
    fontSize: 120,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  countdownLabel: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  magnitudeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  regionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 8,
  },
  intensityText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 4,
  },
  actionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 30,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginRight: 8,
    minWidth: 24,
  },
  stepText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  sosButton: {
    backgroundColor: '#FFFFFF',
  },
  dismissButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  criticalMessage: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

