import { MessageQueue } from '../core/p2p/queue';

describe('TTL (Time To Live) Tests', () => {
  let messageQueue: MessageQueue;

  beforeEach(async () => {
    messageQueue = MessageQueue.getInstance();
    await messageQueue.initialize();
    messageQueue.clear();
  });

  afterEach(() => {
    messageQueue.clear();
  });

  describe('Message TTL Behavior', () => {
    test('should expire messages after TTL period', async () => {
      const message = {
        t: 'HELP' as const,
        id: 'test_message_1',
        ts: Date.now() - 7 * 60 * 60 * 1000, // 7 hours ago
        loc: [41.0082, 28.9784, 10] as [number, number, number],
        prio: 0,
        flags: { rubble: true, injury: false },
        ppl: 1,
        note: 'Test message',
        ttl: 6, // 6 hours TTL
        sig: 'test_signature',
      };

      // Enqueue message
      await messageQueue.enqueue(message, 0, 6);

      // Try to dequeue - should return null as message is expired
      const dequeuedMessage = await messageQueue.dequeue();
      expect(dequeuedMessage).toBeNull();
    });

    test('should not expire messages within TTL period', async () => {
      const message = {
        t: 'SAFE' as const,
        id: 'test_message_2',
        ts: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        loc: [41.0082, 28.9784, 10] as [number, number, number],
        note: 'Safe message',
        ttl: 6, // 6 hours TTL
        sig: 'test_signature',
      };

      // Enqueue message
      await messageQueue.enqueue(message, 0, 6);

      // Try to dequeue - should return the message as it's not expired
      const dequeuedMessage = await messageQueue.dequeue();
      expect(dequeuedMessage).not.toBeNull();
      expect(dequeuedMessage?.payload.id).toBe('test_message_2');
    });

    test('should handle different TTL values', async () => {
      const messages = [
        {
          t: 'PING' as const,
          id: 'ping_message',
          ts: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
          loc: [41.0082, 28.9784, 10] as [number, number, number],
          ttl: 1, // 1 hour TTL - should be expired
          sig: 'test_signature',
        },
        {
          t: 'HELP' as const,
          id: 'help_message',
          ts: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
          loc: [41.0082, 28.9784, 10] as [number, number, number],
          prio: 0,
          flags: { rubble: true, injury: false },
          ppl: 1,
          note: 'Help message',
          ttl: 24, // 24 hours TTL - should not be expired
          sig: 'test_signature',
        },
      ];

      // Enqueue both messages
      for (const message of messages) {
        await messageQueue.enqueue(message, 0, message.ttl);
      }

      // Dequeue messages
      const dequeuedMessages: any[] = [];
      let message = await messageQueue.dequeue();
      while (message) {
        dequeuedMessages.push(message);
        message = await messageQueue.dequeue();
      }

      // Only the help message should be returned (ping should be expired)
      expect(dequeuedMessages).toHaveLength(1);
      expect(dequeuedMessages[0].payload.id).toBe('help_message');
    });

    test('should respect maximum TTL limit', async () => {
      const message = {
        t: 'HELP' as const,
        id: 'test_message_3',
        ts: Date.now(),
        loc: [41.0082, 28.9784, 10] as [number, number, number],
        prio: 0,
        flags: { rubble: true, injury: false },
        ppl: 1,
        note: 'Test message with long TTL',
        ttl: 100, // Very long TTL (should be capped)
        sig: 'test_signature',
      };

      // Enqueue with long TTL
      await messageQueue.enqueue(message, 0, 100);

      // Message should still be dequeuable
      const dequeuedMessage = await messageQueue.dequeue();
      expect(dequeuedMessage).not.toBeNull();
      expect(dequeuedMessage?.ttl).toBe(100);
    });

    test('should handle zero TTL', async () => {
      const message = {
        t: 'PING' as const,
        id: 'test_message_4',
        ts: Date.now(),
        loc: [41.0082, 28.9784, 10] as [number, number, number],
        ttl: 0, // Zero TTL
        sig: 'test_signature',
      };

      // Enqueue with zero TTL
      await messageQueue.enqueue(message, 0, 0);

      // Message should be expired immediately
      const dequeuedMessage = await messageQueue.dequeue();
      expect(dequeuedMessage).toBeNull();
    });

    test('should handle negative TTL', async () => {
      const message = {
        t: 'PING' as const,
        id: 'test_message_5',
        ts: Date.now(),
        loc: [41.0082, 28.9784, 10] as [number, number, number],
        ttl: -1, // Negative TTL
        sig: 'test_signature',
      };

      // Enqueue with negative TTL
      await messageQueue.enqueue(message, 0, -1);

      // Message should be expired immediately
      const dequeuedMessage = await messageQueue.dequeue();
      expect(dequeuedMessage).toBeNull();
    });
  });

  describe('TTL Edge Cases', () => {
    test('should handle messages with very small TTL', async () => {
      const message = {
        t: 'PING' as const,
        id: 'test_message_6',
        ts: Date.now() - 1000, // 1 second ago
        loc: [41.0082, 28.9784, 10] as [number, number, number],
        ttl: 0.001, // Very small TTL (less than 1 hour)
        sig: 'test_signature',
      };

      // Enqueue message
      await messageQueue.enqueue(message, 0, 0.001);

      // Message should be expired
      const dequeuedMessage = await messageQueue.dequeue();
      expect(dequeuedMessage).toBeNull();
    });

    test('should handle TTL calculation with different time units', async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      const messages = [
        {
          t: 'HELP' as const,
          id: 'message_1',
          ts: oneHourAgo,
          loc: [41.0082, 28.9784, 10] as [number, number, number],
          prio: 0,
          flags: { rubble: true, injury: false },
          ppl: 1,
          note: '1 hour ago',
          ttl: 2, // 2 hours TTL - should not be expired
          sig: 'test_signature',
        },
        {
          t: 'HELP' as const,
          id: 'message_2',
          ts: twoHoursAgo,
          loc: [41.0082, 28.9784, 10] as [number, number, number],
          prio: 0,
          flags: { rubble: true, injury: false },
          ppl: 1,
          note: '2 hours ago',
          ttl: 1, // 1 hour TTL - should be expired
          sig: 'test_signature',
        },
      ];

      // Enqueue both messages
      for (const message of messages) {
        await messageQueue.enqueue(message, 0, message.ttl);
      }

      // Dequeue messages
      const dequeuedMessages: any[] = [];
      let message = await messageQueue.dequeue();
      while (message) {
        dequeuedMessages.push(message);
        message = await messageQueue.dequeue();
      }

      // Only the first message should be returned
      expect(dequeuedMessages).toHaveLength(1);
      expect(dequeuedMessages[0].payload.id).toBe('message_1');
    });
  });

  describe('TTL with Message Types', () => {
    test('should apply appropriate TTL for different message types', async () => {
      const messageTypes = [
        { type: 'PING' as const, ttl: 1, expectedDequeue: false },
        { type: 'SAFE' as const, ttl: 6, expectedDequeue: true },
        { type: 'HELP' as const, ttl: 24, expectedDequeue: true },
        { type: 'RES' as const, ttl: 12, expectedDequeue: true },
      ];

      const baseTime = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago

      for (const { type, ttl, expectedDequeue } of messageTypes) {
        const message = {
          t: type,
          id: `${type}_message`,
          ts: baseTime,
          loc: [41.0082, 28.9784, 10] as [number, number, number],
          note: `${type} message`,
          ttl,
          sig: 'test_signature',
        };

        // Add type-specific fields
        if (type === 'HELP') {
          (message as any).prio = 0;
          (message as any).flags = { rubble: true, injury: false };
          (message as any).ppl = 1;
        }

        await messageQueue.enqueue(message, 0, ttl);
      }

      // Dequeue all messages
      const dequeuedMessages: any[] = [];
      let message = await messageQueue.dequeue();
      while (message) {
        dequeuedMessages.push(message);
        message = await messageQueue.dequeue();
      }

      // Check that only messages with TTL > 3 hours are dequeued
      const dequeuedTypes = dequeuedMessages.map(msg => msg.payload.t);
      expect(dequeuedTypes).toContain('SAFE');
      expect(dequeuedTypes).toContain('HELP');
      expect(dequeuedTypes).toContain('RES');
      expect(dequeuedTypes).not.toContain('PING');
    });
  });
});