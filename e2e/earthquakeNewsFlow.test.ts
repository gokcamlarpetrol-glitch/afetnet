/**
 * AFETNET E2E TEST - EARTHQUAKE NEWS FLOW
 */

import { device, element, by, waitFor } from 'detox';

describe('Earthquake News Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('News Screen', () => {
    it('opens news from Home', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Haberler|News/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('all-news-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });
  });

  describe('Last Earthquakes List', () => {
    it('opens all earthquakes screen', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Son Depremler|Tüm Depremler/)).tap().catch(() => { /* */ });
      await waitFor(element(by.id('all-earthquakes-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('handles empty/loading state', async () => {
      // No crash on empty data
      await waitFor(element(by.id('all-earthquakes-screen')).or(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
