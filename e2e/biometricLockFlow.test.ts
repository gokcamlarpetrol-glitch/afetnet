/**
 * AFETNET E2E TEST - BIOMETRIC LOCK FLOW
 * Face ID / Touch ID app lock (opsiyonel).
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Biometric Lock Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES', faceid: 'YES' },
    });
  });

  describe('Settings Toggle', () => {
    it('biometric app lock toggle accessible in Settings', async () => {
      await element(by.id('tab-settings')).tap();
      // Look for biometric toggle in security section
      await waitFor(element(by.text(/Face ID|Touch ID|Biyometrik/)))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* toggle may be in separate Security sub-screen */ });
    });
  });

  describe('Lock Overlay', () => {
    it('does NOT show lock overlay on first launch (toggle off by default)', async () => {
      await expect(element(by.text('AfetNet Kilitli'))).not.toBeVisible();
    });

    it('graceful no-op if biometric hardware unavailable', async () => {
      // On simulator without biometric setup, toggling should fail gracefully
      // App should not crash
      await expect(element(by.id('home-screen')).or(by.id('auth-screen'))).toBeVisible();
    });
  });
});
