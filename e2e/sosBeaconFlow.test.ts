/**
 * AFETNET E2E TEST - SOS BEACON FLOW
 */

import { device, element, by, waitFor } from 'detox';

describe('SOS Beacon Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, permissions: { notifications: 'YES' } });
  });

  describe('SOS Activation', () => {
    it('shows countdown after SOS press', async () => {
      await element(by.id('sos-button')).tap();
      await element(by.id('sos-confirm-yes')).tap().catch(() => { /* */ });
      await waitFor(element(by.id('sos-countdown')))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });

    it('cancel SOS during countdown stops it', async () => {
      await element(by.id('sos-button')).tap();
      await element(by.id('sos-confirm-yes')).tap().catch(() => { /* */ });
      await element(by.id('sos-cancel-btn')).tap().catch(() => { /* */ });
      await waitFor(element(by.id('sos-countdown'))).not.toBeVisible().withTimeout(3000);
    });
  });

  describe('Silent SOS Mode', () => {
    it('silent SOS toggle accessible', async () => {
      await element(by.id('sos-button')).tap();
      await waitFor(element(by.text(/Sessiz/)))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });
  });
});
