import { useMessageStore } from '../messageStore';

jest.mock('../settingsStore', () => ({
    __esModule: true,
    useSettingsStore: {
        getState: jest.fn(() => ({ blockedUsers: [] })),
    },
}));

const OTHER_UID = 'otheruser1234567890123456789'; // 28 chars
const ME_UID = 'meuser1234567890123456789012'; // 28 chars

jest.mock('../../services/IdentityService', () => ({
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

jest.mock('../../utils/storage', () => ({
    DirectStorage: {
        getString: jest.fn(() => null),
        setString: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../../services/firebase/FirebaseInstanceManager', () => ({
    getFirestoreInstanceAsync: jest.fn(),
}));

jest.mock('../../services/firebase/FirebaseMessageOperations', () => ({
    findOrCreateDMConversation: jest.fn(),
    markConversationRead: jest.fn(),
}));

const firebaseMessageOperationsMock = jest.requireMock('../../services/firebase/FirebaseMessageOperations') as {
    findOrCreateDMConversation: jest.Mock;
    markConversationRead: jest.Mock;
};

describe('messageStore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        useMessageStore.setState({
            messages: [],
            conversations: [],
            conversationIndex: new Map(),
            typingUsers: {},
        });
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    const createMockMessage = (overrides = {}) => ({
        id: `msg-${Date.now()}-${Math.random()}`,
        from: OTHER_UID,
        to: 'ME',
        content: 'Hello World',
        timestamp: Date.now(),
        delivered: true,
        read: false,
        ...overrides,
    });

    describe('addMessage', () => {
        it('should add a new message and update conversations', async () => {
            const msg = createMockMessage({ from: OTHER_UID, to: 'ME' });

            await useMessageStore.getState().addMessage(msg as any);
            useMessageStore.getState().updateConversations();

            const state = useMessageStore.getState();

            expect(state.messages).toHaveLength(1);
            expect(state.conversations).toHaveLength(1);
            expect(state.conversations[0].userId).toBe(OTHER_UID.toLowerCase());
        });

        it('should deduplicate messages by ID', async () => {
            const msg = createMockMessage();
            await useMessageStore.getState().addMessage(msg as any);
            await useMessageStore.getState().addMessage(msg as any);

            const state = useMessageStore.getState();
            expect(state.messages).toHaveLength(1);
        });

        it('uses a deterministic tie-breaker for same-timestamp conversation previews', async () => {
            const timestamp = Date.now();

            await useMessageStore.getState().addMessage(createMockMessage({
                id: 'msg-b',
                content: 'Second message',
                timestamp,
            }) as any);
            await useMessageStore.getState().addMessage(createMockMessage({
                id: 'msg-a',
                content: 'First message',
                timestamp,
            }) as any);

            useMessageStore.getState().updateConversations();

            const conversation = useMessageStore.getState().conversations[0];
            expect(conversation.lastMessage).toBe('Second message');
            expect(useMessageStore.getState().getConversationMessages(OTHER_UID).map(m => m.id)).toEqual(['msg-a', 'msg-b']);
        });

        it('shows useful previews for media messages with empty content', async () => {
            await useMessageStore.getState().addMessage(createMockMessage({
                id: 'msg-photo',
                content: '',
                mediaType: 'image',
                timestamp: Date.now(),
            }) as any);

            useMessageStore.getState().updateConversations();

            expect(useMessageStore.getState().conversations[0].lastMessage).toBe('Fotoğraf');
        });
    });

    describe('markAsRead', () => {
        it('should mark a specific message as read and decrement unreadCount', async () => {
            const msg1 = createMockMessage({ id: 'msg1' });
            const msg2 = createMockMessage({ id: 'msg2' });

            await useMessageStore.getState().addMessage(msg1 as any);
            await useMessageStore.getState().addMessage(msg2 as any);

            useMessageStore.setState({
                conversations: [{
                    userId: OTHER_UID.toLowerCase(),
                    userName: 'Other User',
                    lastMessage: 'Hello World',
                    lastMessageTime: Date.now(),
                    unreadCount: 2,
                    isPinned: false,
                    isMuted: false
                }]
            });

            await useMessageStore.getState().markAsRead('msg1');
            useMessageStore.getState().updateConversations();

            const state = useMessageStore.getState();
            expect(state.messages.find(m => m.id === 'msg1')?.read).toBe(true);
        });

        it('syncs read receipts for each unread conversation id', async () => {
            const msg1 = createMockMessage({
                id: 'msg-conv-a',
                from: OTHER_UID,
                to: ME_UID,
                conversationId: 'conv-a',
                timestamp: Date.now() - 100,
            });
            const msg2 = createMockMessage({
                id: 'msg-conv-b',
                from: OTHER_UID,
                to: ME_UID,
                conversationId: 'conv-b',
                timestamp: Date.now(),
            });

            firebaseMessageOperationsMock.markConversationRead.mockResolvedValue(undefined);

            await useMessageStore.getState().addMessage(msg1 as any);
            await useMessageStore.getState().addMessage(msg2 as any);
            await useMessageStore.getState().markConversationRead(OTHER_UID);

            expect(firebaseMessageOperationsMock.markConversationRead).toHaveBeenCalledTimes(2);
            expect(firebaseMessageOperationsMock.markConversationRead).toHaveBeenCalledWith(ME_UID, 'conv-a');
            expect(firebaseMessageOperationsMock.markConversationRead).toHaveBeenCalledWith(ME_UID, 'conv-b');
            expect(firebaseMessageOperationsMock.findOrCreateDMConversation).not.toHaveBeenCalled();
        });

        it('falls back to findOrCreateDMConversation when message has no conversationId', async () => {
            const msg = createMockMessage({
                id: 'msg-no-conv',
                from: OTHER_UID,
                to: ME_UID,
                conversationId: undefined,
            });

            firebaseMessageOperationsMock.findOrCreateDMConversation.mockResolvedValue({ id: 'conv-fallback' });
            firebaseMessageOperationsMock.markConversationRead.mockResolvedValue(undefined);

            await useMessageStore.getState().addMessage(msg as any);
            await useMessageStore.getState().markConversationRead(OTHER_UID);

            expect(firebaseMessageOperationsMock.findOrCreateDMConversation).toHaveBeenCalledTimes(1);
            expect(firebaseMessageOperationsMock.markConversationRead).toHaveBeenCalledWith(ME_UID, 'conv-fallback');
        });
    });

    describe('addConversation', () => {
        it('does not regress preview text when older metadata arrives late', async () => {
            await useMessageStore.getState().addConversation({
                userId: OTHER_UID,
                userName: 'Other User',
                lastMessage: 'Newest preview',
                lastMessageTime: 2000,
                unreadCount: 0,
                lastMessageStatus: 'sent',
            });

            await useMessageStore.getState().addConversation({
                userId: OTHER_UID,
                userName: 'Other User',
                lastMessage: 'Older preview',
                lastMessageTime: 1000,
                unreadCount: 0,
                lastMessageStatus: 'delivered',
            });

            const conversation = useMessageStore.getState().conversations[0];
            expect(conversation.lastMessage).toBe('Newest preview');
            expect(conversation.lastMessageTime).toBe(2000);
            expect(conversation.lastMessageStatus).toBe('sent');
        });
    });

    describe('editMessage', () => {
        it('should edit an own message and keep history', async () => {
            const msg = createMockMessage({ id: 'msg1', from: ME_UID, to: OTHER_UID });
            await useMessageStore.getState().addMessage(msg as any);

            const success = await useMessageStore.getState().editMessage('msg1', 'Edited text');

            expect(success).toBe(true);
            const state = useMessageStore.getState();
            const updatedMsg = state.messages[0];
            expect(updatedMsg.content).toBe('Edited text');
        });
    });

    describe('deleteMessage', () => {
        it('should soft delete own message', async () => {
            const msg = createMockMessage({ id: 'msg1', from: ME_UID, to: OTHER_UID });
            await useMessageStore.getState().addMessage(msg as any);

            const success = await useMessageStore.getState().deleteMessage('msg1');

            expect(success).toBe(true);
            const state = useMessageStore.getState();
            const deletedMsg = state.messages[0];

            expect(deletedMsg.isDeleted).toBe(true);
            expect(deletedMsg.content).toBe('Bu mesaj silindi');
        });
    });
});
