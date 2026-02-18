/**
 * NAVIGATION REF - Global navigation reference
 *
 * Allows programmatic navigation from outside React components,
 * such as notification tap handlers in NotificationService.
 *
 * Usage:
 * 1. Assign ref in CoreApp: <NavigationContainer ref={navigationRef}>
 * 2. Call navigate() from anywhere: navigationRef.current?.navigate('Screen', params)
 */

import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
let lastRouteName = 'UnknownRoute';

const RETRY_INTERVAL_MS = 500;
const MAX_RETRIES = 60; // 60 × 500ms = 30 seconds total wait (cold-start safe)

/**
 * Safe navigate with retry — critical for cold start notification taps.
 * When user taps notification before navigation is mounted, this retries
 * until navigation is ready (up to 30 seconds).
 *
 * LIFE-SAFETY: Uses try/catch dispatch instead of routeExistsInState check.
 * The previous approach failed on cold-start because nested navigator screens
 * (like SOSHelp in MainNavigator) weren't in the state tree until after
 * auth completed and MainNavigator mounted.
 */
export function navigateTo(screenName: string, params?: Record<string, unknown>): void {
    const tryNavigate = (): boolean => {
        if (!navigationRef.isReady()) {
            return false;
        }

        try {
            navigationRef.dispatch(
                CommonActions.navigate({
                    name: screenName,
                    params,
                })
            );
            return true;
        } catch {
            // Screen not yet registered in any navigator — retry
            return false;
        }
    };

    if (tryNavigate()) {
        return;
    }

    // Navigation tree may not be ready yet (cold start, auth/onboarding stack switch).
    // Keep retrying until target route becomes available.
    let retries = 0;
    const interval = setInterval(() => {
        retries++;
        if (tryNavigate() || retries >= MAX_RETRIES) {
            clearInterval(interval);
        }
    }, RETRY_INTERVAL_MS);
}

export function setCurrentRouteName(routeName?: string): void {
    if (routeName && typeof routeName === 'string' && routeName.trim().length > 0) {
        lastRouteName = routeName.trim();
    }
}

export function getCurrentRouteName(): string {
    try {
        if (navigationRef.isReady()) {
            const current = navigationRef.getCurrentRoute()?.name;
            if (current) {
                return current;
            }
        }
    } catch {
        // best effort fallback
    }
    return lastRouteName;
}
