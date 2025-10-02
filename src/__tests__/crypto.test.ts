import { MessageEncoder } from '../core/p2p/message';
import { sign, keyPair } from 'tweetnacl';

describe('MessageEncoder', () => {
  const testKeyPair = keyPair();
  const testMessage = {
    t: 0,
    id: 'test-message-id',
    ts: Date.now(),
    loc: {
      lat: 41.0082,
      lon: 28.9784,
      acc: 10,
    },
    prio: 1,
    flags: {
      underRubble: false,
      injured: true,
      anonymity: false,
    },
    ppl: 2,
    note: 'Test message',
    batt: 75,
    ttl: 6,
  };

  it('should encode and decode message correctly', () => {
    const encoded = MessageEncoder.encode(testMessage);
    const decoded = MessageEncoder.decode(encoded.data);
    
    expect(decoded).toEqual(testMessage);
  });

  it('should sign and verify message correctly', () => {
    const signedMessage = MessageEncoder.signMessage(testMessage, testKeyPair.secretKey);
    const isValid = MessageEncoder.verifyMessage(signedMessage, testKeyPair.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should reject invalid message data', () => {
    const invalidMessage = {
      ...testMessage,
      t: 999, // Invalid type
    };
    
    expect(() => MessageEncoder.encode(invalidMessage)).toThrow();
  });

  it('should create help request message correctly', () => {
    const helpRequest = MessageEncoder.createHelpRequest({
      id: 'help-123',
      lat: 41.0082,
      lon: 28.9784,
      accuracy: 10,
      priority: 2,
      underRubble: true,
      injured: true,
      peopleCount: 3,
      note: 'Emergency help needed',
      anonymity: false,
      ttl: 8,
    });
    
    expect(helpRequest.t).toBe(0);
    expect(helpRequest.prio).toBe(2);
    expect(helpRequest.flags.underRubble).toBe(true);
    expect(helpRequest.flags.injured).toBe(true);
  });
});