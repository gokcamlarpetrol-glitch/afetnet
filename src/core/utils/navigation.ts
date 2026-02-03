/**
 * NAVIGATION UTILITIES
 * Safe navigation helpers to prevent GO_BACK errors
 */

import { NavigationProp } from '@react-navigation/core';
import { createLogger } from './logger';

const logger = createLogger('NavigationUtils');

/**
 * Safe navigation helper - prevents GO_BACK errors
 * Checks if navigation can go back, otherwise navigates to MainTabs
 */
export function safeGoBack(navigation: NavigationProp<any> | null | undefined | any): void {
  if (!navigation) {
    logger.warn('Navigation not available');
    return;
  }

  try {
    const nav = navigation as any;
    
    // Check if canGoBack is available and returns true
    if (nav.canGoBack && typeof nav.canGoBack === 'function' && nav.canGoBack()) {
      nav.goBack();
      return;
    }

    // Fallback: navigate to main tabs if no back stack
    if (nav.navigate && typeof nav.navigate === 'function') {
      logger.debug('No back stack available, navigating to MainTabs');
      nav.navigate('MainTabs');
      return;
    }

    logger.warn('Navigation methods not available');
  } catch (error) {
    logger.error('Navigation error:', error);
    
    // Last resort: try to navigate to main tabs
    try {
      const nav = navigation as any;
      if (nav.navigate && typeof nav.navigate === 'function') {
        nav.navigate('MainTabs');
      }
    } catch (navError) {
      logger.error('Failed to navigate to MainTabs:', navError);
    }
  }
}

/**
 * Safe navigation helper with callback
 * Useful for Alert callbacks and other async operations
 */
export function safeGoBackWithCallback(
  navigation: NavigationProp<any> | null | undefined,
  callback?: () => void,
): () => void {
  return () => {
    if (callback) {
      callback();
    }
    safeGoBack(navigation);
  };
}

