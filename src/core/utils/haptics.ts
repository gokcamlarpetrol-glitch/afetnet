/**
 * HAPTICS UTILITY
 * Haptic feedback for user interactions
 */

import * as Haptics from 'expo-haptics';

export const impactLight = async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Haptics not supported on this device
  }
};

export const impactMedium = async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    // Haptics not supported on this device
  }
};

export const impactHeavy = async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (error) {
    // Haptics not supported on this device
  }
};

export const notificationSuccess = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    // Haptics not supported on this device
  }
};

export const notificationWarning = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    // Haptics not supported on this device
  }
};

export const notificationError = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    // Haptics not supported on this device
  }
};

export const selectionChanged = async () => {
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    // Haptics not supported on this device
  }
};
