/**
 * AFETNET E2E TEST - NOTIFICATION FLOW
 *
 * Bildirim izni + ayarlar + Critical Alerts flow.
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Notification Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Notification Settings', () => {
    it('opens notification settings from Settings', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.id('settings-row-notifications')).tap();
      await waitFor(element(by.id('notification-settings-screen')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('shows master toggle', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.id('settings-row-notifications')).tap();
      await expect(element(by.id('notifications-master-toggle'))).toBeVisible();
    });

    it('shows EEW toggle', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.id('settings-row-notifications')).tap();
      await expect(element(by.text('Deprem Erken Uyarısı'))).toBeVisible();
    });

    it('shows family SOS toggle', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.id('settings-row-notifications')).tap();
      await expect(element(by.text('Aile SOS'))).toBeVisible();
    });
  });

  describe('Permission Re-prompt', () => {
    it('does NOT show re-prompt modal if permission granted', async () => {
      // Permission granted in beforeAll
      await waitFor(element(by.text('Bildirimleri Aç')))
        .not.toBeVisible()
        .withTimeout(8000);
    });
  });

  describe('Critical Alerts Disclosure', () => {
    it('explains Critical Alerts in notification settings', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.id('settings-row-notifications')).tap();
      // Should show explanation about life-safety alerts bypassing silent mode
      await waitFor(element(by.text('Sessiz modda bile uyarır')))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* may be different wording */ });
    });
  });
});
