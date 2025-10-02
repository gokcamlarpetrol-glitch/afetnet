import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';

import { colors } from '@/app/theme/colors';
import { spacing } from '@/app/theme/spacing';
import { textStyles } from '@/app/theme/typography';
import { Button } from '@/app/components/Button';
import { Card } from '@/app/components/Card';
import { P2PManager } from '@/core/p2p';
import { TriageCalculator } from '@/core/logic/triage';
import { HelpRequestRepository } from '@/core/data/repositories';

export function HelpRequestModal() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  
  // Form state
  const [underRubble, setUnderRubble] = useState(false);
  const [injured, setInjured] = useState(false);
  const [peopleCount, setPeopleCount] = useState(1);
  const [note, setNote] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getCurrentLocation();
    getBatteryLevel();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Konum izni gerekli');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Hata', 'Konum bilgisi alınamadı');
    }
  };

  const getBatteryLevel = async () => {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      setBatteryLevel(Math.round(batteryLevel * 100));
    } catch (error) {
      console.error('Battery error:', error);
    }
  };

  const calculatePriority = (): 0 | 1 | 2 => {
    const triageCalculator = TriageCalculator.getInstance();
    const factors = {
      injured,
      underRubble,
      batteryLevel,
      repeatRequest: false,
      nearbyVolunteers: false,
      timeSinceFirstRequest: 0,
      peopleCount,
    };
    
    const result = triageCalculator.calculatePriority(factors);
    return result.priority;
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert('Hata', 'Konum bilgisi gerekli');
      return;
    }

    setIsLoading(true);
    try {
      const priority = calculatePriority();
      
      // Save to local database
      await HelpRequestRepository.create({
        ts: Date.now(),
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy,
        priority,
        underRubble,
        injured,
        peopleCount,
        note,
        battery: batteryLevel,
        anonymity: anonymous,
        ttl: 24,
        signature: '', // Will be filled by P2P layer
        delivered: false,
        hops: 0,
        source: 'self',
      });

      // Send via P2P
      await P2PManager.getInstance().sendHelpRequest(
        priority,
        underRubble,
        injured,
        peopleCount,
        note,
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        }
      );

      Alert.alert('Başarılı', 'Yardım talebi gönderildi', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Hata', 'Yardım talebi gönderilemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Durum Bilgileri</Text>
      
      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('help.underRubble')}</Text>
          <Switch
            value={underRubble}
            onValueChange={setUnderRubble}
            trackColor={{ false: colors.border.primary, true: colors.status.critical }}
            thumbColor={underRubble ? colors.text.primary : colors.text.tertiary}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('help.injured')}</Text>
          <Switch
            value={injured}
            onValueChange={setInjured}
            trackColor={{ false: colors.border.primary, true: colors.status.critical }}
            thumbColor={injured ? colors.text.primary : colors.text.tertiary}
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>{t('help.peopleCount')}</Text>
          <TextInput
            style={styles.numberInput}
            value={peopleCount.toString()}
            onChangeText={(text) => setPeopleCount(parseInt(text) || 1)}
            keyboardType="numeric"
            maxLength={2}
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>{t('help.note')}</Text>
          <TextInput
            style={styles.textInput}
            value={note}
            onChangeText={setNote}
            placeholder="Kısa bir not yazın..."
            placeholderTextColor={colors.text.quaternary}
            multiline
            maxLength={200}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('help.anonymous')}</Text>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ false: colors.border.primary, true: colors.interactive.primary }}
            thumbColor={anonymous ? colors.text.primary : colors.text.tertiary}
          />
        </View>
      </Card>

      <Button
        title={t('common.next')}
        onPress={handleNext}
        style={styles.button}
      />
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Konum Onayı</Text>
      
      <Card style={styles.card}>
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={20} color={colors.interactive.primary} />
          <Text style={styles.locationText}>
            Enlem: {location?.coords.latitude.toFixed(6)}
          </Text>
        </View>
        
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={20} color={colors.interactive.primary} />
          <Text style={styles.locationText}>
            Boylam: {location?.coords.longitude.toFixed(6)}
          </Text>
        </View>
        
        <View style={styles.locationInfo}>
          <Ionicons name="speedometer" size={20} color={colors.text.secondary} />
          <Text style={styles.locationText}>
            Doğruluk: ±{location?.coords.accuracy?.toFixed(0)}m
          </Text>
        </View>

        <View style={styles.priorityInfo}>
          <Text style={styles.priorityLabel}>Tahmini Öncelik:</Text>
          <Text style={[
            styles.priorityText,
            { color: colors.priority[calculatePriority() === 0 ? 'critical' : calculatePriority() === 1 ? 'high' : 'normal'] }
          ]}>
            {calculatePriority() === 0 ? t('help.critical') : 
             calculatePriority() === 1 ? t('help.high') : t('help.normal')}
          </Text>
        </View>
      </Card>

      <View style={styles.buttonRow}>
        <Button
          title={t('common.back')}
          onPress={handleBack}
          variant="secondary"
          style={[styles.button, { flex: 1, marginRight: spacing.xs }]}
        />
        <Button
          title={t('help.send')}
          onPress={handleSubmit}
          loading={isLoading}
          style={[styles.button, { flex: 1, marginLeft: spacing.xs }]}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {step === 1 ? renderStep1() : renderStep2()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  stepTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  switchLabel: {
    ...textStyles.body,
    color: colors.text.primary,
    flex: 1,
  },
  inputRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  inputLabel: {
    ...textStyles.label,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  numberInput: {
    ...textStyles.body,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.primary,
    textAlign: 'center',
    width: 60,
  },
  textInput: {
    ...textStyles.body,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  locationText: {
    ...textStyles.body,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  priorityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  priorityLabel: {
    ...textStyles.label,
    color: colors.text.primary,
  },
  priorityText: {
    ...textStyles.labelLarge,
    fontWeight: '600',
  },
  button: {
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});