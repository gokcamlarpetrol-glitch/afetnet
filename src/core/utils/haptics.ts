/**
 * HAPTICS UTILITY - ELITE EDITION
 * Context-aware haptic feedback for user interactions.
 *
 * Features:
 * - Standard haptic patterns
 * - Emergency-specific patterns
 * - Configurable intensity
 * - Batch patterns for sequences
 * - ELITE: Settings integration (vibrationEnabled)
 */

import * as Haptics from 'expo-haptics';

// ELITE: Import settings store for vibration control
// Using dynamic import to avoid circular dependencies
const isVibrationEnabled = (): boolean => {
  try {
    const { useSettingsStore } = require('../stores/settingsStore');
    return useSettingsStore.getState().vibrationEnabled ?? true;
  } catch {
    return true; // Default to enabled if store not available
  }
};

// Standard Impacts
export const impactLight = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

export const impactMedium = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

export const impactHeavy = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

// Notifications
export const notificationSuccess = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

export const notificationWarning = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

export const notificationError = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

export const selectionChanged = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.selectionAsync();
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

// Elite Patterns

/**
 * SOS Alert Pattern - Strong vibration sequence
 * ALWAYS runs even if vibration is disabled - for emergency situations
 */
export const sosAlert = async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(100);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(100);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

/**
 * Earthquake Warning Pattern - Escalating vibration
 * ALWAYS runs even if vibration is disabled - for emergency situations
 */
export const earthquakeWarning = async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(50);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(50);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(50);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

/**
 * Message Received Pattern - Gentle notification
 */
export const messageReceived = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(50);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

/**
 * Button Press Pattern - Standard button feedback
 */
export const buttonPress = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

/**
 * Tab Change Pattern - Selection feedback
 */
export const tabChange = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.selectionAsync();
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

/**
 * Scroll Tick Pattern - Subtle feedback for list scrolling
 */
export const scrollTick = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

/**
 * Success Confirmation Pattern
 */
export const confirmSuccess = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

/**
 * Error Feedback Pattern
 */
export const confirmError = async () => {
  if (!isVibrationEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch { /* Haptics may fail silently on unsupported devices */ }
};

// Helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
