import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  Dimensions,
  Platform,
} from 'react-native';
import { useI18n } from '../../hooks/useI18n';
import { EEWClusterAlertEvent, EEWOfficialAlertEvent } from '../../../core/utils/events';

interface AlertSheetProps {
  visible: boolean;
  onClose: () => void;
  alertData: EEWClusterAlertEvent | EEWOfficialAlertEvent | null;
  isTestMode?: boolean;
}

export const AlertSheet: React.FC<AlertSheetProps> = ({
  visible,
  onClose,
  alertData,
  isTestMode = false,
}) => {
  const { t } = useI18n();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible && alertData) {
      // Start countdown timer
      const etaSeconds = 'etaSeconds' in alertData ? alertData.etaSeconds || 0 : 0;
      setTimeRemaining(etaSeconds);
      
      // Start pulsing animation
      startPulseAnimation();
      
      // Start shake animation
      startShakeAnimation();
      
      // Trigger haptic feedback
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      } else {
        Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);
      }
      
      // Start countdown timer
      startCountdownTimer(etaSeconds);
    } else {
      // Clean up animations and timers
      stopAnimations();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      stopAnimations();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, alertData]);

  const startPulseAnimation = () => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
  };

  const startShakeAnimation = () => {
    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ])
    );
    shake.start();
  };

  const stopAnimations = () => {
    pulseAnim.stopAnimation();
    shakeAnim.stopAnimation();
    pulseAnim.setValue(1);
    shakeAnim.setValue(0);
  };

  const startCountdownTimer = (initialSeconds: number) => {
    let seconds = initialSeconds;
    
    timerRef.current = setInterval(() => {
      seconds -= 1;
      setTimeRemaining(Math.max(0, seconds));
      
      if (seconds <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        // Auto-close after countdown reaches 0
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    }, 1000);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      // Stop haptic feedback when muted
      Vibration.cancel();
    }
  };

  const handleClose = () => {
    stopAnimations();
    Vibration.cancel();
    onClose();
  };

  const getAlertType = () => {
    if (!alertData) return 'unknown';
    if ('magnitude' in alertData) return 'official';
    return 'cluster';
  };

  const getAlertTitle = () => {
    if (isTestMode) {
      return t('eew.test_alert_title');
    }
    return t('eew.alert_title');
  };

  const getAlertSource = () => {
    if (!alertData) return '';
    if ('magnitude' in alertData) {
      return `${alertData.source} - ${t('eew.magnitude')}: ${alertData.magnitude.toFixed(1)}`;
    }
    return `${t('eew.devices_detected')}: ${alertData.deviceCount}`;
  };

  const getTimeRemainingText = () => {
    if (timeRemaining <= 0) {
      return t('eew.arriving_now');
    }
    return `${timeRemaining} ${t('eew.seconds')}`;
  };

  const getInstructions = () => {
    return [
      t('eew.instruction_1'),
      t('eew.instruction_2'),
      t('eew.instruction_3'),
    ];
  };

  if (!visible || !alertData) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header with alert title */}
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.titleContainer,
              {
                transform: [
                  { scale: pulseAnim },
                  { translateX: shakeAnim },
                ],
              },
            ]}
          >
            <Text style={styles.title}>{getAlertTitle()}</Text>
            <Text style={styles.subtitle}>{getAlertSource()}</Text>
          </Animated.View>
        </View>

        {/* Timer section */}
        <View style={styles.timerSection}>
          <Text style={styles.timerLabel}>{t('eew.estimated_arrival')}</Text>
          <Text style={styles.timerText}>{getTimeRemainingText()}</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>{t('eew.what_to_do')}</Text>
          {getInstructions().map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>{index + 1}</Text>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.button, styles.muteButton]}
            onPress={handleMuteToggle}
          >
            <Text style={styles.buttonText}>
              {isMuted ? t('eew.unmute') : t('eew.mute')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.closeButton]}
            onPress={handleClose}
          >
            <Text style={styles.buttonText}>{t('eew.close')}</Text>
          </TouchableOpacity>
        </View>

        {/* Warning text */}
        <View style={styles.warningSection}>
          <Text style={styles.warningText}>
            {isTestMode ? t('eew.test_warning') : t('eew.real_warning')}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF0000',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginHorizontal: 20,
    borderRadius: 15,
    marginBottom: 30,
  },
  timerLabel: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 10,
    fontWeight: '600',
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  instructionsSection: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  instructionsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
  },
  instructionNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 35,
    height: 35,
    textAlign: 'center',
    borderRadius: 17.5,
    lineHeight: 35,
  },
  instructionText: {
    flex: 1,
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 24,
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  muteButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  warningSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
