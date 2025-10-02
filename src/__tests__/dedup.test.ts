import { MessageDeduplicator } from '../core/p2p/dedup';

describe('MessageDeduplicator', () => {
  let deduplicator: MessageDeduplicator;

  beforeEach(async () => {
    deduplicator = MessageDeduplicator.getInstance();
    await deduplicator.initialize();
    deduplicator.clear();
  });

  afterEach(() => {
    deduplicator.clear();
  });

  describe('Duplicate Detection', () => {
    test('should detect new messages as not duplicate', () => {
      const messageId = 'test_message_1';
      const isDuplicate = deduplicator.isDuplicate(messageId);

      expect(isDuplicate).toBe(false);
    });

    test('should detect repeated messages as duplicate', () => {
      const messageId = 'test_message_2';
      
      // First time should not be duplicate
      const firstCheck = deduplicator.isDuplicate(messageId);
      expect(firstCheck).toBe(false);

      // Second time should be duplicate
      const secondCheck = deduplicator.isDuplicate(messageId);
      expect(secondCheck).toBe(true);
    });

    test('should handle multiple unique messages', () => {
      const messages = ['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5'];

      messages.forEach(messageId => {
        const isDuplicate = deduplicator.isDuplicate(messageId);
        expect(isDuplicate).toBe(false);
      });

      // All should be marked as seen
      messages.forEach(messageId => {
        const isDuplicate = deduplicator.isDuplicate(messageId);
        expect(isDuplicate).toBe(true);
      });
    });

    test('should handle mark as seen explicitly', () => {
      const messageId = 'test_message_3';
      
      // Mark as seen
      deduplicator.markAsSeen(messageId);
      
      // Should now be detected as duplicate
      const isDuplicate = deduplicator.isDuplicate(messageId);
      expect(isDuplicate).toBe(true);
    });
  });

  describe('LRU Cache Behavior', () => {
    test('should maintain LRU order', () => {
      const messages = ['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5'];

      // Add messages
      messages.forEach(messageId => {
        deduplicator.isDuplicate(messageId);
      });

      // All should be duplicates now
      messages.forEach(messageId => {
        const isDuplicate = deduplicator.isDuplicate(messageId);
        expect(isDuplicate).toBe(true);
      });
    });

    test('should handle cache size limits', () => {
      const maxSize = 5000;
      const messages = Array.from({ length: maxSize + 100 }, (_, i) => `msg_${i}`);

      // Add messages beyond cache size
      messages.forEach(messageId => {
        deduplicator.isDuplicate(messageId);
      });

      // Cache should still work
      const stats = deduplicator.getStats();
      expect(stats.lruSize).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Bloom Filter Behavior', () => {
    test('should handle large number of messages', () => {
      const messageCount = 1000;
      const messages = Array.from({ length: messageCount }, (_, i) => `bloom_msg_${i}`);

      // Add all messages
      messages.forEach(messageId => {
        deduplicator.isDuplicate(messageId);
      });

      // Check some random messages are duplicates
      const sampleMessages = messages.slice(0, 10);
      sampleMessages.forEach(messageId => {
        const isDuplicate = deduplicator.isDuplicate(messageId);
        expect(isDuplicate).toBe(true);
      });
    });

    test('should have reasonable false positive rate', () => {
      const messageCount = 5000;
      const messages = Array.from({ length: messageCount }, (_, i) => `false_positive_test_${i}`);

      // Add messages
      messages.forEach(messageId => {
        deduplicator.isDuplicate(messageId);
      });

      // Check stats
      const stats = deduplicator.getStats();
      expect(stats.estimatedFalsePositiveRate).toBeLessThan(0.1); // Should be less than 10%
    });
  });

  describe('Statistics', () => {
    test('should provide accurate statistics', () => {
      const messages = ['stat_msg_1', 'stat_msg_2', 'stat_msg_3'];

      // Add messages
      messages.forEach(messageId => {
        deduplicator.isDuplicate(messageId);
      });

      const stats = deduplicator.getStats();

      expect(stats.lruSize).toBeGreaterThanOrEqual(0);
      expect(stats.bloomFilterSize).toBeGreaterThan(0);
      expect(stats.estimatedFalsePositiveRate).toBeGreaterThanOrEqual(0);
      expect(stats.estimatedFalsePositiveRate).toBeLessThan(1);
    });

    test('should update statistics after operations', () => {
      const initialStats = deduplicator.getStats();
      
      const messageId = 'stats_test_message';
      deduplicator.isDuplicate(messageId);
      
      const updatedStats = deduplicator.getStats();
      
      expect(updatedStats.lruSize).toBeGreaterThanOrEqual(initialStats.lruSize);
      expect(updatedStats.bloomFilterSize).toBeGreaterThanOrEqual(initialStats.bloomFilterSize);
    });
  });

  describe('Cleanup Operations', () => {
    test('should clear all data', () => {
      const messages = ['clear_msg_1', 'clear_msg_2', 'clear_msg_3'];

      // Add messages
      messages.forEach(messageId => {
        deduplicator.isDuplicate(messageId);
      });

      // Verify they are duplicates
      messages.forEach(messageId => {
        expect(deduplicator.isDuplicate(messageId)).toBe(true);
      });

      // Clear
      deduplicator.clear();

      // Should not be duplicates anymore
      messages.forEach(messageId => {
        expect(deduplicator.isDuplicate(messageId)).toBe(false);
      });

      // Stats should be reset
      const stats = deduplicator.getStats();
      expect(stats.lruSize).toBe(0);
      expect(stats.bloomFilterSize).toBe(0);
    });

    test('should handle periodic cleanup', () => {
      // This test would require time manipulation in a real scenario
      // For now, just verify the method exists and can be called
      expect(() => {
        deduplicator.startPeriodicCleanup(1000);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty message ID', () => {
      const isDuplicate = deduplicator.isDuplicate('');
      expect(isDuplicate).toBe(false);
    });

    test('should handle very long message ID', () => {
      const longMessageId = 'a'.repeat(1000);
      const isDuplicate = deduplicator.isDuplicate(longMessageId);
      expect(isDuplicate).toBe(false);
    });

    test('should handle special characters in message ID', () => {
      const specialMessageId = 'msg_with_特殊字符_and_symbols!@#$%^&*()';
      const isDuplicate = deduplicator.isDuplicate(specialMessageId);
      expect(isDuplicate).toBe(false);
    });

    test('should handle concurrent operations', () => {
      const messages = Array.from({ length: 100 }, (_, i) => `concurrent_msg_${i}`);

      // Simulate concurrent operations
      messages.forEach(messageId => {
        deduplicator.isDuplicate(messageId);
      });

      // All should be duplicates
      messages.forEach(messageId => {
        expect(deduplicator.isDuplicate(messageId)).toBe(true);
      });
    });
  });
});