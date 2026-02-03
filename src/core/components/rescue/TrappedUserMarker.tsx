/**
 * TRAPPED USER MARKER
 * Map marker for trapped users detected via rescue beacon
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { TrappedUser } from '../../stores/rescueStore';

interface Props {
  user: TrappedUser;
  onPress?: (user: TrappedUser) => void;
}

export default function TrappedUserMarker({ user, onPress }: Props) {
  if (!user.location) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
    case 'trapped':
      return '#dc2626';
    case 'injured':
      return '#f59e0b';
    case 'safe':
      return '#10b981';
    default:
      return '#6b7280';
    }
  };

  const statusColor = getStatusColor(user.status);

  return (
    <Marker
      coordinate={{
        latitude: user.location.latitude,
        longitude: user.location.longitude,
      }}
      onPress={() => onPress?.(user)}
      tracksViewChanges={false}
    >
      {/* Custom Marker View */}
      <View style={styles.markerContainer}>
        {/* Pulsing Circle */}
        <View style={[styles.pulseCircle, { backgroundColor: statusColor }]} />
        
        {/* Icon Container */}
        <View style={[styles.iconContainer, { backgroundColor: statusColor }]}>
          <Ionicons name="person" size={16} color="#ffffff" />
        </View>
        
        {/* Signal Strength Indicator */}
        {user.rssi && (
          <View style={styles.signalIndicator}>
            <Ionicons
              name="radio"
              size={10}
              color={user.rssi >= -70 ? '#10b981' : user.rssi >= -80 ? '#f59e0b' : '#ef4444'}
            />
          </View>
        )}
      </View>

      {/* Callout */}
      <Callout tooltip>
        <View style={styles.callout}>
          <View style={[styles.calloutHeader, { backgroundColor: statusColor }]}>
            <Text style={styles.calloutName}>{user.name}</Text>
            {user.battery !== undefined && (
              <View style={styles.batteryBadge}>
                <Ionicons
                  name={user.battery > 20 ? 'battery-half' : 'battery-dead'}
                  size={12}
                  color="#ffffff"
                />
                <Text style={styles.batteryText}>{user.battery}%</Text>
              </View>
            )}
          </View>
          
          <View style={styles.calloutBody}>
            {user.message && (
              <Text style={styles.calloutMessage}>{user.message}</Text>
            )}
            
            <View style={styles.calloutInfo}>
              {user.distance !== undefined && (
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={14} color="#6b7280" />
                  <Text style={styles.infoText}>
                    {user.distance < 1000
                      ? `${Math.round(user.distance)}m uzaklıkta`
                      : `${(user.distance / 1000).toFixed(1)}km uzaklıkta`}
                  </Text>
                </View>
              )}
              
              <View style={styles.infoRow}>
                <Ionicons name="time" size={14} color="#6b7280" />
                <Text style={styles.infoText}>
                  {Math.round((Date.now() - user.lastSeen) / 1000)}s önce
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.3,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  signalIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  callout: {
    width: 240,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  calloutName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  batteryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  calloutBody: {
    padding: 12,
  },
  calloutMessage: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  calloutInfo: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
  },
});


