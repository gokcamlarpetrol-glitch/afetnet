const mockSendGroupMessage = jest.fn();
const mockMeshBroadcastMessage = jest.fn();
const mockGetAuth = jest.fn(() => ({
  currentUser: {
    uid: 'uid_test_sender',
    displayName: 'Test Kullanıcı',
  },
}));

jest.mock('../../utils/messageSanitizer', () => ({
  validateMessage: jest.fn(() => ({ valid: true, sanitized: 'Merhaba' })),
  sanitizeMessage: jest.fn((value: string) => value),
}));

jest.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
}));

jest.mock('../IdentityService', () => ({
  identityService: {
    getUid: jest.fn(() => 'uid_test_sender'),
    getMyId: jest.fn(() => 'afn-test-001'),
    getMeshDeviceId: jest.fn(() => 'mesh-test-001'),
  },
}));

jest.mock('../mesh/MeshNetworkService', () => ({
  __esModule: true,
  default: {
    broadcastMessage: (...args: unknown[]) => mockMeshBroadcastMessage(...args),
  },
  meshNetworkService: {
    broadcastMessage: (...args: unknown[]) => mockMeshBroadcastMessage(...args),
  },
}));

jest.mock('../mesh/MeshProtocol', () => ({
  MeshMessageType: {
    TEXT: 'TEXT',
    SOS: 'SOS',
  },
}));

jest.mock('../firebase/FirebaseGroupOperations', () => ({
  createGroupConversation: jest.fn(async () => true),
  getGroupConversation: jest.fn(async () => null),
  updateGroupConversation: jest.fn(async () => true),
  addGroupMember: jest.fn(async () => true),
  removeGroupMember: jest.fn(async () => true),
  sendGroupMessage: (...args: unknown[]) => mockSendGroupMessage(...args),
  loadGroupMessages: jest.fn(async () => []),
  subscribeToGroupMessages: jest.fn(() => () => undefined),
  markGroupMessageRead: jest.fn(async () => true),
  subscribeToMyGroupConversations: jest.fn(() => () => undefined),
}));

import { groupChatService } from '../GroupChatService';

describe('GroupChatService senderUid compatibility', () => {
  beforeEach(() => {
    groupChatService.destroy();
    jest.clearAllMocks();
    mockGetAuth.mockReturnValue({
      currentUser: {
        uid: 'uid_test_sender',
        displayName: 'Test Kullanıcı',
      },
    });
    mockSendGroupMessage.mockResolvedValue(true);
    mockMeshBroadcastMessage.mockResolvedValue(undefined);
  });

  it('writes senderUid equal to auth uid for Firestore rules', async () => {
    const result = await groupChatService.sendMessage('grp_test', 'Merhaba');

    expect(result).not.toBeNull();
    expect(mockSendGroupMessage).toHaveBeenCalledTimes(1);

    const [, payload] = mockSendGroupMessage.mock.calls[0];
    expect((payload as { from: string }).from).toBe('uid_test_sender');
    expect((payload as { senderUid: string }).senderUid).toBe('uid_test_sender');
    expect((payload as { fromDeviceId: string }).fromDeviceId).toBe('mesh-test-001');
  });

  it('preserves media metadata in persisted group message payload', async () => {
    const result = await groupChatService.sendMessage('grp_test', '📷 Fotoğraf', {
      type: 'IMAGE',
      mediaType: 'image',
      mediaUrl: 'https://example.com/photo.jpg',
      mediaDuration: 12,
      location: { lat: 41.0082, lng: 28.9784, address: 'Istanbul' },
    });

    expect(result).not.toBeNull();
    expect(mockSendGroupMessage).toHaveBeenCalledTimes(1);

    const [, payload] = mockSendGroupMessage.mock.calls[0];
    const typedPayload = payload as {
      type: string;
      mediaType?: string;
      mediaUrl?: string;
      mediaDuration?: number;
      location?: { lat: number; lng: number; address?: string };
    };

    expect(typedPayload.type).toBe('IMAGE');
    expect(typedPayload.mediaType).toBe('image');
    expect(typedPayload.mediaUrl).toBe('https://example.com/photo.jpg');
    expect(typedPayload.mediaDuration).toBe(12);
    expect(typedPayload.location).toEqual({
      lat: 41.0082,
      lng: 28.9784,
      address: 'Istanbul',
    });
  });

  it('falls back to mesh when cloud write fails', async () => {
    mockSendGroupMessage.mockResolvedValue(false);
    mockMeshBroadcastMessage.mockResolvedValue(undefined);

    const result = await groupChatService.sendMessage('grp_test', 'Mesh fallback test');

    expect(result).not.toBeNull();
    expect(mockSendGroupMessage).toHaveBeenCalledTimes(1);
    expect(mockMeshBroadcastMessage).toHaveBeenCalledTimes(1);

    const [meshPayload] = mockMeshBroadcastMessage.mock.calls[0] as [string];
    const parsed = JSON.parse(meshPayload);
    expect(parsed.groupId).toBe('grp_test');
    expect(parsed.content).toBe('Merhaba');
  });

  it('does not lock initialization when auth is temporarily unavailable', () => {
    const firebaseGroupOps = jest.requireMock('../firebase/FirebaseGroupOperations') as {
      subscribeToMyGroupConversations: jest.Mock;
    };

    mockGetAuth.mockReturnValueOnce({ currentUser: null });
    groupChatService.initialize();
    expect(firebaseGroupOps.subscribeToMyGroupConversations).not.toHaveBeenCalled();

    groupChatService.initialize();
    expect(firebaseGroupOps.subscribeToMyGroupConversations).toHaveBeenCalledTimes(1);
  });

  it('returns null instead of throwing when auth is unavailable during send', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    const result = await groupChatService.sendMessage('grp_test', 'Merhaba');

    expect(result).toBeNull();
    expect(mockSendGroupMessage).not.toHaveBeenCalled();
    expect(mockMeshBroadcastMessage).not.toHaveBeenCalled();
  });
});
