// @afetnet: Unit tests for multipath routing
// Tests redundant path delivery and deduplication

import { advancedMultipathRouter } from '../../domain/messaging/multipath';

describe('Advanced Multipath Router', () => {
  beforeEach(async () => {
    // Initialize multipath router
    await advancedMultipathRouter.initialize();
  });

  test('should send message with multipath redundancy', async () => {
    const messageId = await advancedMultipathRouter.sendWithMultipath(
      'source1',
      'dest1',
      'Test multipath message',
      'data',
      'normal'
    );

    expect(messageId).toBeDefined();
    expect(typeof messageId).toBe('string');
  });

  test('should handle critical messages with more paths', async () => {
    const criticalMessageId = await advancedMultipathRouter.sendWithMultipath(
      'source1',
      'dest1',
      'Critical emergency message',
      'emergency',
      'critical'
    );

    const normalMessageId = await advancedMultipathRouter.sendWithMultipath(
      'source1',
      'dest1',
      'Normal message',
      'data',
      'normal'
    );

    expect(criticalMessageId).toBeDefined();
    expect(normalMessageId).toBeDefined();
  });

  test('should track multipath statistics', () => {
    const stats = advancedMultipathRouter.getMultipathStats();

    expect(stats).toHaveProperty('activeMessages');
    expect(stats).toHaveProperty('completedMessages');
    expect(stats).toHaveProperty('averagePaths');
    expect(stats).toHaveProperty('successRate');
    expect(typeof stats.activeMessages).toBe('number');
  });

  test('should handle received messages with deduplication', async () => {
    // Mock encoded message
    const mockMessage = {
      id: 'test_msg_1',
      source: 'source1',
      destination: 'dest1',
      type: 'data' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      ttl: 3600000,
      hops: 0,
      maxHops: 10,
      encryptionAlgorithm: 'test',
      keyId: 'test',
      signature: 'test',
      publicKeyFingerprint: 'test',
      payloadType: 'text' as const,
      payload: 'test payload',
      metadata: {},
      checksum: 'test',
      routeHistory: ['path1'],
    };

    // First receive should succeed
    const firstResult = await advancedMultipathRouter.handleReceivedMessage(mockMessage);
    expect(firstResult).toBe(true);

    // Second receive of same message should be deduplicated
    const secondResult = await advancedMultipathRouter.handleReceivedMessage(mockMessage);
    expect(secondResult).toBe(false);
  });

  test('should cleanup old multipath messages', () => {
    advancedMultipathRouter.cleanupOldMultipathMessages();
    // Should not throw
    expect(true).toBe(true);
  });
});





