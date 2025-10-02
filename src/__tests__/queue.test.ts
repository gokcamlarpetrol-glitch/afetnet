import { MessageQueue } from '../core/p2p/queue';
import { MessageEncoder } from '../core/p2p/message';

describe('MessageQueue', () => {
  let messageQueue: MessageQueue;

  beforeEach(() => {
    messageQueue = MessageQueue.getInstance();
  });

  afterEach(async () => {
    await messageQueue.clearAll();
  });

  it('should enqueue and dequeue messages correctly', async () => {
    const testMessage = MessageEncoder.createStatusPing({
      id: 'test-ping-1',
      lat: 41.0082,
      lon: 28.9784,
      accuracy: 10,
    });

    await messageQueue.enqueue(testMessage, 1);
    expect(messageQueue.getQueueLength()).toBe(1);

    const dequeuedMessage = await messageQueue.dequeue();
    expect(dequeuedMessage).not.toBeNull();
    expect(dequeuedMessage?.data.id).toBe('test-ping-1');
  });

  it('should handle TTL expiration correctly', async () => {
    const testMessage = MessageEncoder.createStatusPing({
      id: 'test-ping-expired',
      lat: 41.0082,
      lon: 28.9784,
      accuracy: 10,
    });

    // Set very short TTL
    testMessage.ttl = 0;
    
    await messageQueue.enqueue(testMessage, 0);
    
    // Wait a bit to ensure expiration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dequeuedMessage = await messageQueue.dequeue();
    expect(dequeuedMessage).toBeNull();
  });

  it('should prevent duplicate messages', async () => {
    const testMessage = MessageEncoder.createStatusPing({
      id: 'duplicate-test',
      lat: 41.0082,
      lon: 28.9784,
      accuracy: 10,
    });

    await messageQueue.enqueue(testMessage, 0);
    await messageQueue.enqueue(testMessage, 0); // Same message again
    
    expect(messageQueue.getQueueLength()).toBe(1);
  });

  it('should prioritize messages correctly', async () => {
    const lowPriorityMessage = MessageEncoder.createStatusPing({
      id: 'low-priority',
      lat: 41.0082,
      lon: 28.9784,
      accuracy: 10,
    });

    const highPriorityMessage = MessageEncoder.createHelpRequest({
      id: 'high-priority',
      lat: 41.0082,
      lon: 28.9784,
      accuracy: 10,
      priority: 2,
      underRubble: true,
      injured: true,
      peopleCount: 1,
      anonymity: false,
      ttl: 8,
    });

    await messageQueue.enqueue(lowPriorityMessage, 0);
    await messageQueue.enqueue(highPriorityMessage, 2);

    const firstDequeued = await messageQueue.dequeue();
    expect(firstDequeued?.data.id).toBe('high-priority');
  });

  it('should clear expired messages', async () => {
    const testMessage = MessageEncoder.createStatusPing({
      id: 'expired-message',
      lat: 41.0082,
      lon: 28.9784,
      accuracy: 10,
    });

    testMessage.ttl = 0;
    await messageQueue.enqueue(testMessage, 0);
    
    const clearedCount = await messageQueue.clearExpiredMessages();
    expect(clearedCount).toBe(1);
    expect(messageQueue.getQueueLength()).toBe(0);
  });
});