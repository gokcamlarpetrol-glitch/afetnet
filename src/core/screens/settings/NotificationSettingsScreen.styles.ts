/**
 * NOTIFICATION SETTINGS SCREEN - Styles
 * Extracted from NotificationSettingsScreen.tsx for maintainability
 */

import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginBottom: 12,
  },
  sectionSubtitle: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionSubtitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  settingRight: {
    marginLeft: 12,
  },
  soundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  soundCard: {
    width: '47%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  soundCardActive: {
    borderColor: colors.brand.primary,
  },
  soundCardGradient: {
    padding: 16,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  soundCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 8,
  },
  soundCardLabelActive: {
    color: colors.brand.primary,
  },
  soundCardDescription: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  modeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: 8,
  },
  modeChipActive: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modeChipTextActive: {
    color: colors.brand.primary,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  sliderContent: {
    flex: 1,
    marginLeft: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  valueInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  valueInput: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    paddingVertical: 6,
    textAlign: 'center',
    minWidth: 50,
  },
  valueSuffix: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  quickButtonActive: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  quickButtonTextActive: {
    color: colors.brand.primary,
  },
  timeInputContainer: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  timeInput: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    paddingVertical: 8,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: colors.status.info + '20',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  magnitudeInfo: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  magnitudeInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  magnitudeInfoRow: {
    marginBottom: 8,
  },
  magnitudeInfoText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: colors.status.info + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.status.info + '40',
    marginTop: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  // ELITE: Test Alert Styles
  testAlertCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  testAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  testAlertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testAlertInfo: {
    flex: 1,
  },
  testAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  testAlertSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  testAlertButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  testAlertButtonDisabled: {
    opacity: 0.6,
  },
  testAlertButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  testAlertButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  testAlertStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  testAlertStat: {
    alignItems: 'center',
    gap: 4,
  },
  testAlertStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  testAlertStatLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  testAlertStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
  },
  monitoringDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.tertiary,
  },
  monitoringDotActive: {
    backgroundColor: '#22c55e',
  },
});

