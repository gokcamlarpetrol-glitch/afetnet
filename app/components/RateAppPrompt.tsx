import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface RateAppPromptProps {
  visible: boolean;
  onDismiss: () => void;
}

const RATE_APP_STORAGE_KEY = 'rate_app_prompt';
const SUCCESSFUL_SESSIONS_KEY = 'successful_sessions';
const RATE_APP_THRESHOLD = 3; // Show after 3 successful sessions

export const RateAppPrompt: React.FC<RateAppPromptProps> = ({ visible, onDismiss }) => {
  const { t } = useTranslation();
  const [hasRated, setHasRated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkRateAppStatus();
  }, []);

  const checkRateAppStatus = async () => {
    try {
      const rated = await AsyncStorage.getItem(RATE_APP_STORAGE_KEY);
      if (rated === 'true') {
        setHasRated(true);
      }
    } catch (error) {
      console.error('Error checking rate app status:', error);
    }
  };

  const handleRateApp = async () => {
    setIsLoading(true);
    try {
      // Mark as rated
      await AsyncStorage.setItem(RATE_APP_STORAGE_KEY, 'true');
      setHasRated(true);
      
      // Open app store
      const storeUrl = Platform.OS === 'ios' 
        ? 'https://apps.apple.com/app/afetnet/id[APP_ID]'
        : 'https://play.google.com/store/apps/details?id=org.afetnet.app';
      
      await Linking.openURL(storeUrl);
      onDismiss();
    } catch (error) {
      console.error('Error opening app store:', error);
      Alert.alert(
        t('rateApp.error.title'),
        t('rateApp.error.message')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLater = () => {
    onDismiss();
  };

  const handleNever = async () => {
    try {
      await AsyncStorage.setItem(RATE_APP_STORAGE_KEY, 'never');
      onDismiss();
    } catch (error) {
      console.error('Error setting never rate:', error);
    }
  };

  if (!visible || hasRated) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="star" size={32} color="#FFD700" />
          <Text style={styles.title}>{t('rateApp.title')}</Text>
        </View>
        
        <Text style={styles.message}>{t('rateApp.message')}</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleRateApp}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? t('rateApp.loading') : t('rateApp.rate')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleLater}
          >
            <Text style={styles.secondaryButtonText}>
              {t('rateApp.later')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={handleNever}
          >
            <Text style={styles.tertiaryButtonText}>
              {t('rateApp.never')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Utility functions for tracking successful sessions
export const trackSuccessfulSession = async (): Promise<void> => {
  try {
    const current = await AsyncStorage.getItem(SUCCESSFUL_SESSIONS_KEY);
    const count = current ? parseInt(current, 10) + 1 : 1;
    await AsyncStorage.setItem(SUCCESSFUL_SESSIONS_KEY, count.toString());
    
    // Check if we should show rate app prompt
    const hasRated = await AsyncStorage.getItem(RATE_APP_STORAGE_KEY);
    if (!hasRated && count >= RATE_APP_THRESHOLD) {
      // This would trigger the rate app prompt in the parent component
      // You might want to use a global state manager or event emitter here
      console.log('Should show rate app prompt');
    }
  } catch (error) {
    console.error('Error tracking successful session:', error);
  }
};

export const shouldShowRateAppPrompt = async (): Promise<boolean> => {
  try {
    const hasRated = await AsyncStorage.getItem(RATE_APP_STORAGE_KEY);
    if (hasRated === 'true' || hasRated === 'never') {
      return false;
    }
    
    const sessions = await AsyncStorage.getItem(SUCCESSFUL_SESSIONS_KEY);
    const count = sessions ? parseInt(sessions, 10) : 0;
    
    return count >= RATE_APP_THRESHOLD;
  } catch (error) {
    console.error('Error checking rate app prompt:', error);
    return false;
  }
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 320,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#555555',
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  tertiaryButtonText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '400',
  },
});

export default RateAppPrompt;
