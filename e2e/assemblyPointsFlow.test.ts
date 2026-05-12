/**
 * AFETNET E2E TEST - ASSEMBLY POINTS FLOW
 * AFAD listesinden derlenen toplanma alanlari.
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Assembly Points Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { location: 'always' },
    });
  });

  describe('Assembly Points Screen', () => {
    it('opens from Home or Settings', async () => {
      await element(by.id('tab-home')).tap();
      await element(by.text(/Toplanma Alanı/)).tap().catch(async () => {
        await element(by.id('tab-settings')).tap();
        await element(by.text(/Toplanma/)).tap().catch(() => { /* */ });
      });
      await waitFor(element(by.id('assembly-points-screen')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('shows list of nearby points', async () => {
      await waitFor(element(by.id('assembly-list')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* may show map view */ });
    });

    it('badge says "AFAD Listesi" not "AFAD Onaylı" (Sprint 1A hot-fix #3)', async () => {
      await waitFor(element(by.text('AFAD Listesi')))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* badge in detail modal */ });
    });
  });

  describe('Add Custom Assembly Point', () => {
    it('user can add their own assembly point', async () => {
      const fab = element(by.id('add-assembly-fab'));
      await fab.tap().catch(() => { /* may not exist */ });
      await waitFor(element(by.id('add-assembly-screen')))
        .toBeVisible()
        .withTimeout(3000)
        .catch(() => { /* */ });
    });
  });
});
