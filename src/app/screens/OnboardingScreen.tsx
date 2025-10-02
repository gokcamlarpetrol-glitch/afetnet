import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PreferencesManager } from '../../core/storage/prefs';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  backgroundColor: string;
}

export const OnboardingScreen: React.FC<{
  onComplete: () => void;
}> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const preferencesManager = PreferencesManager.getInstance();

  const slides: OnboardingSlide[] = [
    {
      id: 1,
      title: t('onboarding.slide1.title'),
      subtitle: t('onboarding.slide1.subtitle'),
      description: t('onboarding.slide1.description'),
      image: '🌐',
      backgroundColor: '#1a1a1a',
    },
    {
      id: 2,
      title: t('onboarding.slide2.title'),
      subtitle: t('onboarding.slide2.subtitle'),
      description: t('onboarding.slide2.description'),
      image: '🆘',
      backgroundColor: '#2a1a1a',
    },
    {
      id: 3,
      title: t('onboarding.slide3.title'),
      subtitle: t('onboarding.slide3.subtitle'),
      description: t('onboarding.slide3.description'),
      image: '👨‍👩‍👧‍👦',
      backgroundColor: '#1a2a1a',
    },
    {
      id: 4,
      title: t('onboarding.slide4.title'),
      subtitle: t('onboarding.slide4.subtitle'),
      description: t('onboarding.slide4.description'),
      image: '⚠️',
      backgroundColor: '#2a2a1a',
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    await preferencesManager.setOnboardingCompleted();
    onComplete();
  };

  const currentSlideData = slides[currentSlide];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentSlideData.backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={currentSlideData.backgroundColor} />
      
      <View style={styles.content}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>{t('common.skip')}</Text>
        </TouchableOpacity>

        {/* Slide content */}
        <View style={styles.slideContainer}>
          <View style={styles.imageContainer}>
            <Text style={styles.imageEmoji}>{currentSlideData.image}</Text>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{currentSlideData.title}</Text>
            <Text style={styles.subtitle}>{currentSlideData.subtitle}</Text>
            <Text style={styles.description}>{currentSlideData.description}</Text>
            
            {/* EEW Disclaimer for final slide */}
            {currentSlide === slides.length - 1 && (
              <View style={styles.disclaimerContainer}>
                <Text style={styles.disclaimerTitle}>{t('onboarding.eew.disclaimer.title')}</Text>
                <Text style={styles.disclaimerText}>{t('onboarding.eew.disclaimer.text')}</Text>
                <Text style={styles.disclaimerNote}>{t('onboarding.eew.disclaimer.note')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom section */}
        <View style={styles.bottomContainer}>
          {/* Progress indicators */}
          <View style={styles.progressContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: index === currentSlide ? '#ffffff' : '#666666',
                  },
                ]}
              />
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            {currentSlide > 0 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setCurrentSlide(currentSlide - 1)}
              >
                <Text style={styles.backButtonText}>{t('common.back')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {currentSlide === slides.length - 1 ? t('common.getStarted') : t('common.next')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  skipText: {
    color: '#ffffff',
    fontSize: 16,
    opacity: 0.7,
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  imageEmoji: {
    fontSize: 80,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },
  bottomContainer: {
    paddingBottom: 32,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginLeft: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimerContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFC107',
    marginBottom: 8,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  disclaimerNote: {
    fontSize: 12,
    color: '#cccccc',
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.8,
  },
});
