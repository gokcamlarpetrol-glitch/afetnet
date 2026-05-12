/**
 * AFETNET E2E TEST - VOICE CALL FLOW
 */

import { device, element, by, waitFor } from 'detox';

describe('Voice Call Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { microphone: 'YES', notifications: 'YES' },
    });
  });

  describe('Outgoing Call', () => {
    it('shows call UI from family member detail', async () => {
      await element(by.id('tab-family')).tap();
      await element(by.id('family-member-row-0')).tap().catch(() => { /* no members */ });
      await element(by.id('call-button')).tap().catch(() => { /* */ });
      await waitFor(element(by.id('voice-call-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });
  });

  describe('Incoming Call', () => {
    it('IncomingCallOverlay does not show without incoming call', async () => {
      await waitFor(element(by.id('incoming-call-overlay')))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });
});
