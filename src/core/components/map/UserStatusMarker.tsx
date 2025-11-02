/**
 * USER STATUS MARKER - Real-time Status Display
 * Shows user safety status on map
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserStatus } from '../../stores/userStatusStore';

interface Props {
  status: UserStatus;
  name?: string;
  isCurrentUser?: boolean;
}

export function UserStatusMarker({ status, name, isCurrentUser = false }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'sos' || status === 'trapped') {
      // Pulse animation for emergency
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [status]);

  const getStatusColor = () => {
    switch (status) {
      case 'safe':
        return '#10B981'; // Green
      case 'needs_help':
        return '#F59E0B'; // Amber
      case 'trapped':
        return '#DC2626'; // Deep red
      case 'sos':
        return '#EF4444'; // Bright red
      case 'offline':
        return '#6B7280'; // Gray
      default:
        return '#10B981';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'safe':
        return 'checkmark-circle';
      case 'needs_help':
        return 'alert-circle';
      case 'trapped':
        return 'warning';
      case 'sos':
        return 'warning';
      case 'offline':
        return 'cloud-offline';
      default:
        return 'person';
    }
  };

  const color = getStatusColor();

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      {/* Outer glow for emergency */}
      {(status === 'sos' || status === 'trapped') && (
        <View style={[styles.glow, { backgroundColor: color }]} />
      )}
      
      {/* Main marker */}
      <View style={[styles.marker, { backgroundColor: color }]}>
        <Ionicons 
          name={getStatusIcon()} 
          size={isCurrentUser ? 24 : 20} 
          color="#FFF" 
        />
      </View>

      {/* Name label */}
      {name && (
        <View style={[styles.label, { backgroundColor: color }]}>
          <Text style={styles.labelText} numberOfLines={1}>{name}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.3,
  },
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  label: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
});

