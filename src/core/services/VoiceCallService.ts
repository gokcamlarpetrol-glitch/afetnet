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
import {
  getFirestore,
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
    const db = getFirestore(app);

    const incomingRef = doc(db, 'voice_calls_incoming', myUid);
    const unsub = onSnapshot(incomingRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (!data?.callId || !data?.callerUid) return;

      // Emit incoming call event
      DeviceEventEmitter.emit(VOICE_CALL_EVENTS.INCOMING_CALL, {
        callId: data.callId,
        callerUid: data.callerUid,
        callerName: data.callerName || 'Bilinmeyen',
      } as IncomingCallData);
    });

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

    const auth = getFirebaseAuth();
    const myUid = auth?.currentUser?.uid;
    const myName = auth?.currentUser?.displayName || 'AfetNet Kullanıcı';
    if (!myUid) {
      DeviceEventEmitter.emit(VOICE_CALL_EVENTS.CALL_FAILED, { reason: 'Giriş yapılmamış' });
      return null;
    }

    try {
      const app = initializeFirebase();
      if (!app) throw new Error('Firebase not initialized');
      const db = getFirestore(app);

      // Generate call ID
      const callId = `call_${myUid}_${recipientUid}_${Date.now()}`;

      this.state = {
        callId,
        status: 'ringing',
        isMuted: false,
        isSpeaker: false,
        remoteUid: recipientUid,
        remoteName: recipientName,
        startTime: null,
        isIncoming: false,
      };

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
          ).catch(() => {});
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
        recipientUid,
        recipientName,
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        status: 'ringing',
        createdAt: serverTimestamp(),
      });

      // Notify recipient (write to their incoming calls doc)
      await setDoc(doc(db, 'voice_calls_incoming', recipientUid), {
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
          recipientUid,
          callerName: myName,
          callId,
        }).catch(() => {});
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
      });
      this.unsubscribers.push(callUnsub);

      // Listen for callee ICE candidates
      const candidateUnsub = onSnapshot(
        collection(db, 'voice_calls', callId, 'calleeCandidates'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && this.pc) {
              const candidate = new RTCIceCandidate(change.doc.data());
              this.pc.addIceCandidate(candidate).catch(() => {});
            }
          });
        },
      );
      this.unsubscribers.push(candidateUnsub);

      // Auto-timeout: end call if not answered in 45 seconds
      setTimeout(() => {
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

    const auth = getFirebaseAuth();
    const myUid = auth?.currentUser?.uid;
    if (!myUid) return false;

    try {
      const app = initializeFirebase();
      if (!app) throw new Error('Firebase not initialized');
      const db = getFirestore(app);

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
          ).catch(() => {});
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
      await deleteDoc(doc(db, 'voice_calls_incoming', myUid)).catch(() => {});

      // Listen for caller ICE candidates
      const candidateUnsub = onSnapshot(
        collection(db, 'voice_calls', callId, 'callerCandidates'),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && this.pc) {
              const candidate = new RTCIceCandidate(change.doc.data());
              this.pc.addIceCandidate(candidate).catch(() => {});
            }
          });
        },
      );
      this.unsubscribers.push(candidateUnsub);

      // Listen for call status changes (hangup)
      const callUnsub = onSnapshot(doc(db, 'voice_calls', callId), (snapshot) => {
        const data = snapshot.data();
        if (!data || data.status === 'ended') {
          this.endCall();
        }
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
      const db = getFirestore(app);

      await updateDoc(doc(db, 'voice_calls', callId), {
        status: 'rejected',
      });

      const auth = getFirebaseAuth();
      const myUid = auth?.currentUser?.uid;
      if (myUid) {
        await deleteDoc(doc(db, 'voice_calls_incoming', myUid)).catch(() => {});
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

    try {
      const app = initializeFirebase();
      if (app) {
        const db = getFirestore(app);
        await updateDoc(doc(db, 'voice_calls', callId), {
          status: 'ended',
          endedAt: serverTimestamp(),
        }).catch(() => {});
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
    this.state.isSpeaker = !this.state.isSpeaker;
    // Note: Speaker mode requires InCallManager or native module
    // For now, track the state for UI purposes
    return this.state.isSpeaker;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  private cleanup(): void {
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
  }

  // ── Full cleanup (app shutdown) ─────────────────────────────────────────
  destroy(): void {
    this.cleanup();
  }
}

export const voiceCallService = new VoiceCallServiceImpl();
