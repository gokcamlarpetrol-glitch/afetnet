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
import { createLogger } from '../utils/logger';

const logger = createLogger('NavigationRef');

export const navigationRef = createNavigationContainerRef();
let lastRouteName = 'UnknownRoute';

const RETRY_INTERVAL_MS = 500;
const MAX_RETRIES = 60; // 60 × 500ms = 30 seconds total wait (cold-start safe)

// CRITICAL FIX: Use per-screen retry Map instead of single global interval.
// Previously, a single pendingRetryInterval meant that a second navigateTo call
// (e.g., from initialization logic) would CANCEL the first call's retry
// (e.g., from a cold-start notification tap) — silently losing the navigation.
const pendingRetries = new Map<string, { interval: NodeJS.Timeout; retries: number }>();

/**
 * Screens that only exist inside MainNavigator (requires auth + Main screen).
 * If MainNavigator isn't mounted yet, dispatch() silently drops the action
 * without throwing — so we must explicitly check before dispatching.
 */
const MAIN_ONLY_SCREENS = new Set([
    'Conversation', 'FamilyGroupChat', 'SOSHelp', 'DisasterMap',
    'MainTabs', 'Messages', 'Family', 'Settings', 'LocalAIAssistant',
    'NewMessage', 'Home', 'Map',
    // CRITICAL FIX: These screens are inside MainNavigator but were missing from this set.
    // On cold-start notification taps, navigateTo() skipped the "is Main mounted?" check
    // for these screens, so CommonActions.navigate silently dropped the dispatch — the user
    // tapped a notification and nothing happened.
    'EarthquakeDetail', 'AllEarthquakes', 'NewsDetail', 'AllNews', 'DrillMode',
    'SOSConversation', 'SOSHistory', 'RescueTeam', 'MeshNetwork',
    'PreparednessPlan', 'PanicAssistant', 'WaveVisualization',
    'HealthProfile', 'MedicalInformation', 'AddFamilyMember',
    'EarthquakeSettings', 'NotificationSettings', 'EEWSettings',
    'DisasterPreparedness', 'AssemblyPoints', 'AddAssemblyPoint',
    'FlashlightWhistle', 'PsychologicalSupport', 'MyQR',
    'OfflineMapSettings', 'AdvancedSettings', 'About',
    'PrivacyPolicy', 'TermsOfService', 'Security',
    'UserReports', 'VolunteerModule', 'CreateGroup', 'VoiceCall', 'RiskScore',
]);

/**
 * Safe navigate with retry — critical for cold start notification taps.
 * When user taps notification before navigation is mounted, this retries
 * until navigation is ready (up to 30 seconds).
 *
 * CRITICAL FIX: CommonActions.navigate dispatch() does NOT throw when the
 * target screen doesn't exist in the current navigation tree — it silently
 * drops the action. This caused cold-start notification taps to be lost
 * because MainNavigator wasn't mounted yet (auth still resolving), but
 * tryNavigate() returned true thinking it succeeded.
 *
 * Fix: Explicitly check if MainNavigator is the current root route before
 * dispatching to screens that live inside it. If not mounted, return false
 * to keep retrying until auth completes and MainNavigator renders.
 */
export function navigateTo(screenName: string, params?: Record<string, unknown>): void {
    logger.info(`🧭 navigateTo('${screenName}') called`, params ? { paramKeys: Object.keys(params).join(',') } : {});

    const tryNavigate = (): boolean => {
        if (!navigationRef.isReady()) {
            logger.debug(`navigateTo('${screenName}'): nav ref not ready`);
            return false;
        }

        // CRITICAL: For screens inside MainNavigator, verify Main is the active root route.
        // Without this check, dispatch() silently drops the action when auth hasn't resolved
        // yet (root shows Loading/AuthLoading/Auth instead of Main).
        if (MAIN_ONLY_SCREENS.has(screenName)) {
            try {
                const rootState = navigationRef.getRootState();
                const currentRoot = rootState?.routes?.[rootState.routes.length - 1]?.name;
                if (currentRoot !== 'Main') {
                    logger.debug(`navigateTo('${screenName}'): Main not mounted yet, currentRoot="${currentRoot}"`);
                    return false; // MainNavigator not mounted yet — retry
                }
            } catch {
                return false;
            }
        }

        try {
            // Capture current route BEFORE dispatch to verify navigation actually happened.
            // CommonActions.navigate silently drops the action when the target screen
            // isn't registered in any navigator — it does NOT throw.
            const routeBefore = navigationRef.getCurrentRoute()?.name;

            navigationRef.dispatch(
                CommonActions.navigate({
                    name: screenName,
                    params,
                })
            );

            // Verify the route actually changed (or was already on target)
            const routeAfter = navigationRef.getCurrentRoute()?.name;
            // FIX: When navigating to 'MainTabs' with { screen: 'Messages' }, getCurrentRoute()
            // returns the deepest focused route ('Messages'), not 'MainTabs'. Check both the
            // target screen name AND nested tab screen param. Without this, navigating to
            // MainTabs when user is already on the target tab triggers a 30-second phantom
            // retry loop (routeAfter !== screenName && routeAfter === routeBefore).
            const nestedScreen = (params as any)?.screen;
            if (routeAfter === screenName || routeAfter === nestedScreen || routeAfter !== routeBefore) {
                logger.info(`✅ navigateTo('${screenName}') dispatched successfully (route: ${routeBefore} → ${routeAfter})`);
                return true;
            }

            // Route didn't change — dispatch was silently dropped
            // CRITICAL FIX: Need to return false to ensure the retry loop continues
            logger.debug(`navigateTo('${screenName}'): dispatch was silently dropped (route unchanged: ${routeAfter}), returning false to trigger retry`);
            return false;
        } catch (dispatchError) {
            // Screen not yet registered in any navigator — retry
            logger.debug(`navigateTo('${screenName}'): dispatch threw — screen not registered yet`, dispatchError);
            return false;
        }
    };

    if (tryNavigate()) {
        return;
    }

    // Cancel any previous pending retry for the SAME screen to prevent accumulation.
    // But DO NOT cancel retries for OTHER screens — that would lose notification taps.
    const retryKey = screenName;
    const existingRetry = pendingRetries.get(retryKey);
    if (existingRetry) {
        clearInterval(existingRetry.interval);
        pendingRetries.delete(retryKey);
    }

    // Navigation tree may not be ready yet (cold start, auth/onboarding stack switch).
    // Keep retrying until target route becomes available.
    logger.info(`🧭 navigateTo('${screenName}'): starting retry loop (every ${RETRY_INTERVAL_MS}ms, max ${MAX_RETRIES})`);
    const retryState = { retries: 0 };
    const interval = setInterval(() => {
        retryState.retries++;
        if (tryNavigate()) {
            logger.info(`✅ navigateTo('${screenName}') succeeded after ${retryState.retries} retries`);
            clearInterval(interval);
            pendingRetries.delete(retryKey);
        } else if (retryState.retries >= MAX_RETRIES) {
            logger.warn(`❌ navigateTo('${screenName}') failed after ${MAX_RETRIES} retries (30s). Attempting fallback navigation.`);
            clearInterval(interval);
            pendingRetries.delete(retryKey);
            // CRITICAL FIX: Fallback navigation — don't silently fail.
            // If the target screen was a message conversation, at least go to Messages tab.
            // For other screens, go to Home. This ensures the user sees SOMETHING after tapping a notification.
            try {
                if (navigationRef.isReady()) {
                    const fallbackScreen = (screenName === 'Conversation' || screenName === 'FamilyGroupChat')
                        ? 'Messages' : 'Home';
                    navigationRef.dispatch(
                        CommonActions.navigate({ name: 'MainTabs', params: { screen: fallbackScreen } })
                    );
                    logger.info(`🔄 Fallback navigation to MainTabs/${fallbackScreen} after retry exhaustion`);
                }
            } catch (fallbackErr) {
                logger.warn('Fallback navigation also failed:', fallbackErr);
            }
        }
    }, RETRY_INTERVAL_MS);
    pendingRetries.set(retryKey, { interval, retries: retryState.retries });
}

export function setCurrentRouteName(routeName?: string): void {
    if (routeName && typeof routeName === 'string' && routeName.trim().length > 0) {
        lastRouteName = routeName.trim();
    }
}

/**
 * Cancel all pending navigation retry intervals.
 * CRITICAL: Must be called on shutdown/logout to prevent stale retry intervals from
 * firing navigation dispatches after the user has logged out or the app is reinitializing.
 */
export function clearPendingNavigationRetries(): void {
    if (pendingRetries.size > 0) {
        logger.info(`Clearing ${pendingRetries.size} pending navigation retries`);
        for (const [, entry] of pendingRetries) {
            clearInterval(entry.interval);
        }
        pendingRetries.clear();
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
