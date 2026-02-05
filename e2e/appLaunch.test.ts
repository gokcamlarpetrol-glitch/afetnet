/**
 * AFETNET E2E TEST - ONBOARDING & APP LAUNCH
 * Tests the critical user journey from first launch
 */

import { device, element, by, expect } from 'detox';

describe('AfetNet App Launch', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe('First Launch Experience', () => {
        it('should show onboarding screen on first launch', async () => {
            // First screen should show AfetNet branding
            await expect(element(by.text('AfetNet'))).toBeVisible();
        });

        it('should have continue button on onboarding', async () => {
            await expect(element(by.id('onboarding-continue-btn'))).toBeVisible();
        });

        it('should navigate through onboarding slides', async () => {
            // Swipe through onboarding
            await element(by.id('onboarding-slider')).swipe('left');
            await expect(element(by.text('Deprem Uyarısı'))).toBeVisible();

            await element(by.id('onboarding-slider')).swipe('left');
            await expect(element(by.text('Aile Takibi'))).toBeVisible();
        });
    });
});
