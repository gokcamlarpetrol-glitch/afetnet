const mockBroadcastMessage = jest.fn();
const mockSaveMessage = jest.fn();
const mockMeshStart = jest.fn();
let mockMeshPeers: Array<{ id: string }> = [];
let mockOnlineState = true;

jest.mock('../mesh/MeshNetworkService', () => ({
  meshNetworkService: {
    getIsRunning: jest.fn(() => true),
    start: (...args: unknown[]) => mockMeshStart(...args),
    broadcastMessage: (...args: unknown[]) => mockBroadcastMessage(...args),
  },
  __esModule: true,
  default: {
    getIsRunning: jest.fn(() => true),
    start: (...args: unknown[]) => mockMeshStart(...args),
    broadcastMessage: (...args: unknown[]) => mockBroadcastMessage(...args),
  },
}));

jest.mock('../mesh/MeshStore', () => ({
  useMeshStore: {
    getState: () => ({
      peers: mockMeshPeers,
      isConnected: mockMeshPeers.length > 0,
      messages: [],
      addMessage: jest.fn(),
      updateMessage: jest.fn(),
    }),
  },
}));

jest.mock('../ConnectionManager', () => ({
  connectionManager: {
    get isOnline() {
      return mockOnlineState;
    },
  },
}));

const SELF_UID = 'UIDSELF12345678901234';
jest.mock('../IdentityService', () => ({
  identityService: {
    getUid: jest.fn(() => SELF_UID),
    getMyId: jest.fn(() => SELF_UID),
    getIdentity: jest.fn(() => ({
      uid: SELF_UID,
      id: SELF_UID,
      deviceId: SELF_UID,
      displayName: 'Test User',
    })),
  },
}));

jest.mock('../FirebaseDataService', () => ({
  firebaseDataService: {
    initialize: jest.fn(async () => undefined),
    saveMessage: (...args: unknown[]) => mockSaveMessage(...args),
  },
}));

jest.mock('../mesh/MeshStoreForwardService', () => ({
  meshStoreForwardService: {
    storeForPeer: jest.fn(async () => undefined),
  },
}));

import { hybridMessageService } from '../HybridMessageService';

describe('HybridMessageService delivery decision matrix', () => {
  const hybrid = hybridMessageService as any;
  const directUid = 'UIDTARGET12345678901234';

  const createMessage = (
    overrides: Partial<{
      id: string;
      recipientId: string;
      type: 'CHAT' | 'SOS';
    }> = {},
  ) => ({
    id: overrides.id ?? 'msg-test-1',
    content: 'merhaba',
    senderId: SELF_UID,
    senderName: 'Test User',
    recipientId: overrides.recipientId ?? directUid,
    timestamp: Date.now(),
    source: 'HYBRID',
    status: 'pending',
    priority: 'normal',
    type: overrides.type ?? 'CHAT',
    retryCount: 0,
  });

  beforeEach(() => {
    mockBroadcastMessage.mockResolvedValue(undefined);
    // Return structured SaveMessageResult with retryable_failure outcome (cloud write failed)
    mockSaveMessage.mockResolvedValue({
      success: false,
      outcome: {
        status: 'retryable_failure' as const,
        messagePersisted: false,
        inboxDelivered: false,
        error: 'mock cloud failure',
      },
    });
    mockMeshStart.mockResolvedValue(undefined);
    mockMeshPeers = [{ id: 'peer-1' }];
    mockOnlineState = true;
    jest.clearAllMocks();
  });

  it('keeps direct UID chat in queue when mesh succeeds but cloud write fails', async () => {
    const result = await hybrid.attemptSend(createMessage());
    expect(result).toBe('retryable');
    expect(mockBroadcastMessage).toHaveBeenCalledTimes(1);
  });

  it('SOS requires cloud success — mesh-only is not sufficient for queue completion', async () => {
    // SOS messages MUST reach cloud for push notifications to family/rescue teams.
    // Mesh-only success keeps the message in retry queue for cloud delivery.
    const result = await hybrid.attemptSend(createMessage({ type: 'SOS', id: 'msg-test-sos' }));
    expect(result).toBe('retryable'); // Cloud failed → stays in queue
    expect(mockBroadcastMessage).toHaveBeenCalledTimes(1); // Mesh was still attempted
  });

  it('accepts non-UID direct alias over mesh when peers are visible', async () => {
    mockMeshPeers = [{ id: 'AFN-ABCD1234' }];
    const result = await hybrid.attemptSend(
      createMessage({
        id: 'msg-test-alias',
        recipientId: 'AFN-ABCD1234',
      }),
    );
    expect(result).toBe('success');
    expect(mockBroadcastMessage).toHaveBeenCalledTimes(1);
  });

  it('does not trust directed mesh delivery when no peers are visible', async () => {
    mockMeshPeers = [];
    const result = await hybrid.attemptSend(
      createMessage({
        id: 'msg-test-no-peer',
        recipientId: 'AFN-ABCD1234',
      }),
    );
    expect(result).toBe('retryable');
    expect(mockBroadcastMessage).toHaveBeenCalledTimes(1);
  });

  it('does not trust direct alias delivery when only unrelated peers are visible', async () => {
    mockMeshPeers = [{ id: 'peer-1' }];
    const result = await hybrid.attemptSend(
      createMessage({
        id: 'msg-test-wrong-peer',
        recipientId: 'AFN-ABCD1234',
      }),
    );
    expect(result).toBe('retryable');
    expect(mockBroadcastMessage).toHaveBeenCalledTimes(1);
  });
});
