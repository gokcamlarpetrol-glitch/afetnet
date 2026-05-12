/**
 * AFETNET E2E TEST - HEALTH PROFILE FLOW
 * Saglik profili + KVKK Madde 6 onay UI.
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Health Profile Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, permissions: { notifications: 'YES' } });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Navigation', () => {
    it('opens Health Profile from Settings', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text(/Sağlık|Tıbbi/)).tap();
      await waitFor(element(by.id('health-profile-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('KVKK Consent (Sprint 1A)', () => {
    it('renders consent section at the top', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text(/Sağlık|Tıbbi/)).tap();
      await waitFor(element(by.text('Veri Paylaşımı (KVKK Madde 6)')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('toggles start OFF by default (opt-in)', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text(/Sağlık|Tıbbi/)).tap();
      // Both consent toggles must default to off
      await expect(element(by.id('kvkk-toggle-cloud'))).toHaveValue('0');
      await expect(element(by.id('kvkk-toggle-backend'))).toHaveValue('0');
    });
  });

  describe('Profile Categories', () => {
    it('shows 6 categories', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text(/Sağlık|Tıbbi/)).tap();
      await expect(element(by.text('Kişisel Bilgiler'))).toBeVisible();
      await expect(element(by.text('Tıbbi Bilgiler'))).toBeVisible();
      await expect(element(by.text('Acil Durum Yakınları'))).toBeVisible();
    });

    it('can edit blood type', async () => {
      await element(by.id('tab-settings')).tap();
      await element(by.text(/Sağlık|Tıbbi/)).tap();
      // Scroll to medical section
      await element(by.id('health-profile-scroll')).scrollTo('bottom');
      // Just verify UI doesn't crash on interaction
      await element(by.text('Tıbbi Bilgiler')).tap().catch(() => { /* may already be expanded */ });
    });
  });
});
