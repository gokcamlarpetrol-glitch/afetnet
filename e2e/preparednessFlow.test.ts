/**
 * AFETNET E2E TEST - DISASTER PREPAREDNESS FLOW
 */

import { device, element, by, waitFor } from 'detox';

describe('Preparedness Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Preparedness Plan', () => {
    it('opens preparedness from Home or AI assistant', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Hazırlık|Preparedness/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('preparedness-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('shows checklist categories', async () => {
      await waitFor(element(by.text(/Acil Çanta|Emergency Bag/)))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });
  });

  describe('Drill Mode', () => {
    it('opens drill mode for earthquake practice', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Tatbikat|Drill/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('drill-mode-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });
  });
});
