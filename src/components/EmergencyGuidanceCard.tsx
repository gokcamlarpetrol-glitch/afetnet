import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { EmergencyGuidance, GuidanceStep } from '../services/guidance/EmergencyGuidanceSystem';

interface EmergencyGuidanceCardProps {
  guidance: EmergencyGuidance;
  onStepComplete: (guidanceId: string, stepId: string) => void;
  onGuidanceComplete: (guidanceId: string) => void;
}

export default function EmergencyGuidanceCard({ guidance, onStepComplete, onGuidanceComplete }: EmergencyGuidanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (guidance.severity === 'critical') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [guidance.severity, pulseAnim]);

  const getSeverityColor = (severity: EmergencyGuidance['severity']) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
    }
  };

  const getSeverityBg = (severity: EmergencyGuidance['severity']) => {
    switch (severity) {
      case 'critical': return '#7f1d1d';
      case 'high': return '#78350f';
      case 'medium': return '#1e3a8a';
      case 'low': return '#064e3b';
    }
  };

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    onStepComplete(guidance.id, stepId);
  };

  const progressPercentage = (completedSteps.size / guidance.steps.length) * 100;

  return (
    <Animated.View
      style={{
        backgroundColor: getSeverityBg(guidance.severity),
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: getSeverityColor(guidance.severity),
        transform: [{ scale: pulseAnim }],
      }}
    >
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{
            color: '#ffffff',
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 4,
          }}>
            {guidance.title}
          </Text>
          <Text style={{
            color: '#d1d5db',
            fontSize: 12,
            marginBottom: 8,
          }}>
            {guidance.description}
          </Text>
          
          {/* Progress Bar */}
          <View style={{
            height: 6,
            backgroundColor: '#374151',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 8,
          }}>
            <View style={{
              height: '100%',
              width: `${progressPercentage}%`,
              backgroundColor: getSeverityColor(guidance.severity),
              borderRadius: 3,
            }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>
              {completedSteps.size}/{guidance.steps.length} Adım
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, marginLeft: 12 }}>
              ~{guidance.estimatedDuration} dk
            </Text>
          </View>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={getSeverityColor(guidance.severity)}
        />
      </TouchableOpacity>

      {/* Expanded Content */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: getSeverityColor(guidance.severity) }}>
          <ScrollView style={{ maxHeight: 400 }}>
            {guidance.steps.map((step, index) => (
              <GuidanceStepItem
                key={step.id}
                step={step}
                stepNumber={index + 1}
                isCompleted={completedSteps.has(step.id)}
                onComplete={() => handleStepComplete(step.id)}
                severityColor={getSeverityColor(guidance.severity)}
              />
            ))}
          </ScrollView>

          {/* Action Buttons */}
          <View style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: getSeverityColor(guidance.severity),
            flexDirection: 'row',
            gap: 12,
          }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: getSeverityColor(guidance.severity),
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={() => onGuidanceComplete(guidance.id)}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                Rehberi Tamamla
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

interface GuidanceStepItemProps {
  step: GuidanceStep;
  stepNumber: number;
  isCompleted: boolean;
  onComplete: () => void;
  severityColor: string;
}

function GuidanceStepItem({ step, stepNumber, isCompleted, onComplete, severityColor }: GuidanceStepItemProps) {
  return (
    <View style={{
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#374151',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Step Number */}
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isCompleted ? severityColor : '#374151',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
          {isCompleted ? (
            <Ionicons name="checkmark" size={20} color="#ffffff" />
          ) : (
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
              {stepNumber}
            </Text>
          )}
        </View>

        {/* Step Content */}
        <View style={{ flex: 1 }}>
          <Text style={{
            color: isCompleted ? '#9ca3af' : '#ffffff',
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 4,
            textDecorationLine: isCompleted ? 'line-through' : 'none',
          }}>
            {step.title}
          </Text>
          
          <Text style={{
            color: isCompleted ? '#6b7280' : '#d1d5db',
            fontSize: 12,
            marginBottom: 8,
            lineHeight: 16,
          }}>
            {step.description}
          </Text>

          {/* Tips */}
          {step.tips && step.tips.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                💡 İpuçları:
              </Text>
              {step.tips.map((tip, index) => (
                <Text key={index} style={{ color: '#10b981', fontSize: 10, marginLeft: 8 }}>
                  • {tip}
                </Text>
              ))}
            </View>
          )}

          {/* Warnings */}
          {step.warnings && step.warnings.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                ⚠️ Uyarılar:
              </Text>
              {step.warnings.map((warning, index) => (
                <Text key={index} style={{ color: '#ef4444', fontSize: 10, marginLeft: 8 }}>
                  • {warning}
                </Text>
              ))}
            </View>
          )}

          {/* Time Estimate */}
          <Text style={{ color: '#9ca3af', fontSize: 10 }}>
            ⏱️ Tahmini süre: {step.estimatedTime} saniye
          </Text>
        </View>

        {/* Complete Button */}
        {!isCompleted && (
          <TouchableOpacity
            style={{
              backgroundColor: severityColor,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              marginLeft: 8,
            }}
            onPress={onComplete}
          >
            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
              Tamamla
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}








