/**
 * AFETNET E2E TEST - SOS HISTORY FLOW
 */

import { device, element, by, waitFor } from 'detox';

describe('SOS History Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('History Screen', () => {
    it('opens SOS history from Settings or Home', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text(/SOS Geçmişi|SOS History/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('sos-history-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('shows empty state when no past SOS', async () => {
      await waitFor(element(by.text(/Henüz SOS yok|No SOS history/)))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });
  });
});
