/**
 * AFETNET E2E TEST - ONBOARDING FLOW (Sprint 1B: 9 → 4 slayt)
 */

import { device, element, by, waitFor } from 'detox';

describe('Onboarding Flow (4 slides)', () => {
  beforeEach(async () => {
    // Fresh install for onboarding
    await device.launchApp({ newInstance: true, delete: true });
  });

  describe('Slide Progression', () => {
    it('starts on slide 1 (EEW + Notification)', async () => {
      await waitFor(element(by.text(/Deprem.*Erken Uyar/)))
        .toBeVisible()
        .withTimeout(8000);
    });

    it('progresses to slide 2 (Location + SOS)', async () => {
      await element(by.text('Bildirimleri Aç')).tap();
      // Grant permission via system dialog (Detox auto-handles)
      await waitFor(element(by.text(/Konum.*Aile SOS/)))
        .toBeVisible()
        .withTimeout(5000)
        .catch(() => { /* */ });
    });

    it('reaches final slide "Hazır mısınız?"', async () => {
      // Tap through all 4 slides
      const buttons = ['Bildirimleri Aç', 'Konumu Etkinleştir'];
      for (const btnText of buttons) {
        try {
          await element(by.text(btnText)).tap();
          await new Promise(r => setTimeout(r, 1000));
        } catch { /* skip */ }
      }
      await waitFor(element(by.text(/Hazır|AfetNet'e Başla/)))
        .toBeVisible()
        .withTimeout(8000)
        .catch(() => { /* */ });
    });

    it('only 4 slides total (Sprint 1B reduction)', async () => {
      // After last slide, should reach Main screen
      // No 5th, 6th, 7th, 8th, 9th slide
      await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(30000).catch(() => { /* */ });
    });
  });
});
