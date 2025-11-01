/**
 * MESH HOOK
 * Access BLE mesh state
 */

import { useMeshStore } from '../stores/meshStore';
import { bleMeshService } from '../services/BLEMeshService';

export function useMesh() {
  const peers = useMeshStore(state => state.peers);
  const messages = useMeshStore(state => state.messages);

  const sendMessage = async (message: string, targetId?: string) => {
    return bleMeshService.sendMessage(message, targetId);
  };

  return {
    peers,
    messages,
    sendMessage,
    isConnected: peers.length > 0,
  };
}

