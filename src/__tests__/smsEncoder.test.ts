import { SMSEncoder } from '../core/logic/sms';

describe('SMSEncoder', () => {
  const testMessage = {
    t: 0,
    id: 'test-message-123',
    ts: Date.now(),
    loc: {
      lat: 41.0082,
      lon: 28.9784,
      acc: 10,
    },
    prio: 2,
    flags: {
      underRubble: true,
      injured: true,
      anonymity: false,
    },
    ppl: 3,
    note: 'Emergency help needed',
    batt: 75,
    ttl: 8,
  };

  it('should encode and decode SMS message correctly', () => {
    const encoded = SMSEncoder.encodeMessage(testMessage);
    const decoded = SMSEncoder.decodeMessage(encoded);
    
    expect(decoded).toEqual(testMessage);
  });

  it('should handle messages without optional fields', () => {
    const minimalMessage = {
      t: 1,
      id: 'minimal-message',
      ts: Date.now(),
      loc: {
        lat: 41.0082,
        lon: 28.9784,
        acc: 10,
      },
      prio: 0,
      flags: {
        underRubble: false,
        injured: false,
        anonymity: false,
      },
      ppl: 1,
      ttl: 3,
    };

    const encoded = SMSEncoder.encodeMessage(minimalMessage);
    const decoded = SMSEncoder.decodeMessage(encoded);
    
    expect(decoded).toEqual(minimalMessage);
  });

  it('should reject messages that are too long', () => {
    const longMessage = {
      ...testMessage,
      note: 'This is a very long note that exceeds the maximum allowed length for SMS messages and should be truncated or rejected',
    };

    expect(() => SMSEncoder.encodeMessage(longMessage)).toThrow();
  });

  it('should create emergency SMS correctly', () => {
    const emergencySMS = SMSEncoder.createEmergencySMS(testMessage);
    
    expect(emergencySMS).toContain('AFETNET Emergency Alert');
    expect(emergencySMS).toContain('Priority: Critical');
    expect(emergencySMS).toContain('INJURED');
    expect(emergencySMS).toContain('UNDER RUBBLE');
    expect(emergencySMS).toContain('People: 3');
  });

  it('should create status SMS correctly', () => {
    const statusSMS = SMSEncoder.createStatusSMS(testMessage);
    
    expect(statusSMS).toContain('AFETNET Status Update');
    expect(statusSMS).toContain('Status: Safe');
    expect(statusSMS).toContain('Battery: 75%');
  });

  it('should create resource SMS correctly', () => {
    const resourceSMS = SMSEncoder.createResourceSMS(testMessage);
    
    expect(resourceSMS).toContain('AFETNET Resource Available');
    expect(resourceSMS).toContain('Resources: Emergency help needed');
  });

  it('should split long messages correctly', () => {
    const longMessage = 'A'.repeat(200); // Longer than SMS limit
    
    const parts = SMSEncoder.splitLongMessage(longMessage);
    
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toContain('(1/');
    expect(parts[1]).toContain('(2/');
  });

  it('should not split short messages', () => {
    const shortMessage = 'Short message';
    
    const parts = SMSEncoder.splitLongMessage(shortMessage);
    
    expect(parts.length).toBe(1);
    expect(parts[0]).toBe(shortMessage);
  });

  it('should validate message length correctly', () => {
    const shortMessage = 'Short';
    const longMessage = 'A'.repeat(200);
    
    expect(SMSEncoder.isMessageTooLong(shortMessage)).toBe(false);
    expect(SMSEncoder.isMessageTooLong(longMessage)).toBe(true);
  });
});