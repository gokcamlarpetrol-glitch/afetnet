import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { SimulationScenario } from '../services/simulation/EmergencySimulationSystem';

interface SimulationCardProps {
  scenario: SimulationScenario;
  onStartSimulation: (scenarioId: string) => void;
  userStats?: any;
}

export default function SimulationCard({ scenario, onStartSimulation, userStats }: SimulationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (scenario.difficulty === 'expert') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [scenario.difficulty, pulseAnim]);

  const getDifficultyColor = (difficulty: SimulationScenario['difficulty']) => {
    switch (difficulty) {
      case 'beginner': return '#10b981';
      case 'intermediate': return '#f59e0b';
      case 'advanced': return '#ef4444';
      case 'expert': return '#8b5cf6';
    }
  };

  const getDifficultyBg = (difficulty: SimulationScenario['difficulty']) => {
    switch (difficulty) {
      case 'beginner': return '#064e3b';
      case 'intermediate': return '#78350f';
      case 'advanced': return '#7f1d1d';
      case 'expert': return '#5b21b6';
    }
  };

  const getTypeIcon = (type: SimulationScenario['type']) => {
    switch (type) {
      case 'earthquake': return '🌍';
      case 'fire': return '🔥';
      case 'flood': return '🌊';
      case 'gas_leak': return '⛽';
      case 'medical': return '🏥';
      case 'evacuation': return '🚨';
      case 'terrorism': return '⚠️';
      default: return '🎯';
    }
  };

  const getDifficultyIcon = (difficulty: SimulationScenario['difficulty']) => {
    switch (difficulty) {
      case 'beginner': return '🟢';
      case 'intermediate': return '🟡';
      case 'advanced': return '🟠';
      case 'expert': return '🔴';
    }
  };

  return (
    <Animated.View
      style={{
        backgroundColor: getDifficultyBg(scenario.difficulty),
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: getDifficultyColor(scenario.difficulty),
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>
              {getTypeIcon(scenario.type)}
            </Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '700',
              flex: 1,
            }}>
              {scenario.name}
            </Text>
          </View>

          <Text style={{
            color: '#d1d5db',
            fontSize: 12,
            marginBottom: 8,
            lineHeight: 16,
          }}>
            {scenario.description}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{
              backgroundColor: getDifficultyColor(scenario.difficulty),
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              marginRight: 8,
            }}>
              <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '600' }}>
                {getDifficultyIcon(scenario.difficulty)} {scenario.difficulty.toUpperCase()}
              </Text>
            </View>

            <Text style={{ color: '#9ca3af', fontSize: 11 }}>
              ⏱️ {scenario.duration} dk
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>
              🎯 {scenario.objectives.length} Hedef
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, marginLeft: 12 }}>
              ⭐ {scenario.estimatedScore} Puan
            </Text>
            {userStats && (
              <Text style={{ color: '#10b981', fontSize: 11, marginLeft: 12 }}>
                🏆 En Yüksek: {userStats.highestScore || 0}
              </Text>
            )}
          </View>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={getDifficultyColor(scenario.difficulty)}
        />
      </TouchableOpacity>

      {/* Expanded Content */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: getDifficultyColor(scenario.difficulty) }}>
          {/* Objectives */}
          <View style={{ padding: 16 }}>
            <Text style={{
              color: '#ffffff',
              fontSize: 14,
              fontWeight: '600',
              marginBottom: 12,
            }}>
              🎯 Hedefler:
            </Text>
            
            {scenario.objectives.map((objective, index) => (
              <View
                key={objective.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: '#374151',
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', marginRight: 8 }}>
                  {index + 1}.
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '500' }}>
                    {objective.title}
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 10 }}>
                    {objective.description}
                  </Text>
                </View>
                <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>
                  {objective.points} puan
                </Text>
              </View>
            ))}

            {/* Rewards */}
            {scenario.rewards.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={{
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 12,
                }}>
                  🏆 Ödüller:
                </Text>
                
                {scenario.rewards.map((reward) => (
                  <View
                    key={reward.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: '#374151',
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 16, marginRight: 8 }}>
                      {reward.icon}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '500' }}>
                        {reward.name}
                      </Text>
                      <Text style={{ color: '#9ca3af', fontSize: 10 }}>
                        {reward.description}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: reward.rarity === 'legendary' ? '#fbbf24' : 
                                     reward.rarity === 'epic' ? '#8b5cf6' :
                                     reward.rarity === 'rare' ? '#3b82f6' : '#10b981',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}>
                      <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '600' }}>
                        {reward.rarity.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Requirements */}
            {scenario.requirements.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={{
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 12,
                }}>
                  📋 Gereksinimler:
                </Text>
                
                {scenario.requirements.map((requirement, index) => (
                  <Text
                    key={index}
                    style={{
                      color: '#f59e0b',
                      fontSize: 12,
                      marginBottom: 4,
                      paddingLeft: 8,
                    }}
                  >
                    • {requirement}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: getDifficultyColor(scenario.difficulty),
            flexDirection: 'row',
            gap: 12,
          }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: getDifficultyColor(scenario.difficulty),
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={() => onStartSimulation(scenario.id)}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                🎮 Simülasyonu Başlat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}







