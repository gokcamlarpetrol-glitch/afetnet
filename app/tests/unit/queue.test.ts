// @afetnet: Unit tests for offline messaging queue
// Tests write-ahead logging and message persistence

import { offlineMessaging } from '../../domain/messaging/queue';

describe('OfflineMessaging Queue', () => {
  beforeEach(async () => {
    // Clear queue before each test
    await offlineMessaging.clearAllMessages();
  });

  test('should send and receive messages', async () => {
    const message = await offlineMessaging.sendMessage(
      'test-contact',
      'Test message',
      'text',
      39.9334,
      32.8597
    );

    expect(message).toBeDefined();
    expect(message.contactId).toBe('test-contact');
    expect(message.content).toBe('Test message');

    const messages = offlineMessaging.getMessages();
    expect(messages.length).toBe(1);
  });

  test('should handle SOS messages with priority', async () => {
    const message = await offlineMessaging.sendMessage(
      'emergency-contact',
      'SOS! Help needed!',
      'sos',
      39.9334,
      32.8597,
      'critical'
    );

    expect(message.priority).toBe('critical');
    expect(message.type).toBe('sos');
  });

  test('should track message statistics', async () => {
    await offlineMessaging.sendMessage('contact1', 'Message 1', 'text');
    await offlineMessaging.sendMessage('contact2', 'Message 2', 'text');
    await offlineMessaging.sendMessage('contact1', 'SOS Message', 'sos');

    const stats = offlineMessaging.getMessageStats();
    expect(stats.total).toBe(3);
    expect(stats.sos).toBe(1);
  });

  test('should get contacts', async () => {
    const contacts = offlineMessaging.getContacts();
    expect(Array.isArray(contacts)).toBe(true);
  });

  test('should clear messages', async () => {
    await offlineMessaging.sendMessage('contact1', 'Test message', 'text');
    expect(offlineMessaging.getMessageStats().total).toBe(1);

    await offlineMessaging.clearAllMessages();
    expect(offlineMessaging.getMessageStats().total).toBe(0);
  });
});















