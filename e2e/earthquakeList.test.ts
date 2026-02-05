/**
 * AFETNET E2E TEST - EARTHQUAKE LIST
 * Tests earthquake list functionality
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Earthquake List', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
        // Navigate to earthquake list (assuming logged in state)
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe('Earthquake Display', () => {
        it('should show earthquake list after navigation', async () => {
            // Tap on earthquakes tab or navigate
            await element(by.id('tab-earthquakes')).tap();

            // Wait for list to load
            await waitFor(element(by.id('earthquake-list')))
                .toBeVisible()
                .withTimeout(5000);
        });

        it('should display earthquake cards with magnitude', async () => {
            await element(by.id('tab-earthquakes')).tap();

            // Check for magnitude badge
            await expect(element(by.id('earthquake-item-0'))).toBeVisible();
        });

        it('should open earthquake detail on tap', async () => {
            await element(by.id('tab-earthquakes')).tap();

            // Tap first earthquake
            await element(by.id('earthquake-item-0')).tap();

            // Check for detail view
            await expect(element(by.id('earthquake-detail-header'))).toBeVisible();
        });

        it('should pull to refresh earthquake list', async () => {
            await element(by.id('tab-earthquakes')).tap();

            // Pull to refresh
            await element(by.id('earthquake-list')).swipe('down', 'slow');

            // Wait for refresh to complete
            await waitFor(element(by.id('earthquake-list')))
                .toBeVisible()
                .withTimeout(5000);
        });
    });

    describe('Earthquake Filtering', () => {
        it('should filter earthquakes by magnitude', async () => {
            await element(by.id('tab-earthquakes')).tap();

            // Open filter modal
            await element(by.id('filter-button')).tap();

            // Select magnitude filter
            await element(by.id('magnitude-filter-4+')).tap();

            // Apply filter
            await element(by.id('apply-filter-btn')).tap();

            // Verify filter applied
            await expect(element(by.id('active-filter-badge'))).toBeVisible();
        });
    });
});
