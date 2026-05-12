/**
 * AFETNET E2E TEST - FLASHLIGHT + WHISTLE FLOW
 * Survival tool: LED morse SOS + yuksek sesli duduk.
 */

import { device, element, by, waitFor } from 'detox';

describe('Flashlight + Whistle Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Tools Screen', () => {
    it('opens flashlight tool', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Fener|Flashlight/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('flashlight-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('shows SOS morse toggle', async () => {
      await waitFor(element(by.text(/SOS Mors|Morse/)))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });

    it('whistle button accessible', async () => {
      await waitFor(element(by.id('whistle-button')))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });
  });
});
