/**
 * VOICE CALL SERVICE - ELITE P2P VOIP
 * Firebase Firestore signaling + WebRTC for peer-to-peer voice calls.
 *
 * FLOW:
 *  Caller  →  Firestore doc (calls/{callId})  →  Callee
 *  1. Caller creates offer, writes to Firestore
 *  2. Callee reads offer, creates answer, writes back
 *  3. ICE candidates exchanged via subcollection
 *  4. WebRTC audio stream established
 *
 * FEATURES:
 *  - Peer-to-peer voice (no media server needed)
 *  - Firebase push notification for incoming calls
 *  - Speaker / mute / hold controls
 *  - Auto-cleanup on hangup
 *  - Graceful fallback if WebRTC unavailable
 */

import { createLogger } from '../utils/logger';
import { initializeFirebase, getFirebaseAuth } from '../../lib/firebase';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { DeviceEventEmitter } from 'react-native';
import { isLikelyFirebaseUid } from '../utils/messaging/identityUtils';

const logger = createLogger('VoiceCallService');

// ── WebRTC imports (graceful fallback) ──────────────────────────────────────
let RTCPeerConnection: any;
let RTCSessionDescription: any;
let RTCIceCandidate: any;
let mediaDevices: any;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
} catch (e) {
  logger.warn('react-native-webrtc not available — voice calls disabled');
}

// ── Events ──────────────────────────────────────────────────────────────────
export const VOICE_CALL_EVENTS = {
  INCOMING_CALL: 'VOICE_CALL_INCOMING',
  CALL_ENDED: 'VOICE_CALL_ENDED',
  CALL_CONNECTED: 'VOICE_CALL_CONNECTED',
  CALL_FAILED: 'VOICE_CALL_FAILED',
} as const;

export interface IncomingCallData {
  callId: string;
  callerUid: string;
  callerName: string;
}

// ── STUN/TURN config ────────────────────────────────────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// ── Call state ──────────────────────────────────────────────────────────────
export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

interface CallState {
  callId: string | null;
  status: CallStatus;
  isMuted: boolean;
  isSpeaker: boolean;
  remoteUid: string | null;
  remoteName: string | null;
  startTime: number | null;
  isIncoming: boolean;
}

class VoiceCallServiceImpl {
  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private unsubscribers: Unsubscribe[] = [];
  private retryTimers: NodeJS.Timeout[] = [];
  private isDestroyed = false;
  private autoTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private state: CallState = {
    callId: null,
    status: 'idle',
    isMuted: false,
    isSpeaker: false,
    remoteUid: null,
    remoteName: null,
    startTime: null,
    isIncoming: false,
  };

  private applySpeakerRouting(enableSpeaker: boolean): void {
    (async () => {
      let applied = false;

      // Expo Audio route control (works on Expo-managed/native runtimes)
      try {
        const { setAudioModeAsync } = require('expo-audio');
        if (typeof setAudioModeAsync === 'function') {
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            shouldRouteThroughEarpiece: !enableSpeaker,
          });
          applied = true;
        }
      } catch (error) {
        logger.debug('expo-audio speaker routing unavailable:', error);
      }

      // Native fallback (bare RN projects)
      try {
        const InCallManager = require('react-native-incall-manager');
        if (InCallManager) {
          if (typeof InCallManager.setForceSpeakerphoneOn === 'function') {
            InCallManager.setForceSpeakerphoneOn(enableSpeaker);
          }
          if (typeof InCallManager.setSpeakerphoneOn === 'function') {
            InCallManager.setSpeakerphoneOn(enableSpeaker);
          }
          applied = true;
        }
      } catch (error) {
        logger.debug('InCallManager speaker routing unavailable:', error);
      }

      if (!applied) {
        logger.warn('Speaker routing module unavailable; state changed without native route update');
      }
    })().catch((error) => {
      logger.warn('Failed to apply speaker routing:', error);
    });
  }

  // ── Public getters ──────────────────────────────────────────────────────
  getState(): Readonly<CallState> {
    return { ...this.state };
  }

  isAvailable(): boolean {
    return !!RTCPeerConnection && !!mediaDevices;
  }

  // ── Start listening for incoming calls ──────────────────────────────────
  listenForIncomingCalls(): () => void {
    const auth = getFirebaseAuth();
    const myUid = auth?.currentUser?.uid;
    if (!myUid) {
      logger.warn('Cannot listen for calls — not authenticated');
      return () => {};
    }

    const app = initializeFirebase();
    if (!app) return () => {};
    const { getFirestore } = require('firebase/firestore');
    const db = getFirestore(app);

    const incomingRef = doc(db, 'voice_calls_incoming', myUid);

    // Retry-with-backoff for onSnapshot (errors kill subscription permanently)
    let retryCount = 0;
    const MAX_RETRIES = 20;

    const subscribe = (): (() => void) => {
      const unsub = onSnapshot(incomingRef, (snapshot) => {
        retryCount = 0; // Reset on success
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        if (!data?.callId || !data?.callerUid) return;

        // Emit incoming call event
        DeviceEventEmitter.emit(VOICE_CALL_EVENTS.INCOMING_CALL, {
          callId: data.callId,
          callerUid: data.callerUid,
          callerName: data.callerName || 'Bilinmeyen',
        } as IncomingCallData);
      }, (error) => {
        logger.warn('Incoming call listener error:', error);
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(2000 * Math.pow(1.5, retryCount - 1), 60000);
          logger.info(`Retrying incoming call listener in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
          const retryTimer = setTimeout(() => {
            // CRITICAL FIX: Remove fired timer from retryTimers to prevent unbounded array growth.
            // Without this, each subscription error adds a timer ref that is never removed,
            // leaking memory over long sessions with intermittent network issues.
            const timerIdx = this.retryTimers.indexOf(retryTimer);
            if (timerIdx >= 0) this.retryTimers.splice(timerIdx, 1);
            if (this.isDestroyed) return;
            const newUnsub = subscribe();
            const idx = this.unsubscribers.indexOf(unsub);
            if (idx >= 0) this.unsubscribers[idx] = newUnsub;
          }, delay);
          this.retryTimers.push(retryTimer);
        }
      });
      return unsub;
    };

    const unsub = subscribe();
    this.unsubscribers.push(unsub);
    return unsub;
  }

  // ── Initiate outgoing call ──────────────────────────────────────────────
  async startCall(recipientUid: string, recipientName: string): Promise<string | null> {
    if (!this.isAvailable()) {
      logger.error('WebRTC not available');
      DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_FAILED, { reason: 'WebRTC kullanılamıyor' });
      return null;
    }

    // CRITICAL FIX: Guard against calling startCall() twice while already in a call.
    // Without this, a second call creates orphaned WebRTC connections and Firestore docs.
    if (this.state.status !== 'idle') {
      logger.warn(`startCall blocked: already in call state=${this.state.status}, callId=${this.state.callId}`);
      DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_FAILED, { reason: 'Zaten bir arama devam ediyor' });
      return null;
    }

    const auth = getFirebaseAuth();
    const myUid = auth?.currentUser?.uid;
    const myName = auth?.currentUser?.displayName || 'AfetNet Kullanıcı';
    if (!myUid) {
      DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_FAILED, { reason: 'Giriş yapılmamış' });
      return null;
    }

    const normalizedRecipientUid = typeof recipientUid === 'string' ? recipientUid.trim() : '';
    if (!normalizedRecipientUid || !isLikelyFirebaseUid(normalizedRecipientUid)) {
      logger.warn('startCall blocked: invalid recipientUid', { recipientUid });
      DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_FAILED, { reason: 'Geçersiz arama hedefi' });
      return null;
    }

    try {
      const app = initializeFirebase();
      if (!app) throw new Error('Firebase not initialized');
      const db = await getFirestoreInstanceAsync();
      if (!db) return null;

      // Generate call ID
      const callId = `call_${myUid}_${normalizedRecipientUid}_${Date.now()}`;

      this.state = {
        callId,
        status: 'ringing',
        isMuted: false,
        isSpeaker: false,
        remoteUid: normalizedRecipientUid,
        remoteName: recipientName,
        startTime: null,
        isIncoming: false,
      };

      // Ensure call starts on earpiece by default for privacy.
      this.applySpeakerRouting(false);

      // CRITICAL FIX: Request microphone permission before getUserMedia
      try {
        const { Audio } = require('expo-audio');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Microphone permission denied');
        }
      } catch (permError: any) {
        if (permError?.message === 'Microphone permission denied') throw permError;
        // expo-audio not available — proceed anyway, getUserMedia will request permission
      }

      // Get local audio stream
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Create peer connection
      this.pc = new RTCPeerConnection(ICE_SERVERS);

      // CRITICAL FIX: Handle remote audio stream — without this, caller hears NOTHING
      this.pc.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          logger.info('🔊 Remote audio stream received');
          // react-native-webrtc automatically plays remote audio streams
        }
      };

      // Add local tracks
      this.localStream.getTracks().forEach((track: any) => {
        this.pc.addTrack(track, this.localStream);
      });

      // Collect ICE candidates
      this.pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          addDoc(
            collection(db, 'voice_calls', callId, 'callerCandidates'),
            event.candidate.toJSON(),
          ).catch(e => { if (__DEV__) logger.debug('VoiceCall: caller ICE candidate store failed:', e); });
        }
      };

      // Handle connection state
      this.pc.onconnectionstatechange = () => {
        const connState = this.pc?.connectionState;
        if (connState === 'connected') {
          this.state.status = 'connected';
          this.state.startTime = Date.now();
          DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_CONNECTED, { callId });
        } else if (connState === 'disconnected' || connState === 'failed' || connState === 'closed') {
          this.endCall();
        }
      };

      // Create offer
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await this.pc.setLocalDescription(offer);

      // Write call document to Firestore
      await setDoc(doc(db, 'voice_calls', callId), {
        callerUid: myUid,
        callerName: myName,
        recipientUid: normalizedRecipientUid,
        recipientName,
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        status: 'ringing',
        createdAt: serverTimestamp(),
      });

      // Notify recipient (write to their incoming calls doc)
      await setDoc(doc(db, 'voice_calls_incoming', normalizedRecipientUid), {
        callId,
        callerUid: myUid,
        callerName: myName,
        timestamp: serverTimestamp(),
      });

      // Send push notification for incoming call
      try {
        const { getFirebaseApp } = require('../../lib/firebase');
        const { getFunctions, httpsCallable } = require('firebase/functions');
        const functions = getFunctions(getFirebaseApp(), 'europe-west1');
        const sendCallNotification = httpsCallable(functions, 'sendCallNotification');
        await sendCallNotification({
          recipientUid: normalizedRecipientUid,
          callerName: myName,
          callId,
        }).catch(e => { if (__DEV__) logger.debug('VoiceCall: push notification failed:', e); });
      } catch {
        // Push notification is best-effort
      }

      // Listen for answer
      const callUnsub = onSnapshot(doc(db, 'voice_calls', callId), async (snapshot) => {
        const callData = snapshot.data();
        if (!callData) return;

        if (callData.status === 'answered' && callData.answer && this.pc) {
          try {
            const answer = new RTCSessionDescription(callData.answer);
            await this.pc.setRemoteDescription(answer);
            this.state.status = 'connecting';
          } catch (err) {
            logger.error('Failed to set remote description:', err);
          }
        }

        if (callData.status === 'rejected' || callData.status === 'ended') {
          this.endCall();
        }
      }, (error) => {
        logger.warn('Call status listener error:', error);
        this.endCall();
      });
      this.unsubscribers.push(callUnsub);

      // Listen for callee ICE candidates
      const candidateUnsub = onSnapshot(
        collection(db, 'voice_calls', callId, 'calleeCandidates'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && this.pc) {
              const candidate = new RTCIceCandidate(change.doc.data());
              this.pc.addIceCandidate(candidate).catch(e => { if (__DEV__) logger.debug('VoiceCall: callee ICE candidate add failed:', e); });
            }
          });
        },
        (error) => {
          logger.warn('Callee ICE candidates listener error:', error);
        },
      );
      this.unsubscribers.push(candidateUnsub);

      // Auto-timeout: end call if not answered in 45 seconds
      this.autoTimeoutId = setTimeout(() => {
        this.autoTimeoutId = null;
        if (this.state.status === 'ringing') {
          this.endCall();
        }
      }, 45_000);

      logger.info(`📞 Call started: ${callId}`);
      return callId;
    } catch (error) {
      logger.error('Failed to start call:', error);
      this.cleanup();
      DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_FAILED, { reason: 'Arama başlatılamadı' });
      return null;
    }
  }

  // ── Answer incoming call ────────────────────────────────────────────────
  async answerCall(callId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    // CRITICAL FIX: Guard against double-answer (same pattern as startCall).
    // Without this, two rapid taps create duplicate WebRTC connections & Firestore listeners.
    if (this.state.status !== 'idle') {
      logger.warn(`answerCall blocked: already in call state=${this.state.status}`);
      return false;
    }

    const auth = getFirebaseAuth();
    const myUid = auth?.currentUser?.uid;
    if (!myUid) return false;

    try {
      const app = initializeFirebase();
      if (!app) throw new Error('Firebase not initialized');
      const db = await getFirestoreInstanceAsync();
      if (!db) return false;

      // Read call document
      const callSnap = await getDoc(doc(db, 'voice_calls', callId));
      if (!callSnap.exists()) {
        logger.warn('Call document not found');
        return false;
      }

      const callData = callSnap.data();
      if (!callData?.offer) {
        logger.warn('No offer in call document');
        return false;
      }

      // CRITICAL FIX: Validate this call is actually intended for current user.
      // Without this, any authenticated user could answer any call by guessing callId.
      if (callData.recipientUid && callData.recipientUid !== myUid) {
        logger.warn(`answerCall blocked: call is for ${callData.recipientUid}, not ${myUid}`);
        return false;
      }

      this.state = {
        callId,
        status: 'connecting',
        isMuted: false,
        isSpeaker: false,
        remoteUid: callData.callerUid,
        remoteName: callData.callerName || 'Bilinmeyen',
        startTime: null,
        isIncoming: true,
      };

      // Ensure default route is earpiece when answering.
      this.applySpeakerRouting(false);

      // CRITICAL FIX: Request microphone permission before getUserMedia
      try {
        const { Audio } = require('expo-audio');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Microphone permission denied');
        }
      } catch (permError: any) {
        if (permError?.message === 'Microphone permission denied') throw permError;
      }

      // Get local audio stream
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Create peer connection
      this.pc = new RTCPeerConnection(ICE_SERVERS);

      // CRITICAL FIX: Handle remote audio stream
      this.pc.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          logger.info('🔊 Remote audio stream received (callee)');
        }
      };

      // Add local tracks
      this.localStream.getTracks().forEach((track: any) => {
        this.pc.addTrack(track, this.localStream);
      });

      // Collect ICE candidates
      this.pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          addDoc(
            collection(db, 'voice_calls', callId, 'calleeCandidates'),
            event.candidate.toJSON(),
          ).catch(e => { if (__DEV__) logger.debug('VoiceCall: callee ICE candidate store failed:', e); });
        }
      };

      // Handle connection state
      this.pc.onconnectionstatechange = () => {
        const connState = this.pc?.connectionState;
        if (connState === 'connected') {
          this.state.status = 'connected';
          this.state.startTime = Date.now();
          DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_CONNECTED, { callId });
        } else if (connState === 'disconnected' || connState === 'failed' || connState === 'closed') {
          this.endCall();
        }
      };

      // Set remote description (offer)
      const offer = new RTCSessionDescription(callData.offer);
      await this.pc.setRemoteDescription(offer);

      // Create answer
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      // Write answer to Firestore
      await updateDoc(doc(db, 'voice_calls', callId), {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        status: 'answered',
      });

      // Clean up incoming notification
      await deleteDoc(doc(db, 'voice_calls_incoming', myUid)).catch(e => { if (__DEV__) logger.debug('VoiceCall: incoming call doc cleanup failed:', e); });

      // Listen for caller ICE candidates
      const candidateUnsub = onSnapshot(
        collection(db, 'voice_calls', callId, 'callerCandidates'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && this.pc) {
              const candidate = new RTCIceCandidate(change.doc.data());
              this.pc.addIceCandidate(candidate).catch(e => { if (__DEV__) logger.debug('VoiceCall: caller ICE candidate add failed:', e); });
            }
          });
        },
        (error) => {
          logger.warn('Caller ICE candidates listener error:', error);
        },
      );
      this.unsubscribers.push(candidateUnsub);

      // Listen for call status changes (hangup)
      const callUnsub = onSnapshot(doc(db, 'voice_calls', callId), (snapshot) => {
        const data = snapshot.data();
        if (!data || data.status === 'ended') {
          this.endCall();
        }
      }, (error) => {
        logger.warn('Call status listener error (callee):', error);
        this.endCall();
      });
      this.unsubscribers.push(callUnsub);

      logger.info(`📞 Call answered: ${callId}`);
      return true;
    } catch (error) {
      logger.error('Failed to answer call:', error);
      this.cleanup();
      return false;
    }
  }

  // ── Reject incoming call ────────────────────────────────────────────────
  async rejectCall(callId: string): Promise<void> {
    try {
      const app = initializeFirebase();
      if (!app) return;
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      await updateDoc(doc(db, 'voice_calls', callId), {
        status: 'rejected',
      });

      const auth = getFirebaseAuth();
      const myUid = auth?.currentUser?.uid;
      if (myUid) {
        await deleteDoc(doc(db, 'voice_calls_incoming', myUid)).catch(e => { if (__DEV__) logger.debug('VoiceCall: reject incoming doc cleanup failed:', e); });
      }

      logger.info(`📞 Call rejected: ${callId}`);
    } catch (error) {
      logger.error('Failed to reject call:', error);
    }
  }

  // ── End active call ─────────────────────────────────────────────────────
  async endCall(): Promise<void> {
    const callId = this.state.callId;
    if (!callId) {
      this.cleanup();
      return;
    }

    // CRITICAL FIX: Capture remoteUid BEFORE cleanup() resets this.state to idle defaults.
    // The setTimeout below fires 3s later — by then this.state.remoteUid is already null,
    // so the incoming-call doc for the remote user was never cleaned up (phantom notifications).
    const remoteUid = this.state.remoteUid;

    try {
      const app = initializeFirebase();
      if (app) {
        const db = await getFirestoreInstanceAsync();
        // CRITICAL FIX: Do NOT return early if db is null — cleanup() MUST still run below.
        // Previously, `if (!db) return;` exited endCall() without closing the peer connection,
        // releasing the microphone, or emitting CALL_ENDED — the call appeared to hang forever.
        if (!db) {
          logger.warn('Firestore unavailable during endCall — skipping Firestore cleanup, proceeding with local cleanup');
        } else {
          // Update status to 'ended'
          await updateDoc(doc(db, 'voice_calls', callId), {
            status: 'ended',
            endedAt: serverTimestamp(),
          }).catch(e => { if (__DEV__) logger.debug('VoiceCall: end call update failed:', e); });

          // ELITE: Delete call doc after short delay to prevent stuck incoming calls.
          // Without cleanup, stale call docs cause phantom incoming call notifications.
          setTimeout(async () => {
            try {
              await deleteDoc(doc(db, 'voice_calls', callId)).catch(e => {
                if (__DEV__) logger.debug('VoiceCall: call doc delete failed:', e);
              });

              // Also clean up incoming call notification doc for remote user
              if (remoteUid) {
                await deleteDoc(doc(db, 'voice_calls_incoming', remoteUid)).catch(e => {
                  if (__DEV__) logger.debug('VoiceCall: remote incoming doc cleanup failed:', e);
                });
              }
            } catch (e) {
              if (__DEV__) logger.debug('VoiceCall: post-hangup cleanup failed:', e);
            }
          }, 3000); // 3s delay to let remote side process the status change
        }
      }
    } catch {
      // best-effort
    }

    this.cleanup();
    DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_ENDED, { callId });
    logger.info(`📞 Call ended: ${callId}`);
  }

  // ── Toggle mute ─────────────────────────────────────────────────────────
  toggleMute(): boolean {
    if (!this.localStream) return this.state.isMuted;
    const audioTracks = this.localStream.getAudioTracks();
    const newMuted = !this.state.isMuted;
    audioTracks.forEach((track: any) => {
      track.enabled = !newMuted;
    });
    this.state.isMuted = newMuted;
    return newMuted;
  }

  // ── Toggle speaker ──────────────────────────────────────────────────────
  toggleSpeaker(): boolean {
    const newSpeakerState = !this.state.isSpeaker;
    this.state.isSpeaker = newSpeakerState;
    this.applySpeakerRouting(newSpeakerState);
    return newSpeakerState;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  private cleanup(): void {
    // Clear auto-timeout timer
    if (this.autoTimeoutId) {
      clearTimeout(this.autoTimeoutId);
      this.autoTimeoutId = null;
    }

    // Unsubscribe all Firestore listeners
    this.unsubscribers.forEach((unsub) => {
      try { unsub(); } catch { /* ignore */ }
    });
    this.unsubscribers = [];

    // Close peer connection
    if (this.pc) {
      try { this.pc.close(); } catch { /* ignore */ }
      this.pc = null;
    }

    // Release local stream
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track: any) => track.stop());
      } catch { /* ignore */ }
      this.localStream = null;
    }

    // Reset state
    this.state = {
      callId: null,
      status: 'idle',
      isMuted: false,
      isSpeaker: false,
      remoteUid: null,
      remoteName: null,
      startTime: null,
      isIncoming: false,
    };

    // Return route to earpiece/default after call teardown.
    this.applySpeakerRouting(false);
  }

  // ── Re-initialization after destroy (app re-login) ──────────────────────
  // CRITICAL FIX: destroy() sets isDestroyed=true which permanently disables
  // retry logic in listenForIncomingCalls(). Without resetting this flag on
  // re-login, incoming call listener retries are dead for the new user session.
  reinitialize(): void {
    this.isDestroyed = false;
  }

  // ── Full cleanup (app shutdown) ─────────────────────────────────────────
  destroy(): void {
    this.isDestroyed = true;
    this.retryTimers.forEach(t => clearTimeout(t));
    this.retryTimers = [];
    this.cleanup();
  }
}

export const voiceCallService = new VoiceCallServiceImpl();
