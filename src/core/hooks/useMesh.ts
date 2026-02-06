/**
 * MESH HOOK
 * Access BLE mesh state
 */

import { useMeshStore } from '../services/mesh/MeshStore';
import { bleMeshService } from '../services/BLEMeshService';

export function useMesh() {
  const peers = useMeshStore(state => state.peers);
  const messages = useMeshStore(state => state.messages);
  const isConnected = useMeshStore(state => state.isConnected);

  const sendMessage = async (message: string, targetId?: string) => {
    return bleMeshService.sendMessage(message, targetId ?? '*'); // ELITE: Default to broadcast if no target
  };

  return {
    peers,
    messages,
    sendMessage,
    isConnected,
  };
}
