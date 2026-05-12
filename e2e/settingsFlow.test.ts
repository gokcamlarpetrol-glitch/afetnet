/**
 * AFETNET E2E TEST - SETTINGS FLOW
 *
 * Settings ekranlarinin tum bolumlerinin acilip kapanma testi.
 * Apple App Store review icin Account Deletion erisilebilir olmali (5.1.1(v)).
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Settings Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await element(by.id('tab-settings')).tap();
  });

  describe('Settings Sections', () => {
    it('renders settings screen', async () => {
      await waitFor(element(by.id('settings-screen')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('shows account deletion (Apple Guideline 5.1.1(v))', async () => {
      // Scroll to bottom to find delete account
      await element(by.id('settings-scroll')).scrollTo('bottom');
      await waitFor(element(by.text('Hesabı Sil')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('shows app version', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom');
      await waitFor(element(by.text(/v\d+\.\d+\.\d+/)))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('opens Hakkında screen', async () => {
      await element(by.text('Hakkında')).tap();
      await waitFor(element(by.id('about-screen')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('opens Privacy Policy', async () => {
      await element(by.text('Gizlilik Politikası')).tap();
      await waitFor(element(by.id('privacy-policy-screen')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('opens Feedback Modal (Sprint 2 in-app feedback)', async () => {
      await element(by.text('Geri Bildirim Gönder')).tap();
      await waitFor(element(by.text('Geri Bildirim')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Account Deletion Flow', () => {
    it('shows confirmation alert before deletion', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom');
      await element(by.text('Hesabı Sil')).tap();
      // First alert: warning
      await waitFor(element(by.text(/silmek istediğinizden emin/i)))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('cancels deletion on user decline', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom');
      await element(by.text('Hesabı Sil')).tap();
      await waitFor(element(by.text('İptal'))).toBeVisible().withTimeout(3000);
      await element(by.text('İptal')).tap();
      // Should NOT show deletion progress
      await expect(element(by.text('Hesap siliniyor'))).not.toBeVisible();
    });
  });
});
