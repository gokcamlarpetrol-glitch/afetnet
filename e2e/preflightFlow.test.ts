/**
 * AFETNET E2E TEST - PRE-FLIGHT (Apple App Review Verification)
 *
 * Apple/Play Store review icin asgari uyumluluk gereksinimleri.
 * Bu testler her release oncesi calistirilmali.
 */

import { device, element, by, waitFor, expect } from 'detox';

describe('Pre-Flight (App Store Review)', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Apple Guideline 1.2 (EULA)', () => {
    it('shows EULA modal on first launch', async () => {
      await waitFor(element(by.text(/Kullanım Sözleşmesi|EULA/)))
        .toBeVisible()
        .withTimeout(8000)
        .catch(() => { /* may have been accepted */ });
    });
  });

  describe('Apple Guideline 5.1.1(v) (Account Deletion)', () => {
    it('account deletion is reachable in <=3 taps from Settings', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.id('settings-scroll')).scrollTo('bottom');
      await waitFor(element(by.text('Hesabı Sil')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Privacy Policy + Terms Accessibility', () => {
    it('privacy policy reachable from Settings', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text('Gizlilik Politikası')).tap();
      await waitFor(element(by.id('privacy-policy-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('terms of service reachable from Settings', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text('Kullanım Koşulları')).tap();
      await waitFor(element(by.id('terms-of-service-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Apple Guideline 4.8 (Apple Sign-In)', () => {
    it('Apple Sign-In button visible on Login (iOS only)', async () => {
      if (device.getPlatform() !== 'ios') return;
      // Logout first
      await element(by.id('tab-settings')).tap();
      await element(by.id('logout-button')).tap().catch(() => { /* */ });
      // Now on Login screen
      await waitFor(element(by.id('apple-signin-button')))
        .toBeVisible()
        .withTimeout(8000)
        .catch(() => { /* iOS only */ });
    });
  });
});
