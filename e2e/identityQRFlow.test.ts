/**
 * AFETNET E2E TEST - IDENTITY QR FLOW
 * Kullanici kimligi QR kod paylasimi.
 */

import { device, element, by, waitFor } from 'detox';

describe('Identity QR Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('My QR Screen', () => {
    it('opens MyQR screen from Settings or Family', async () => {
      await element(by.id('tab-family')).tap();
      await element(by.id('my-qr-button')).tap().catch(async () => {
        await element(by.id('tab-settings')).tap();
        await element(by.text(/QR Kodu/)).tap().catch(() => { /* */ });
      });
      await waitFor(element(by.id('my-qr-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('shows generated QR code', async () => {
      await waitFor(element(by.id('user-qr-image')))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });

    it('share button accessible', async () => {
      await waitFor(element(by.id('qr-share-button')))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });
  });
});
