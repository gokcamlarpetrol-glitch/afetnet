/**
 * AFETNET E2E TEST - CRITICAL SOS FLOW
 * Tests the emergency SOS feature - CRITICAL PATH
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('SOS Emergency Flow', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe('SOS Button', () => {
        it('should show SOS button on home screen', async () => {
            // SOS button should be prominently displayed
            await expect(element(by.id('sos-button'))).toBeVisible();
        });

        it('should show confirmation on SOS tap', async () => {
            // Tap SOS button
            await element(by.id('sos-button')).tap();

            // Should show confirmation dialog
            await expect(element(by.id('sos-confirm-dialog'))).toBeVisible();
            await expect(element(by.text('Acil Yardım Çağrısı'))).toBeVisible();
        });

        it('should cancel SOS on dismiss', async () => {
            await element(by.id('sos-button')).tap();

            // Cancel button
            await element(by.id('sos-cancel-btn')).tap();

            // Dialog should be dismissed
            await expect(element(by.id('sos-confirm-dialog'))).not.toBeVisible();
        });

        it('should require long press for immediate SOS', async () => {
            // Long press for 3 seconds
            await element(by.id('sos-button')).longPress(3000);

            // Should show SOS sent confirmation
            await waitFor(element(by.text('SOS Gönderildi')))
                .toBeVisible()
                .withTimeout(5000);
        });
    });

    describe('SOS History', () => {
        it('should navigate to SOS history', async () => {
            // Navigate to settings or SOS history
            await element(by.id('tab-settings')).tap();
            await element(by.id('sos-history-btn')).tap();

            // Check SOS history screen
            await expect(element(by.id('sos-history-list'))).toBeVisible();
        });
    });
});
