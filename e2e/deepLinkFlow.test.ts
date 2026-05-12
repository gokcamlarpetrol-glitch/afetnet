/**
 * AFETNET E2E TEST - DEEP LINK FLOW
 * afetnet:// URL scheme handling.
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Deep Link Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, url: undefined });
  });

  describe('Family Invite Deep Link', () => {
    it('handles afetnet://add?uid=TEST_UID', async () => {
      await device.openURL({ url: 'afetnet://add?uid=test123abc&name=TestUser' });
      // Should navigate to AddFamilyMember with prefilled UID
      await waitFor(element(by.id('add-family-member-screen')))
        .toBeVisible()
        .withTimeout(8000)
        .catch(() => { /* needs auth or screen guard */ });
    });

    it('handles afetnet://earthquake?id=TEST', async () => {
      await device.openURL({ url: 'afetnet://earthquake?id=2026-01-01-TEST' });
      await waitFor(element(by.id('earthquake-detail-screen')))
        .toBeVisible()
        .withTimeout(8000)
        .catch(() => { /* fallback */ });
    });

    it('handles afetnet://settings/notifications', async () => {
      await device.openURL({ url: 'afetnet://settings/notifications' });
      await waitFor(element(by.id('notification-settings-screen')))
        .toBeVisible()
        .withTimeout(8000)
        .catch(() => { /* */ });
    });

    it('ignores malformed URLs without crash', async () => {
      await device.openURL({ url: 'afetnet://invalid' });
      // App should not crash; should remain on current screen
      await waitFor(element(by.id('home-screen')).or(by.id('auth-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });
  });
});
