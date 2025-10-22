import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { offMeshRouter } from '../../offmesh/router';
// import { meshStore } from '../../offmesh/store'; // Not used
import { qosManager } from '../../offmesh/qos';
import { PeerInfo, MeshStats } from '../../offmesh/types';
import * as Sim from '../../offmesh/transport/Sim';

interface OffMeshStatusProps {
  onPress?: () => void;
}

export default function OffMeshStatus({ onPress }: OffMeshStatusProps) {
  const [stats, setStats] = useState<MeshStats>({
    peers: 0,
    queued: 0,
    dedup: 0,
    lastHop: 'never',
    uptime: 0,
  });
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [qosStatus, setQosStatus] = useState(qosManager.getStatus());

  useEffect(() => {
    const updateStats = () => {
      setStats(offMeshRouter.getStats());
      setPeers(offMeshRouter.getPeers());
      setQosStatus(qosManager.getStatus());
    };

    // Initial update
    updateStats();

    // Update every 5 seconds
    const interval = (globalThis as any).setInterval(updateStats, 5000);

    // Subscribe to peer changes
    const unsubscribePeers = offMeshRouter.subscribeToPeers(setPeers);

    return () => {
      (globalThis as any).clearInterval(interval);
      unsubscribePeers();
    };
  }, []);

  const getStatusColor = (): string => {
    if (stats.peers > 0) {
      return '#22c55e'; // Green - connected
    } else if (qosStatus.canActivateMesh) {
      return '#f59e0b'; // Yellow - searching
    } else {
      return '#ef4444'; // Red - offline/low battery
    }
  };

  const getStatusText = (): string => {
    // Check if we're in simulator mode
    const isSimulator = Platform.OS === 'ios' && Platform.isPad === false && Platform.isTV === false;
    const isSimRunning = Sim.isRunning();
    
    if (isSimulator && isSimRunning) {
      return 'SIM MODE';
    } else if (stats.peers > 0) {
      return `ONLINE:${stats.peers}`;
    } else if (qosStatus.canActivateMesh) {
      return 'SEARCHING';
    } else {
      return 'OFFLINE';
    }
  };

  const getTransportInfo = (): string => {
    // Check if we're in simulator mode
    const isSimulator = Platform.OS === 'ios' && Platform.isPad === false && Platform.isTV === false;
    const isSimRunning = Sim.isRunning();
    
    if (isSimulator && isSimRunning) {
      return `room:${Sim.getRoom()}`;
    }

    const transportCounts = peers.reduce((acc, peer) => {
      acc[peer.transport] = (acc[peer.transport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const transportInfo = Object.entries(transportCounts)
      .map(([transport, count]) => {
        switch (transport) {
        case 'sim': return `sim:${count}`;
        case 'mciOS': return `mpeer:${count}`;
        case 'bleiOS': return `ble:${count}`;
        case 'wifiP2P': return `wifi:${count}`;
        case 'bleAndroid': return `ble:${count}`;
        default: return `${transport}:${count}`;
        }
      })
      .join(' ');

    return transportInfo || 'none';
  };

  // Check if we're in simulator mode
  const isSimulator = Platform.OS === 'ios' && Platform.isPad === false && Platform.isTV === false;
  const isSimRunning = Sim.isRunning();

  if (isSimulator && isSimRunning) {
    // Show simplified simulator status
    return (
      <View style={[styles.simContainer, { borderColor: '#22c55e' }]}>
        <Text style={[styles.simText, { color: '#22c55e' }]}>
          Sim Mode Active
        </Text>
        <Text style={styles.simSubtext}>
          {getTransportInfo()}
        </Text>
      </View>
    );
  }

  return (
    <Pressable 
      style={[styles.container, { borderColor: getStatusColor() }]} 
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.status}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          <Text style={styles.transportText}>
            {getTransportInfo()}
          </Text>
        </View>
        
        <View style={styles.stats}>
          <Text style={styles.statText}>
            QUEUE:{stats.queued}
          </Text>
          <Text style={styles.statText}>
            DEDUP:{stats.dedup}
          </Text>
          <Text style={styles.statText}>
            LAST:{stats.lastHop}
          </Text>
        </View>
      </View>
      
      {!qosStatus.canActivateMesh && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Battery: {qosStatus.batteryLevel}% • {qosStatus.isHighTemp ? 'High temp' : 'Low power'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    margin: 4,
  },
  simContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#222',
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  simText: {
    fontSize: 12,
    fontWeight: '800',
  },
  simSubtext: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  transportText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  stats: {
    alignItems: 'flex-end',
  },
  statText: {
    fontSize: 10,
    color: '#d1d5db',
    fontWeight: '600',
  },
  warning: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  warningText: {
    fontSize: 9,
    color: '#f59e0b',
    textAlign: 'center',
  },
});
