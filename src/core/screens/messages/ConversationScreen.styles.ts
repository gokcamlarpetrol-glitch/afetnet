/**
 * CONVERSATION SCREEN - Extracted Styles
 */
import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    height: 60,
  },
  backBtn: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  callBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
  },

  // Network Banner
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Bubbles
  bubbleRow: {
    marginBottom: 8,
    width: '100%',
    flexDirection: 'row',
  },
  rowMe: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#dbeafe',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  bubbleOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  bubbleFailed: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  noTailMe: {
    borderBottomRightRadius: 20,
  },
  noTailOther: {
    borderBottomLeftRadius: 20,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
  },
  textMe: {
    color: '#1e3a8a',
  },
  textOther: {
    color: '#334155',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    opacity: 0.8,
  },
  timeMe: {
    color: '#60a5fa',
  },
  timeOther: {
    color: '#94a3b8',
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 8,
  },
  typingBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },

  // Input
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  attachBtn: {
    padding: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    color: '#334155',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ELITE: Reply banner styles
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#64748b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  replyContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  replyPreview: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
  },
  replyClose: {
    padding: 4,
  },
  // ELITE: Edit banner styles
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  editContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  editClose: {
    padding: 4,
  },
  // ELITE: Input row wrapper
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  // ELITE: Media message styles
  mediaImage: {
    width: 220,
    height: 180,
    borderRadius: 12,
  },
  bubbleImage: {
    paddingHorizontal: 6,
    paddingTop: 6,
    overflow: 'hidden',
  },
  mediaPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },

  // Voice player
  voicePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    minWidth: 180,
  },
  voiceWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  voiceBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'right',
  },

  // Location card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  locationIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  locationLink: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 4,
  },
});

export { styles };
