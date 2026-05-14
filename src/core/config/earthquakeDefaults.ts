/**
 * Shared earthquake defaults.
 *
 * General earthquake notifications are different from EEW/critical warning:
 * - General notification default: M5.0+
 * - EEW may still use lower operational thresholds for proximity-scoped alerts.
 */

export const GENERAL_EARTHQUAKE_NOTIFICATION_MIN_MAGNITUDE = 5.0;
export const LEGACY_GENERAL_EARTHQUAKE_NOTIFICATION_MIN_MAGNITUDE = 4.0;
export const GENERAL_EARTHQUAKE_NOTIFICATION_DEFAULT_LABEL = 'M5.0 ve üzeri';
export const CRITICAL_EEW_NOTIFICATION_MIN_MAGNITUDE = 5.5;
export const LEGACY_CRITICAL_EEW_NOTIFICATION_MIN_MAGNITUDE = 6.0;
export const CRITICAL_EEW_NOTIFICATION_DEFAULT_LABEL = 'M5.5 ve üzeri';

type EarthquakeNotificationDefaultState = {
  minMagnitudeForNotification?: unknown;
  earthquakeNotificationDefaultMigratedToM5?: unknown;
  criticalMagnitudeThreshold?: unknown;
  criticalMagnitudeDefaultMigratedToM55?: unknown;
};

export function migrateEarthquakeNotificationDefault<T extends EarthquakeNotificationDefaultState>(state: T): T {
  if (
    state.earthquakeNotificationDefaultMigratedToM5 === true &&
    state.criticalMagnitudeDefaultMigratedToM55 === true
  ) {
    return state;
  }

  const next = {
    ...state,
  };

  if (state.earthquakeNotificationDefaultMigratedToM5 !== true) {
    next.earthquakeNotificationDefaultMigratedToM5 = true;
    if (state.minMagnitudeForNotification === LEGACY_GENERAL_EARTHQUAKE_NOTIFICATION_MIN_MAGNITUDE) {
      next.minMagnitudeForNotification = GENERAL_EARTHQUAKE_NOTIFICATION_MIN_MAGNITUDE;
    }
  }

  if (state.criticalMagnitudeDefaultMigratedToM55 !== true) {
    next.criticalMagnitudeDefaultMigratedToM55 = true;
    if (
      state.criticalMagnitudeThreshold === undefined ||
      state.criticalMagnitudeThreshold === LEGACY_CRITICAL_EEW_NOTIFICATION_MIN_MAGNITUDE
    ) {
      next.criticalMagnitudeThreshold = CRITICAL_EEW_NOTIFICATION_MIN_MAGNITUDE;
    }
  }

  return next as T;
}
