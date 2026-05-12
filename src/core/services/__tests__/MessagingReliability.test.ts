jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

const mockMeshStoreAddMessage = jest.fn();
const mockMessageStoreAddMessage = jest.fn();
const mockMessageStoreAddConversation = jest.fn();
const mockMessageStoreUpdateStatus = jest.fn();
const mockMessageStoreConversations: Array<{ userId: string }> = [];
let mockMeshPeers: Array<{ id: string }> = [];

jest.mock('../../../lib/device', () => ({
  getDeviceId: jest.fn().mockResolvedValue('AFN-TEST0001'),
  setDeviceId: jest.fn().mockResolvedValue(undefined),
  clearDeviceId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../mesh/MeshNetworkService', () => ({
  meshNetworkService: {
    onMessage: jest.fn(() => () => undefined),
    broadcastMessage: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn(() => 'offline'),
  },
  __esModule: true,
  default: {
    onMessage: jest.fn(() => () => undefined),
    broadcastMessage: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn(() => 'offline'),
  },
}));

jest.mock('../mesh/MeshStore', () => ({
  useMeshStore: {
    getState: () => ({
      addMessage: mockMeshStoreAddMessage,
      isConnected: false,
      messages: [],
      peers: mockMeshPeers,
    }),
  },
}));

jest.mock('../../stores/messageStore', () => ({
  useMessageStore: {
    getState: () => ({
      addMessage: mockMessageStoreAddMessage,
      addConversation: mockMessageStoreAddConversation,
      updateMessageStatus: mockMessageStoreUpdateStatus,
      conversations: mockMessageStoreConversations,
    }),
  },
}));

jest.mock('../IdentityService', () => ({
  identityService: {
    getIdentity: jest.fn(() => ({
      id: 'AFN-TEST0001',
      deviceId: 'AFN-TEST0001',
      uid: 'uid-test-1',
      displayName: 'Test User',
      cloudUid: 'uid-test-1',
    })),
    getUid: jest.fn(() => 'uid-test-1'),
    getMyId: jest.fn(() => 'AFN-TEST0001'),
  },
}));

import { hybridMessageService } from '../HybridMessageService';

describe('Messaging reliability hardening', () => {
  const hybrid = hybridMessageService as any;

  beforeEach(() => {
    mockMeshStoreAddMessage.mockClear();
    mockMessageStoreAddMessage.mockClear();
    mockMessageStoreAddConversation.mockClear();
    mockMessageStoreUpdateStatus.mockClear();
    mockMessageStoreConversations.splice(0, mockMessageStoreConversations.length);
    mockMeshPeers = [];
  });

  it('maps hybrid message types to cloud-safe types', () => {
    expect(hybrid.mapHybridTypeToCloudType('CHAT')).toBe('text');
    expect(hybrid.mapHybridTypeToCloudType('SOS')).toBe('sos');
    expect(hybrid.mapHybridTypeToCloudType('IMAGE')).toBe('image');
    expect(hybrid.mapHybridTypeToCloudType('VOICE')).toBe('voice');
    expect(hybrid.mapHybridTypeToCloudType('LOCATION')).toBe('location');
  });

  it('maps cloud message types back to hybrid/media-aware types', () => {
    expect(hybrid.mapCloudTypeToHybridType('sos')).toBe('SOS');
    expect(hybrid.mapCloudTypeToHybridType('image')).toBe('IMAGE');
    expect(hybrid.mapCloudTypeToHybridType('voice')).toBe('VOICE');
    expect(hybrid.mapCloudTypeToHybridType('location')).toBe('LOCATION');

    // Fallback behavior when legacy cloud type is plain text
    expect(hybrid.mapCloudTypeToHybridType('text', 'image', false)).toBe('IMAGE');
    expect(hybrid.mapCloudTypeToHybridType('text', 'voice', false)).toBe('VOICE');
    expect(hybrid.mapCloudTypeToHybridType('text', 'location', false)).toBe('LOCATION');
    expect(hybrid.mapCloudTypeToHybridType('text', undefined, true)).toBe('LOCATION');
    expect(hybrid.mapCloudTypeToHybridType('text', undefined, false)).toBe('CHAT');
  });

  it('normalizes location payload from both lat/lng and latitude/longitude contracts', () => {
    expect(hybrid.normalizeLocationPayload({ lat: 38.42, lng: 27.14, address: 'Izmir' })).toEqual({
      lat: 38.42,
      lng: 27.14,
      address: 'Izmir',
    });

    expect(hybrid.normalizeLocationPayload({ latitude: 39.93, longitude: 32.85 })).toEqual({
      lat: 39.93,
      lng: 32.85,
    });

    expect(hybrid.normalizeLocationPayload({ latitude: 'bad', longitude: 32.85 })).toBeUndefined();
    expect(hybrid.normalizeLocationPayload(null)).toBeUndefined();
  });

  it('classifies own UID-sent message as outgoing in messageStore mirror', () => {
    hybrid.pushCloudMessageToMeshStore({
      id: 'msg-self-uid',
      content: 'test',
      senderId: 'uid-test-1',
      senderName: 'Test User',
      recipientId: 'uid-peer-2',
      timestamp: 1700000000000,
      source: 'HYBRID',
      status: 'pending',
      priority: 'normal',
      type: 'CHAT',
      retryCount: 0,
    });

    expect(mockMessageStoreAddMessage).toHaveBeenCalledTimes(1);
    const mirrored = mockMessageStoreAddMessage.mock.calls[0][0];
    expect(mirrored.from).toBe('me');
    expect(mirrored.to).toBe('uid-peer-2');
  });

  it('builds mesh recipient aliases from requested and resolved IDs', () => {
    const aliases = hybrid.buildMeshRecipientAliases('AFN-ABCD1234', 'uid-peer-2');
    expect(aliases).toEqual(expect.arrayContaining(['AFN-ABCD1234', 'uid-peer-2']));
  });

  it('merges injected recipient aliases and filters non-routable values', () => {
    const aliases = hybrid.buildMeshRecipientAliases(
      'uid-peer-2',
      'uid-peer-2',
      ['AFN-ABCD1234', 'broadcast', 'me', 'uid-peer-2'],
    );
    expect(aliases).toEqual(expect.arrayContaining(['uid-peer-2', 'AFN-ABCD1234']));
    expect(aliases).not.toEqual(expect.arrayContaining(['broadcast', 'me']));
  });

  it('treats directed mesh send as untrusted when no peers are visible', () => {
    expect(hybrid.canTreatMeshSendAsDelivery({ recipientId: 'uid-peer-2' })).toBe(false);
    mockMeshPeers = [{ id: 'peer-1' }];
    expect(hybrid.canTreatMeshSendAsDelivery({ recipientId: 'uid-peer-2' })).toBe(false);
    mockMeshPeers = [{ id: 'uid-peer-2' }];
    expect(hybrid.canTreatMeshSendAsDelivery({ recipientId: 'uid-peer-2' })).toBe(true);
  });

  it('trusts visible mesh peer aliases for directed delivery', () => {
    mockMeshPeers = [{ id: 'afn-abcd1234' }];
    expect(hybrid.canTreatMeshSendAsDelivery({
      recipientId: 'uid-peer-2',
      recipientAliases: ['AFN-ABCD1234'],
    })).toBe(true);
  });

  it('keeps retrying direct offline messages after max attempts', () => {
    expect(hybrid.shouldKeepRetryingAfterMaxAttempts({
      type: 'CHAT',
      recipientId: 'uid-peer-2',
      recipientAliases: ['AFN-ABCD1234'],
    }, false)).toBe(true);

    expect(hybrid.shouldKeepRetryingAfterMaxAttempts({
      type: 'CHAT',
      recipientId: 'uid-peer-2',
    }, true)).toBe(false);
  });

  it('derives outgoing delivery and read state from Firestore receipt maps', () => {
    const selfIds = hybrid.getSelfIdentityIds();
    expect(hybrid.resolveCloudDeliveryState({
      status: 'sent',
      deliveredTo: { 'uid-peer-2': Date.now() },
    }, { isFromMe: true, selfIds })).toEqual({
      status: 'delivered',
      delivered: true,
      read: false,
    });

    expect(hybrid.resolveCloudDeliveryState({
      status: 'sent',
      readBy: { 'uid-peer-2': Date.now() },
    }, { isFromMe: true, selfIds })).toEqual({
      status: 'read',
      delivered: true,
      read: true,
    });
  });

  it('derives incoming read state from self readBy map without forcing unread messages to read', () => {
    const selfIds = hybrid.getSelfIdentityIds();
    expect(hybrid.resolveCloudDeliveryState({
      status: 'sent',
      deliveredTo: { 'uid-test-1': Date.now() },
    }, { isFromMe: false, selfIds })).toEqual({
      status: 'delivered',
      delivered: true,
      read: false,
    });

    expect(hybrid.resolveCloudDeliveryState({
      status: 'sent',
      readBy: { 'uid-test-1': Date.now() },
    }, { isFromMe: false, selfIds })).toEqual({
      status: 'read',
      delivered: true,
      read: true,
    });
  });
});
