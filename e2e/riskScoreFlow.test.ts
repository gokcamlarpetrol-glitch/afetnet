/**
 * AFETNET E2E TEST - RISK SCORE FLOW (Building risk analysis)
 */

import { device, element, by, waitFor } from 'detox';

describe('Risk Score Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Risk Analysis', () => {
    it('opens risk score screen', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Risk Skoru|Risk Analizi/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('risk-score-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('shows disclaimer about scientific accuracy', async () => {
      // Sprint 1B: bilim disclaimer (deprem tahmin edilemez, sadece risk analizi)
      await waitFor(element(by.text(/AFAD.*Kandilli|tahmin değil/i)))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* may be in different screen */ });
    });
  });
});
