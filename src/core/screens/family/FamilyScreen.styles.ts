/**
 * FAMILY SCREEN - Extracted Styles
 */
import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Background color removed to show ImageBackground
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.background.primary,
    zIndex: 10,
    elevation: 4,
  },
  headerContent: {
    flex: 1,
    minHeight: 60, // Ensure minimum height for title visibility
  },
  titleContainer: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#334155', // Softened Deep Slate
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b', // SoftSlate
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.6)', // Glass style
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  statusSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  membersSection: {
    marginTop: 16,
  },
  memberList: {
    gap: 12,
  },
  memberCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  memberTime: {
    fontSize: 13,
    color: '#94a3b8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  viewMapText: {
    fontSize: 14,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255,255,255,0.4)', // Slightly clearer glass background
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700', // Changed from 600 to 700
    color: '#1e293b', // Dark Slate
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569', // Medium Slate
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24, // Changed from 20 to 24
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  qrContainer: {
    backgroundColor: colors.background.secondary,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  idLabel: {
    ...typography.body,
    fontWeight: '600',
    marginRight: 8,
  },
  idValue: {
    ...typography.body,
    flex: 1,
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  modalButtonSmall: {
    flex: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonTextSmall: {
    ...typography.small,
    fontWeight: '600',
    color: '#fff',
    fontSize: 12,
  },
  errorText: {
    ...typography.body,
    color: colors.status.danger,
    textAlign: 'center',
  },
  groupChatSection: {
    marginBottom: 20,
  },
  groupChatButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  groupChatText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  editInputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  editInputLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  modalButtonCancel: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  modalButtonSave: {
    backgroundColor: colors.brand.primary,
  },
  modalButtonTextCancel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalButtonTextSave: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  // ELITE: Relationship Chip Styles
  relationshipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
    marginRight: 8,
    gap: 6,
  },
  relationshipChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  relationshipChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  relationshipChipTextActive: {
    color: '#fff',
  },
});

export { styles };
