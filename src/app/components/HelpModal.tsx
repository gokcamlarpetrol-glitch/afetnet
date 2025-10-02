import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useI18n } from '../../hooks/useI18n';
import { Button } from './Button';
import { MessageEncoder } from '../../core/p2p/message';
import { MessageQueue } from '../../core/p2p/queue';
import { HelpRequestRepository } from '../../core/data/repositories';
import { TriageService } from '../../core/logic/triage';
import * as Location from 'expo-location';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ visible, onClose }) => {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    underRubble: false,
    injured: false,
    peopleCount: 1,
    note: '',
    anonymity: false,
  });
  const [location, setLocation] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async () => {
    if (step === 1) {
      // Request location permission and get current location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            t('error.title'),
            t('error.locationPermission')
          );
          return;
        }

        const locationResult = await Location.getCurrentPositionAsync({});
        setLocation({
          lat: locationResult.coords.latitude,
          lon: locationResult.coords.longitude,
          accuracy: locationResult.coords.accuracy || 0,
        });

        setStep(2);
      } catch (error) {
        console.error('Failed to get location:', error);
        Alert.alert(
          t('error.title'),
          t('error.location')
        );
      }
    } else if (step === 2) {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert(
        t('error.title'),
        t('error.location')
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Create help request message
      const helpMessage = MessageEncoder.createHelpRequest({
        id: `help_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        lat: location.lat,
        lon: location.lon,
        accuracy: location.accuracy,
        priority: 0, // Will be calculated by triage
        underRubble: formData.underRubble,
        injured: formData.injured,
        peopleCount: formData.peopleCount,
        note: formData.note,
        anonymity: formData.anonymity,
        ttl: 8, // 8 hours TTL
      });

      // Calculate priority using triage service
      const triageService = TriageService.getInstance();
      const priority = triageService.calculatePriority({
        injured: formData.injured,
        underRubble: formData.underRubble,
        lowBattery: false, // Would get from battery service
        repeatedCalls: 0,
        volunteerNearby: false,
        timeElapsed: 0,
        peopleCount: formData.peopleCount,
        locationAccuracy: location.accuracy,
      });

      helpMessage.prio = priority;

      // Save to database
      await HelpRequestRepository.create({
        ts: helpMessage.ts,
        lat: helpMessage.loc.lat,
        lon: helpMessage.loc.lon,
        accuracy: helpMessage.loc.acc,
        priority: helpMessage.prio,
        underRubble: helpMessage.flags.underRubble,
        injured: helpMessage.flags.injured,
        peopleCount: helpMessage.ppl,
        note: helpMessage.note,
        anonymity: helpMessage.flags.anonymity,
        ttl: helpMessage.ttl,
        signature: '', // Would be signed with device key
        delivered: false,
        hops: 0,
        source: 'self',
      });

      // Add to message queue for P2P broadcast
      const messageQueue = MessageQueue.getInstance();
      await messageQueue.enqueue(helpMessage, priority);

      Alert.alert(
        t('success.title'),
        t('help.requestSent'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              handleClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to submit help request:', error);
      Alert.alert(
        t('error.title'),
        t('error.submit')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFormData({
      underRubble: false,
      injured: false,
      peopleCount: 1,
      note: '',
      anonymity: false,
    });
    setLocation(null);
    setIsSubmitting(false);
    onClose();
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('help.step1.title')}</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('help.step1.underRubble')}</Text>
        <Switch
          value={formData.underRubble}
          onValueChange={(value) => setFormData({ ...formData, underRubble: value })}
          trackColor={{ false: '#333', true: '#FF3B30' }}
          thumbColor={formData.underRubble ? '#fff' : '#666'}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('help.step1.injured')}</Text>
        <Switch
          value={formData.injured}
          onValueChange={(value) => setFormData({ ...formData, injured: value })}
          trackColor={{ false: '#333', true: '#FF3B30' }}
          thumbColor={formData.injured ? '#fff' : '#666'}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('help.step1.peopleCount')}</Text>
        <TextInput
          style={styles.numberInput}
          value={formData.peopleCount.toString()}
          onChangeText={(text) => {
            const count = parseInt(text) || 1;
            setFormData({ ...formData, peopleCount: Math.max(1, Math.min(100, count)) });
          }}
          keyboardType="numeric"
          accessibilityLabel={t('help.step1.peopleCount')}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('help.step1.note')}</Text>
        <TextInput
          style={styles.textInput}
          value={formData.note}
          onChangeText={(text) => setFormData({ ...formData, note: text })}
          placeholder={t('help.step1.notePlaceholder')}
          placeholderTextColor="#666"
          multiline
          maxLength={200}
          accessibilityLabel={t('help.step1.note')}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('help.step1.anonymity')}</Text>
        <Switch
          value={formData.anonymity}
          onValueChange={(value) => setFormData({ ...formData, anonymity: value })}
          trackColor={{ false: '#333', true: '#007AFF' }}
          thumbColor={formData.anonymity ? '#fff' : '#666'}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('help.step2.title')}</Text>
      
      {location && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            {t('help.step2.location')}: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
          </Text>
          <Text style={styles.accuracyText}>
            {t('help.step2.accuracy')}: {Math.round(location.accuracy)}m
          </Text>
        </View>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{t('help.step2.summary')}</Text>
        
        {formData.underRubble && (
          <Text style={styles.summaryItem}>⚠️ {t('help.step1.underRubble')}</Text>
        )}
        {formData.injured && (
          <Text style={styles.summaryItem}>⚠️ {t('help.step1.injured')}</Text>
        )}
        <Text style={styles.summaryItem}>
          👥 {formData.peopleCount} {t('help.step1.peopleCount')}
        </Text>
        {formData.note && (
          <Text style={styles.summaryItem}>📝 {formData.note}</Text>
        )}
        {formData.anonymity && (
          <Text style={styles.summaryItem}>🔒 {t('help.step1.anonymity')}</Text>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('help.title')}</Text>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepIndicatorText}>
              {t('common.step')} {step}/2
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {step === 1 ? renderStep1() : renderStep2()}
        </View>

        <View style={styles.footer}>
          {step > 1 && (
            <Button
              title={t('common.back')}
              onPress={() => setStep(step - 1)}
              style={styles.backButton}
            />
          )}
          <Button
            title={step === 2 ? t('help.submit') : t('common.next')}
            onPress={handleNext}
            style={styles.nextButton}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  stepIndicator: {
    padding: 8,
  },
  stepIndicatorText: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  numberInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationInfo: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  locationText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  accuracyText: {
    fontSize: 14,
    color: '#666',
  },
  summary: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  summaryItem: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  backButton: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#333',
  },
  nextButton: {
    flex: 2,
  },
});
