describe('messageStore bootstrap hydration', () => {
  const OTHER_UID = 'otheruser1234567890123456789';
  const ME_UID = 'meuser1234567890123456789012';

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('hydrates persisted messages and conversations synchronously on first import', () => {
    jest.isolateModules(() => {
      const storage = new Map<string, string>();
      storage.set(
        `@afetnet:messages:user:${ME_UID}`,
        JSON.stringify([
          {
            id: 'boot-msg-1',
            from: OTHER_UID,
            to: ME_UID,
            content: 'Kalici mesaj',
            timestamp: 1710000000000,
            delivered: true,
            read: false,
            conversationId: 'conv-boot-1',
            status: 'delivered',
          },
        ]),
      );
      storage.set(
        `@afetnet:conversations:user:${ME_UID}`,
        JSON.stringify([
          {
            userId: OTHER_UID,
            userName: 'Kalici Kisi',
            lastMessage: 'Kalici mesaj',
            lastMessageTime: 1710000000000,
            unreadCount: 1,
            conversationId: 'conv-boot-1',
          },
        ]),
      );

      jest.doMock('../settingsStore', () => ({
        __esModule: true,
        useSettingsStore: {
          getState: jest.fn(() => ({ blockedUsers: [] })),
        },
      }));

      jest.doMock('../../services/IdentityService', () => ({
        __esModule: true,
        identityService: {
          getUid: jest.fn(() => ME_UID),
          getAliases: jest.fn(() => []),
          getMyId: jest.fn(() => ME_UID),
          resolveCanonicalPeerId: jest.fn((id) => id),
          getPeerDisplayName: jest.fn((id) => id),
          getIdentity: jest.fn(() => ({ uid: ME_UID })),
        },
      }));

      jest.doMock('../../utils/storage', () => ({
        DirectStorage: {
          getString: jest.fn((key: string) => storage.get(key) ?? null),
          setString: jest.fn((key: string, value: string) => storage.set(key, value)),
          delete: jest.fn((key: string) => storage.delete(key)),
          getBoolean: jest.fn(() => false),
        },
      }));

      jest.doMock('../../../lib/firebase', () => ({
        initializeFirebase: jest.fn(() => null),
      }));

      jest.doMock('firebase/auth', () => ({
        getAuth: jest.fn(() => ({ currentUser: null })),
      }));

      const { useMessageStore } = require('../messageStore') as typeof import('../messageStore');
      const state = useMessageStore.getState();

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].id).toBe('boot-msg-1');
      expect(state.conversations).toHaveLength(1);
      expect(state.conversations[0].conversationId).toBe('conv-boot-1');
      expect(state.conversationIndex.get(OTHER_UID.toLowerCase())?.[0].id).toBe('boot-msg-1');
    });
  });

  it('uses cached auth uid scope when firebase auth and identity are not ready yet', () => {
    jest.isolateModules(() => {
      const storage = new Map<string, string>();
      storage.set('afetnet_auth_cached_uid', ME_UID);
      storage.set(
        `@afetnet:messages:user:${ME_UID}`,
        JSON.stringify([
          {
            id: 'boot-msg-cached-uid',
            from: OTHER_UID,
            to: ME_UID,
            content: 'Cache UID ile acildi',
            timestamp: 1710000002000,
            delivered: true,
            read: false,
            conversationId: 'conv-cached-uid',
            status: 'delivered',
          },
        ]),
      );

      jest.doMock('../settingsStore', () => ({
        __esModule: true,
        useSettingsStore: {
          getState: jest.fn(() => ({ blockedUsers: [] })),
        },
      }));

      jest.doMock('../../services/IdentityService', () => ({
        __esModule: true,
        identityService: {
          getUid: jest.fn(() => null),
          getAliases: jest.fn(() => []),
          getMyId: jest.fn(() => null),
          resolveCanonicalPeerId: jest.fn((id) => id),
          getPeerDisplayName: jest.fn((id) => id),
          getIdentity: jest.fn(() => null),
        },
      }));

      jest.doMock('../../utils/storage', () => ({
        DirectStorage: {
          getString: jest.fn((key: string) => storage.get(key) ?? null),
          setString: jest.fn((key: string, value: string) => storage.set(key, value)),
          delete: jest.fn((key: string) => storage.delete(key)),
          getBoolean: jest.fn(() => false),
        },
      }));

      jest.doMock('../../../lib/firebase', () => ({
        initializeFirebase: jest.fn(() => null),
      }));

      jest.doMock('firebase/auth', () => ({
        getAuth: jest.fn(() => ({ currentUser: null })),
      }));

      const { useMessageStore } = require('../messageStore') as typeof import('../messageStore');
      const state = useMessageStore.getState();

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].id).toBe('boot-msg-cached-uid');
    });
  });

  it('flushes pending conversation previews before shutdown/background', async () => {
    const storage = new Map<string, string>();
    let useMessageStore: typeof import('../messageStore').useMessageStore;
    let flushPendingConversations: typeof import('../messageStore').flushPendingConversations;

    jest.isolateModules(() => {
      jest.doMock('../settingsStore', () => ({
        __esModule: true,
        useSettingsStore: {
          getState: jest.fn(() => ({ blockedUsers: [] })),
        },
      }));

      jest.doMock('../../services/IdentityService', () => ({
        __esModule: true,
        identityService: {
          getUid: jest.fn(() => ME_UID),
          getAliases: jest.fn(() => []),
          getMyId: jest.fn(() => ME_UID),
          resolveCanonicalPeerId: jest.fn((id) => id),
          getPeerDisplayName: jest.fn((id) => id),
          getIdentity: jest.fn(() => ({ uid: ME_UID })),
        },
      }));

      jest.doMock('../../utils/storage', () => ({
        DirectStorage: {
          getString: jest.fn((key: string) => storage.get(key) ?? null),
          setString: jest.fn((key: string, value: string) => storage.set(key, value)),
          delete: jest.fn((key: string) => storage.delete(key)),
          getBoolean: jest.fn(() => false),
        },
      }));

      jest.doMock('../../../lib/firebase', () => ({
        initializeFirebase: jest.fn(() => null),
      }));

      jest.doMock('firebase/auth', () => ({
        getAuth: jest.fn(() => ({ currentUser: null })),
      }));

      const storeModule = require('../messageStore') as typeof import('../messageStore');
      useMessageStore = storeModule.useMessageStore;
      flushPendingConversations = storeModule.flushPendingConversations;
    });

    await useMessageStore.getState().addConversation({
      userId: OTHER_UID,
      userName: 'Yeni Kisi',
      lastMessage: 'Liste aninda kaybolmasin',
      lastMessageTime: 1710000001000,
      unreadCount: 2,
      conversationId: 'conv-flush-1',
    });

    expect(storage.get(`@afetnet:conversations:user:${ME_UID}`)).toBeUndefined();

    flushPendingConversations();

    const persisted = JSON.parse(storage.get(`@afetnet:conversations:user:${ME_UID}`) || '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].conversationId).toBe('conv-flush-1');
    expect(persisted[0].lastMessage).toBe('Liste aninda kaybolmasin');
  });
});
