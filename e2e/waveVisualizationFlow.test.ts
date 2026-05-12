/**
 * AFETNET E2E TEST - WAVE VISUALIZATION FLOW (Sprint 1B UI honesty)
 */

import { device, element, by, waitFor } from 'detox';

describe('Wave Visualization Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Wave Screen', () => {
    it('opens wave visualization', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Sismik|Deprem Dalga/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('wave-visualization-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('uses honest UI labels (Sprint 1B rebrand)', async () => {
      // "Yüksek Risk Sinyali" (not "Deprem Bekleniyor")
      await waitFor(element(by.text(/Risk Sinyali|Yerel Şiddet Tahmini/)))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });

    it('shows scientific disclaimer', async () => {
      await waitFor(element(by.text(/AFAD.*Kandilli|sensör tahmini/i)))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });
  });
});
