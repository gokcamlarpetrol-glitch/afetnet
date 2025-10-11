import { useEffect, useState, useCallback } from 'react';
import { logger } from '../../utils/productionLogger';
import { offMeshRouter } from '../../offmesh/router';
import { meshStore } from '../../offmesh/store';
import { qosManager } from '../../offmesh/qos';
import { Envelope, PeerInfo, MeshStats, JournalEvent } from '../../offmesh/types';

export function useOffMesh() {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<MeshStats>({
    peers: 0,
    queued: 0,
    dedup: 0,
    lastHop: 'never',
    uptime: 0,
  });
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [recentEvents, setRecentEvents] = useState<JournalEvent[]>([]);

  const updateStats = useCallback(() => {
    setStats(offMeshRouter.getStats());
    setPeers(offMeshRouter.getPeers());
    setRecentEvents(meshStore.getRecentEvents(20));
  }, []);

  useEffect(() => {
    // Initial update
    updateStats();

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000);

    // Subscribe to peer changes
    const unsubscribePeers = offMeshRouter.subscribeToPeers(setPeers);

    return () => {
      clearInterval(interval);
      unsubscribePeers();
    };
  }, [updateStats]);

  const startMesh = useCallback(async (topic: string) => {
    try {
      await offMeshRouter.startMesh(topic);
      setIsRunning(true);
      updateStats();
    } catch (error) {
      logger.error('Failed to start mesh:', error);
      throw error;
    }
  }, [updateStats]);

  const stopMesh = useCallback(async () => {
    try {
      await offMeshRouter.stopMesh();
      setIsRunning(false);
      updateStats();
    } catch (error) {
      logger.error('Failed to stop mesh:', error);
      throw error;
    }
  }, [updateStats]);

  const sendMessage = useCallback(async (envelope: Envelope) => {
    try {
      await offMeshRouter.send(envelope);
      updateStats();
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }, [updateStats]);

  const subscribeToMessages = useCallback((callback: (envelope: Envelope) => void) => {
    return offMeshRouter.subscribe(callback);
  }, []);

  const setKey = useCallback((key: string) => {
    offMeshRouter.setKey(key);
  }, []);

  const exportJournal = useCallback(async () => {
    try {
      return await meshStore.exportJournal();
    } catch (error) {
      logger.error('Failed to export journal:', error);
      throw error;
    }
  }, []);

  const clearData = useCallback(async () => {
    try {
      await meshStore.clear();
      updateStats();
    } catch (error) {
      logger.error('Failed to clear data:', error);
      throw error;
    }
  }, [updateStats]);

  const getQosStatus = useCallback(() => {
    return qosManager.getStatus();
  }, []);

  const canSend = useCallback((type: 'sos' | 'chat' | 'pos') => {
    return qosManager.canSend(type);
  }, []);

  const getTimeUntilNextToken = useCallback((type: 'sos' | 'chat' | 'pos') => {
    return qosManager.getTimeUntilNextToken(type);
  }, []);

  return {
    // State
    isRunning,
    stats,
    peers,
    recentEvents,
    
    // Actions
    startMesh,
    stopMesh,
    sendMessage,
    subscribeToMessages,
    setKey,
    exportJournal,
    clearData,
    
    // QoS
    getQosStatus,
    canSend,
    getTimeUntilNextToken,
    
    // Utils
    updateStats,
  };
}



