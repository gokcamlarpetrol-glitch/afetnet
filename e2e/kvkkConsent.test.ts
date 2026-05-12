/**
 * AFETNET E2E TEST - KVKK MADDE 6 CONSENT FLOW
 *
 * Critical compliance test: ensures health data uploads are gated behind
 * explicit user consent toggles, and never auto-fire.
 *
 * Coverage:
 *   - KVKKConsentSection renders in Health Profile screen
 *   - Both toggles default to OFF
 *   - Toggling ON opens consent modal with KVKK Madde 6 disclaimer
 *   - "Vazgeç" button dismisses without saving consent
 *   - "Açık Rıza Veriyorum" button saves consent
 *   - Toggling OFF asks for confirmation before withdrawing
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('KVKK Madde 6 Consent Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, permissions: { notifications: 'YES' } });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // Navigate to Health Profile screen
    await element(by.id('tab-health')).tap().catch(() => { /* tab may already be active */ });
  });

  describe('Default State (KVKK Madde 6 — opt-in only)', () => {
    it('renders KVKK consent section', async () => {
      await waitFor(element(by.text('Veri Paylaşımı (KVKK Madde 6)')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('cloud sync toggle is OFF by default', async () => {
      const toggle = element(by.id('kvkk-toggle-cloud'));
      await expect(toggle).toHaveValue('0'); // Switch.value=false
    });

    it('backend share toggle is OFF by default', async () => {
      const toggle = element(by.id('kvkk-toggle-backend'));
      await expect(toggle).toHaveValue('0');
    });
  });

  describe('Granting Consent — Cloud Sync', () => {
    it('opens consent modal when cloud toggle pressed', async () => {
      await element(by.id('kvkk-toggle-cloud')).tap();
      await waitFor(element(by.text('Bulut Yedekleme — Açık Rıza')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('dismisses modal without consent on "Vazgeç"', async () => {
      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('Vazgeç')).tap();
      // Toggle should remain OFF
      await expect(element(by.id('kvkk-toggle-cloud'))).toHaveValue('0');
    });

    it('grants consent and toggles ON via "Açık Rıza Veriyorum"', async () => {
      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('Açık Rıza Veriyorum')).tap();
      await waitFor(element(by.id('kvkk-toggle-cloud')))
        .toHaveValue('1')
        .withTimeout(2000);
    });
  });

  describe('Withdrawing Consent', () => {
    it('shows confirmation alert when toggling cloud OFF', async () => {
      // First, grant
      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('Açık Rıza Veriyorum')).tap();
      await waitFor(element(by.id('kvkk-toggle-cloud'))).toHaveValue('1').withTimeout(2000);

      // Then withdraw
      await element(by.id('kvkk-toggle-cloud')).tap();
      await waitFor(element(by.text('Rızayı Geri Çek')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('cancels withdrawal on "İptal"', async () => {
      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('Açık Rıza Veriyorum')).tap();
      await waitFor(element(by.id('kvkk-toggle-cloud'))).toHaveValue('1').withTimeout(2000);

      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('İptal')).tap();

      // Toggle should remain ON
      await expect(element(by.id('kvkk-toggle-cloud'))).toHaveValue('1');
    });

    it('confirms withdrawal on "Geri Çek"', async () => {
      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('Açık Rıza Veriyorum')).tap();
      await waitFor(element(by.id('kvkk-toggle-cloud'))).toHaveValue('1').withTimeout(2000);

      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('Geri Çek')).tap();

      await waitFor(element(by.id('kvkk-toggle-cloud')))
        .toHaveValue('0')
        .withTimeout(2000);
    });
  });

  describe('Backend Share (separate consent)', () => {
    it('opens different modal copy for backend share', async () => {
      await element(by.id('kvkk-toggle-backend')).tap();
      await waitFor(element(by.text('Kurtarma Ekibi Paylaşımı — Açık Rıza')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('backend consent is independent of cloud consent', async () => {
      // Grant cloud
      await element(by.id('kvkk-toggle-cloud')).tap();
      await element(by.text('Açık Rıza Veriyorum')).tap();
      await waitFor(element(by.id('kvkk-toggle-cloud'))).toHaveValue('1').withTimeout(2000);

      // Backend should still be OFF
      await expect(element(by.id('kvkk-toggle-backend'))).toHaveValue('0');
    });
  });
});
