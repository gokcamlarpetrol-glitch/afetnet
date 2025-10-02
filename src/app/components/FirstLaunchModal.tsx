import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  CheckBox,
  Platform,
} from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { useI18n } from '../../hooks/useI18n';
import { Preferences } from '../../core/storage/prefs';

interface FirstLaunchModalProps {
  visible: boolean;
  onComplete: () => void;
}

export const FirstLaunchModal: React.FC<FirstLaunchModalProps> = ({
  visible,
  onComplete,
}) => {
  const { t } = useI18n();
  const [eewAccepted, setEewAccepted] = useState(false);
  const [smsCostsAccepted, setSmsCostsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [allAccepted, setAllAccepted] = useState(false);

  React.useEffect(() => {
    const checkAllAccepted = eewAccepted && smsCostsAccepted && privacyAccepted;
    setAllAccepted(checkAllAccepted);
  }, [eewAccepted, smsCostsAccepted, privacyAccepted]);

  const handleComplete = async () => {
    if (!allAccepted) {
      return;
    }

    try {
      // Mark first launch as completed
      await Preferences.set('firstLaunchCompleted', true);
      await Preferences.set('firstLaunchDate', Date.now());
      
      // Store acceptance status
      await Preferences.set('eewAccepted', eewAccepted);
      await Preferences.set('smsCostsAccepted', smsCostsAccepted);
      await Preferences.set('privacyAccepted', privacyAccepted);

      onComplete();
    } catch (error) {
      console.error('Failed to save first launch preferences:', error);
      onComplete(); // Still proceed even if saving fails
    }
  };

  const renderCheckbox = (
    checked: boolean,
    onPress: () => void,
    label: string,
    description?: string
  ) => (
    <TouchableOpacity style={styles.checkboxRow} onPress={onPress}>
      <View style={styles.checkboxContainer}>
        {Platform.OS === 'ios' ? (
          <CheckBox
            value={checked}
            onValueChange={onPress}
            tintColors={{ true: '#007AFF', false: '#666' }}
          />
        ) : (
          <CheckBox
            value={checked}
            onValueChange={onPress}
            tintColors={{ true: '#007AFF', false: '#666' }}
          />
        )}
      </View>
      <View style={styles.checkboxContent}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        {description && (
          <Text style={styles.checkboxDescription}>{description}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{t('onboarding.welcome_title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.welcome_subtitle')}</Text>

          <Card style={styles.disclosureCard}>
            <Text style={styles.disclosureTitle}>{t('onboarding.disclosure_title')}</Text>
            
            <Text style={styles.disclosureText}>
              {t('onboarding.disclosure_text')}
            </Text>

            {renderCheckbox(
              eewAccepted,
              () => setEewAccepted(!eewAccepted),
              t('onboarding.eew_checkbox'),
              t('onboarding.eew_description')
            )}

            {renderCheckbox(
              smsCostsAccepted,
              () => setSmsCostsAccepted(!smsCostsAccepted),
              t('onboarding.sms_checkbox'),
              t('onboarding.sms_description')
            )}

            {renderCheckbox(
              privacyAccepted,
              () => setPrivacyAccepted(!privacyAccepted),
              t('onboarding.privacy_checkbox'),
              t('onboarding.privacy_description')
            )}
          </Card>

          <Card style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>{t('onboarding.features_title')}</Text>
            
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📡</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('onboarding.feature_p2p')}</Text>
                <Text style={styles.featureDescription}>{t('onboarding.feature_p2p_desc')}</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🚨</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('onboarding.feature_eew')}</Text>
                <Text style={styles.featureDescription}>{t('onboarding.feature_eew_desc')}</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🗺️</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('onboarding.feature_maps')}</Text>
                <Text style={styles.featureDescription}>{t('onboarding.feature_maps_desc')}</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👥</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('onboarding.feature_community')}</Text>
                <Text style={styles.featureDescription}>{t('onboarding.feature_community_desc')}</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.warningCard}>
            <Text style={styles.warningTitle}>{t('onboarding.warning_title')}</Text>
            <Text style={styles.warningText}>{t('onboarding.warning_text')}</Text>
            <Text style={styles.emergencyNumber}>{t('onboarding.emergency_number')}</Text>
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('onboarding.continue')}
            onPress={handleComplete}
            disabled={!allAccepted}
            style={styles.continueButton}
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  disclosureCard: {
    marginBottom: 20,
    backgroundColor: '#2a2a2a',
  },
  disclosureTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  disclosureText: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 18,
  },
  featuresCard: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 18,
  },
  warningCard: {
    backgroundColor: '#2d1b1b',
    borderColor: '#e74c3c',
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 12,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emergencyNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  continueButton: {
    marginTop: 0,
  },
});
