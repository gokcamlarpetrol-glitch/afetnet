/**
 * PREPAREDNESS QUIZ SCREEN
 * First-time onboarding quiz to assess user's disaster preparedness
 * Provides personalized score and recommendations
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PreparednessQuizScreen');

interface Question {
  id: string;
  text: string;
  type: 'yes_no' | 'rating' | 'multiple_choice';
  options?: string[];
  weight: number; // 1-5, importance weight
}

interface QuizResult {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  recommendations: string[];
  missingItems: string[];
  nextSteps: string[];
}

const QUESTIONS: Question[] = [
  {
    id: 'emergency_bag',
    text: 'Acil durum çantanız hazır mı?',
    type: 'yes_no',
    weight: 5,
  },
  {
    id: 'family_plan',
    text: 'Aile afet planınız var mı?',
    type: 'yes_no',
    weight: 5,
  },
  {
    id: 'assembly_point',
    text: 'Toplanma noktanızı biliyor musunuz?',
    type: 'yes_no',
    weight: 4,
  },
  {
    id: 'emergency_contacts',
    text: 'Acil durum numaralarınız kayıtlı mı?',
    type: 'yes_no',
    weight: 4,
  },
  {
    id: 'first_aid',
    text: 'İlk yardım bilginiz var mı?',
    type: 'rating',
    options: ['Hiç bilmiyorum', 'Temel bilgilerim var', 'Eğitim aldım', 'Uzmanım'],
    weight: 3,
  },
  {
    id: 'home_safety',
    text: 'Evinizdeki mobilyalar sabitlendi mi?',
    type: 'yes_no',
    weight: 4,
  },
  {
    id: 'insurance',
    text: 'Deprem sigortanız var mı? (DASK)',
    type: 'yes_no',
    weight: 5,
  },
  {
    id: 'evacuation_route',
    text: 'Acil çıkış rotanızı biliyor musunuz?',
    type: 'yes_no',
    weight: 4,
  },
  {
    id: 'water_storage',
    text: 'Yeterli su stoğunuz var mı? (Kişi başı 4L/gün)',
    type: 'yes_no',
    weight: 3,
  },
  {
    id: 'communication_plan',
    text: 'Aile iletişim planınız var mı?',
    type: 'yes_no',
    weight: 4,
  },
];

export default function PreparednessQuizScreen({ navigation, onComplete }: any) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / QUESTIONS.length) * 100;

  const handleAnswer = (answer: any) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    // Move to next question
    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }, 300);
    } else {
      // Quiz complete
      const quizResult = calculateResult(newAnswers);
      setResult(quizResult);
      setShowResult(true);
    }
  };

  const calculateResult = (answers: Record<string, any>): QuizResult => {
    let totalScore = 0;
    let maxScore = 0;
    const missingItems: string[] = [];
    const recommendations: string[] = [];

    QUESTIONS.forEach((question) => {
      const answer = answers[question.id];
      maxScore += question.weight * 5; // Max 5 points per question

      let score = 0;
      
      if (question.type === 'yes_no') {
        if (answer === true) {
          score = question.weight * 5;
        } else {
          missingItems.push(question.text);
        }
      } else if (question.type === 'rating') {
        if (answer === 'Uzmanım') score = question.weight * 5;
        else if (answer === 'Eğitim aldım') score = question.weight * 4;
        else if (answer === 'Temel bilgilerim var') score = question.weight * 2;
        else {
          score = 0;
          missingItems.push(question.text);
        }
      }

      totalScore += score;
    });

    const percentage = Math.round((totalScore / maxScore) * 100);
    
    let level: QuizResult['level'];
    if (percentage >= 90) level = 'excellent';
    else if (percentage >= 70) level = 'good';
    else if (percentage >= 50) level = 'fair';
    else if (percentage >= 30) level = 'poor';
    else level = 'critical';

    // Generate recommendations
    if (missingItems.length > 0) {
      recommendations.push('Aşağıdaki eksikleri tamamlayın:');
      missingItems.forEach(item => {
        recommendations.push(`• ${item}`);
      });
    }

    // Specific recommendations based on missing items
    if (!answers.emergency_bag) {
      recommendations.push('Acil durum çantası hazırlayın: Su, yiyecek, ilk yardım, fener, pil, dökümanlar');
    }
    if (!answers.family_plan) {
      recommendations.push('Aile afet planı oluşturun: Toplanma noktası, iletişim yöntemleri, rolleri belirleyin');
    }
    if (!answers.insurance) {
      recommendations.push('Deprem sigortası (DASK) yaptırın: Zarar görmeniz durumunda maddi koruma sağlar');
    }
    if (!answers.home_safety) {
      recommendations.push('Mobilyaları duvara sabitleyin: Depremde devrilme riskini azaltır');
    }

    const nextSteps: string[] = [];
    if (level === 'critical' || level === 'poor') {
      nextSteps.push('1. Acil durum çantası hazırlayın (en önemli)');
      nextSteps.push('2. Aile ile afet planı konuşun');
      nextSteps.push('3. Toplanma noktası belirleyin');
    } else if (level === 'fair') {
      nextSteps.push('1. Eksikleri tamamlayın');
      nextSteps.push('2. Tatbikat yapın');
      nextSteps.push('3. İlk yardım eğitimi alın');
    } else {
      nextSteps.push('1. Planınızı düzenli olarak gözden geçirin');
      nextSteps.push('2. Çantayı 6 ayda bir kontrol edin');
      nextSteps.push('3. Komşularınızla koordinasyon yapın');
    }

    return {
      score: percentage,
      level,
      recommendations,
      missingItems,
      nextSteps,
    };
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete(result);
    }
    navigation.goBack();
  };

  if (showResult && result) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.resultContainer}>
          {/* Score Card */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.scoreCard}>
            <LinearGradient
              colors={[
                result.level === 'excellent' ? '#4CAF50' :
                result.level === 'good' ? '#8BC34A' :
                result.level === 'fair' ? '#FFC107' :
                result.level === 'poor' ? '#FF9800' : '#F44336',
                result.level === 'excellent' ? '#2E7D32' :
                result.level === 'good' ? '#689F38' :
                result.level === 'fair' ? '#F57C00' :
                result.level === 'poor' ? '#E65100' : '#C62828',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scoreGradient}
            >
              <Text style={styles.scoreValue}>{result.score}</Text>
              <Text style={styles.scoreLabel}>Hazırlık Puanı</Text>
              <Text style={styles.scoreLevel}>
                {result.level === 'excellent' ? 'Mükemmel' :
                 result.level === 'good' ? 'İyi' :
                 result.level === 'fair' ? 'Orta' :
                 result.level === 'poor' ? 'Yetersiz' : 'Kritik'}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200)} style={styles.recommendationsCard}>
              <Text style={styles.cardTitle}>Öneriler</Text>
              {result.recommendations.map((rec, index) => (
                <Text key={index} style={styles.recommendationText}>
                  {rec}
                </Text>
              ))}
            </Animated.View>
          )}

          {/* Next Steps */}
          {result.nextSteps.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.nextStepsCard}>
              <Text style={styles.cardTitle}>Sonraki Adımlar</Text>
              {result.nextSteps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Action Button */}
          <Animated.View entering={FadeInDown.delay(400)}>
            <Pressable style={styles.completeButton} onPress={handleComplete}>
              <Text style={styles.completeButtonText}>Tamamlandı</Text>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {currentQuestionIndex + 1} / {QUESTIONS.length}
        </Text>
      </View>

      {/* Question Card */}
      <ScrollView contentContainerStyle={styles.questionContainer}>
        <Animated.View 
          key={currentQuestionIndex}
          entering={FadeInDown}
          exiting={FadeOut}
          style={styles.questionCard}
        >
          <View style={styles.questionIcon}>
            <Ionicons name="shield-checkmark" size={48} color={colors.brand.primary} />
          </View>

          <Text style={styles.questionText}>{currentQuestion.text}</Text>

          {/* Answer Options */}
          <View style={styles.answerContainer}>
            {currentQuestion.type === 'yes_no' && (
              <>
                <Pressable
                  style={[styles.answerButton, answers[currentQuestion.id] === true && styles.answerButtonActive]}
                  onPress={() => handleAnswer(true)}
                >
                  <Ionicons name="checkmark-circle" size={24} color={answers[currentQuestion.id] === true ? '#fff' : colors.text.secondary} />
                  <Text style={[styles.answerText, answers[currentQuestion.id] === true && styles.answerTextActive]}>
                    Evet
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.answerButton, answers[currentQuestion.id] === false && styles.answerButtonActive]}
                  onPress={() => handleAnswer(false)}
                >
                  <Ionicons name="close-circle" size={24} color={answers[currentQuestion.id] === false ? '#fff' : colors.text.secondary} />
                  <Text style={[styles.answerText, answers[currentQuestion.id] === false && styles.answerTextActive]}>
                    Hayır
                  </Text>
                </Pressable>
              </>
            )}

            {currentQuestion.type === 'rating' && currentQuestion.options && (
              <>
                {currentQuestion.options.map((option, index) => (
                  <Pressable
                    key={index}
                    style={[styles.answerButton, answers[currentQuestion.id] === option && styles.answerButtonActive]}
                    onPress={() => handleAnswer(option)}
                  >
                    <Text style={[styles.answerText, answers[currentQuestion.id] === option && styles.answerTextActive]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 9999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 9999,
  },
  progressText: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  questionContainer: {
    padding: 16,
    flexGrow: 1,
  },
  questionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  questionIcon: {
    marginBottom: 16,
  },
  questionText: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  answerContainer: {
    width: '100%',
    gap: 12,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  answerButtonActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  answerText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  answerTextActive: {
    color: '#fff',
  },
  resultContainer: {
    padding: 16,
    gap: 16,
  },
  scoreCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  scoreGradient: {
    padding: 20,
    alignItems: 'center',
  },
  scoreValue: {
    ...typography.h1,
    color: '#fff',
    fontSize: 72,
    fontWeight: '900',
  },
  scoreLabel: {
    ...typography.h4,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  scoreLevel: {
    ...typography.h3,
    color: '#fff',
    fontWeight: '700',
    marginTop: 8,
  },
  recommendationsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  nextStepsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  recommendationText: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 8,
    lineHeight: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    ...typography.h4,
    color: colors.brand.primary,
    fontWeight: '700',
    minWidth: 24,
  },
  stepText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 24,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.brand.primary,
  },
  completeButtonText: {
    ...typography.h4,
    color: '#fff',
    fontWeight: '700',
  },
});

