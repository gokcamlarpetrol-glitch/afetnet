/**
 * Memoized Components for Performance
 * Elite React Performance Optimization
 * 
 * Benefits:
 * - Prevent unnecessary re-renders
 * - Improve scroll performance  
 * - Reduce CPU usage
 * - Better battery life
 */

import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

/**
 * Memoized Status Indicator
 * Re-renders only when status changes
 */
export const StatusIndicator = memo(({ 
  status, 
  label 
}: { 
  status: 'online' | 'offline' | 'connecting';
  label: string;
}) => {
  const colors = {
    online: '#10b981',
    offline: '#ef4444',
    connecting: '#f59e0b',
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors[status],
        marginRight: 8,
      }} />
      <Text style={{ color: '#94a3b8', fontSize: 14 }}>{label}</Text>
    </View>
  );
});

StatusIndicator.displayName = 'StatusIndicator';

/**
 * Memoized Family Member Card
 * Re-renders only when member data changes
 */
export const FamilyMemberCard = memo(({
  member,
  onPress,
}: {
  member: {
    afnId: string;
    name: string;
    isOnline: boolean;
    batteryLevel?: number;
    lastSeen?: number;
  };
  onPress: (afnId: string) => void;
}) => {
  return (
    <Pressable
      onPress={() => onPress(member.afnId)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#1e293b' : '#0f172a',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
            {member.name}
          </Text>
          <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            {member.afnId}
          </Text>
        </View>
        <StatusIndicator 
          status={member.isOnline ? 'online' : 'offline'}
          label={member.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
        />
      </View>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.member.afnId === nextProps.member.afnId &&
    prevProps.member.isOnline === nextProps.member.isOnline &&
    prevProps.member.batteryLevel === nextProps.member.batteryLevel
  );
});

FamilyMemberCard.displayName = 'FamilyMemberCard';

/**
 * Memoized Queue Item
 * Re-renders only when item changes
 */
export const QueueItemCard = memo(({
  item,
  onRetry,
}: {
  item: {
    id: string;
    type: 'sos' | 'msg';
    status: 'pending' | 'sending' | 'failed';
    timestamp: number;
  };
  onRetry: (id: string) => void;
}) => {
  const statusColors = {
    pending: '#f59e0b',
    sending: '#3b82f6',
    failed: '#ef4444',
  };

  return (
    <View style={{
      backgroundColor: '#1e293b',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: statusColors[item.status],
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#ffffff', fontSize: 14 }}>
          {item.type.toUpperCase()}
        </Text>
        <Text style={{ color: '#64748b', fontSize: 12 }}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      {item.status === 'failed' && (
        <Pressable onPress={() => onRetry(item.id)} style={{ marginTop: 8 }}>
          <Text style={{ color: '#3b82f6', fontSize: 12 }}>Tekrar Dene</Text>
        </Pressable>
      )}
    </View>
  );
});

QueueItemCard.displayName = 'QueueItemCard';

/**
 * Memoized Earthquake Card
 * Re-renders only when earthquake data changes
 */
export const EarthquakeCard = memo(({
  earthquake,
}: {
  earthquake: {
    magnitude: number;
    location: string;
    depth: number;
    timestamp: Date;
    distance?: number;
  };
}) => {
  const getMagnitudeColor = (mag: number) => {
    if (mag >= 5.0) return '#ef4444';
    if (mag >= 4.0) return '#f59e0b';
    return '#10b981';
  };

  return (
    <View style={{
      backgroundColor: '#1e293b',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: getMagnitudeColor(earthquake.magnitude),
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ 
          color: getMagnitudeColor(earthquake.magnitude), 
          fontSize: 24, 
          fontWeight: '700',
        }}>
          {earthquake.magnitude.toFixed(1)}
        </Text>
        {earthquake.distance && (
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            {earthquake.distance.toFixed(0)} km
          </Text>
        )}
      </View>
      <Text style={{ color: '#ffffff', fontSize: 16, marginBottom: 4 }}>
        {earthquake.location}
      </Text>
      <Text style={{ color: '#64748b', fontSize: 12 }}>
        Derinlik: {earthquake.depth} km • {new Date(earthquake.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );
});

EarthquakeCard.displayName = 'EarthquakeCard';

/**
 * USAGE:
 * 
 * ```tsx
 * import { FamilyMemberCard, QueueItemCard, EarthquakeCard } from '@/components/MemoizedComponents';
 * 
 * // These components won't re-render unless their props change
 * {familyList.map(member => (
 *   <FamilyMemberCard key={member.afnId} member={member} onPress={handlePress} />
 * ))}
 * ```
 */

