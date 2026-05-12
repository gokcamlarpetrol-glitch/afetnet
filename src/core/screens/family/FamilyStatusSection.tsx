/**
 * FAMILY STATUS SECTION - Extracted from FamilyScreen
 * My status buttons (safe, need-help, critical) and location sharing toggle.
 * Contains the heavy status update logic with BLE mesh, Firebase, and backend sync.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, Alert, Linking, ActivityIndicator,
} from 'react-native';

let Location: any = null;
try { Location = require('expo-location'); } catch { /* fallback */ }

let GlassButton: any = ({ title, onPress, ...rest }: any) => {
  const { Pressable, Text: RNText } = require('react-native');
  return <Pressable onPress={onPress} style={{ padding: 12, backgroundColor: '#3b82f6', borderRadius: 12, margin: 4 }}><RNText style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>{title}</RNText></Pressable>;
};
try { GlassButton = require('../../components/buttons/GlassButton').default; } catch { /* fallback */ }

let useFamilyStore: any = () => ({ members: [] });
try { const mod = require('../../stores/familyStore'); useFamilyStore = mod.useFamilyStore; } catch (e: any) { console.error('[FamilyStatusSection] CRITICAL: familyStore import failed:', e?.message); }

let useMeshStore: any = () => ({});
try { useMeshStore = require('../../services/mesh/MeshStore').useMeshStore; } catch { /* fallback */ }

let useSettingsStore: any = () => ({ locationEnabled: false });
try { useSettingsStore = require('../../stores/settingsStore').useSettingsStore; } catch { /* fallback */ }

let bleMeshService: any = null;
try { bleMeshService = require('../../services/BLEMeshService').bleMeshService; } catch { /* fallback */ }

let meshNetworkService: any = null;
try { meshNetworkService = require('../../services/mesh/MeshNetworkService').meshNetworkService; } catch { /* fallback */ }

let MeshMessageType: any = {};
try { MeshMessageType = require('../../services/mesh/MeshProtocol').MeshMessageType; } catch { /* fallback */ }

let familyTrackingService: any = null;
try { familyTrackingService = require('../../services/FamilyTrackingService').familyTrackingService; } catch { /* fallback */ }

let multiChannelAlertService: any = null;
try { multiChannelAlertService = require('../../services/MultiChannelAlertService').multiChannelAlertService; } catch { /* fallback */ }

let identityService: any = { getUid: () => null, getIdentity: () => null, getDisplayName: () => null, getMeshDeviceId: () => null };
try { identityService = require('../../services/IdentityService').identityService; } catch { /* fallback */ }

let getDeviceIdFromLib: any = async () => 'unknown';
try { getDeviceIdFromLib = require('../../utils/device').getDeviceId; } catch { /* fallback */ }

let DirectStorageRef: any = { getString: () => null, setString: () => { } };
try { DirectStorageRef = require('../../utils/storage').DirectStorage; } catch { /* fallback */ }

let haptics: any = { impactLight: () => { }, impactMedium: () => { }, notificationSuccess: () => { }, notificationError: () => { } };
try { haptics = require('../../utils/haptics'); } catch { /* fallback */ }

let createLogger: any = (name: string) => ({ info: console.log, error: console.error, warn: console.warn, debug: console.log });
try { createLogger = require('../../utils/logger').createLogger; } catch { /* fallback */ }

let styles: any = {};
try { styles = require('./FamilyScreen.styles').styles; } catch { /* fallback */ }

import type { FamilyMember } from '../../types/family';
import { isApprovedFamilyMember } from '../../utils/familyApproval';

const logger = createLogger('FamilyStatusSection');
const FAMILY_TRACKING_CONSUMER_ID = 'family-screen';
/** User-scoped status key to prevent cross-account data leak */
const getMyStatusStorageKey = (): string => {
  const uid = identityService?.getUid?.() || 'anonymous';
  return `@afetnet:my_family_status:${uid}`;
};

interface FamilyStatusSectionProps {
  myStatus: 'safe' | 'need-help' | 'unknown' | 'critical';
  onStatusChange: (status: 'safe' | 'need-help' | 'unknown' | 'critical') => void;
  isSharingLocation: boolean;
  onSharingLocationChange: (sharing: boolean) => void;
}

function FamilyStatusSectionInner({
  myStatus,
  onStatusChange,
  isSharingLocation,
  onSharingLocationChange,
}: FamilyStatusSectionProps) {
  const [statusUpdating, setStatusUpdating] = useState(false);
  const locationEnabled = useSettingsStore((state: any) => state.locationEnabled);

  const startLocationSharing = useCallback(async () => {
    if (!locationEnabled) {
      Alert.alert(
        'Konum Paylaşımı Kapalı',
        'Aile üyelerinizle konum paylaşımı için uygulama ayarından konumu aktif etmeniz gerekiyor. Şimdi aktif etmek ister misiniz?',
        [
          { text: 'İptal', style: 'cancel', onPress: () => onSharingLocationChange(false) },
          {
            text: 'Evet, Aç',
            style: 'default',
            onPress: async () => {
              try {
                const { useSettingsStore: useSettings } = require('../../stores/settingsStore');
                useSettings.getState().setLocation(true);
                logger.info('Location enabled via auto-activate prompt');
                // CRITICAL FIX: After enabling location, immediately retry starting location sharing.
                // Without this, the user must tap the button a second time which is confusing during emergencies.
                // Small delay to let the setting propagate through Zustand subscribers.
                setTimeout(() => { void startLocationSharing(); }, 300);
              } catch (e) {
                logger.error('Failed to auto-enable location:', e);
                onSharingLocationChange(false);
              }
            },
          },
        ]
      );
      return;
    }

    if (!Location) {
      Alert.alert('Hata', 'Konum servisi yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
      onSharingLocationChange(false);
      return;
    }

    try {
      // CRITICAL FIX: Use getForegroundPermissionsAsync, NOT requestForegroundPermissionsAsync.
      // Requesting permissions outside of user-triggered onboarding flow violates Apple 5.1.1.
      // If not granted, direct user to Settings instead of triggering the system dialog here.
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Konum İzni Gerekli',
          'Konum paylaşımı için konum iznini uygulama ayarlarından vermeniz gerekiyor.',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
          ]
        );
        onSharingLocationChange(false);
        return;
      }

      if (!familyTrackingService) {
        logger.warn('FamilyTrackingService not available');
        onSharingLocationChange(false);
        return;
      }
      familyTrackingService.setShareThrottleMs(30 * 1000);
      await familyTrackingService.startTracking(FAMILY_TRACKING_CONSUMER_ID);
      await familyTrackingService.shareMyLocation({ force: true, reason: 'family-screen-toggle-on' });
      onSharingLocationChange(true);
      // CRITICAL FIX: Persist sharing state so it auto-resumes on app restart.
      // Without this, location sharing SILENTLY STOPS on every app restart and
      // families cannot find each other during earthquakes.
      try {
        const { useSettingsStore: useSettings } = require('../../stores/settingsStore');
        useSettings.getState().setFamilyLocationSharing(true);
      } catch (e) { logger.warn('Failed to persist family location sharing state:', e); }
      logger.info('Location sharing started successfully');
    } catch (error) {
      logger.error('Start location sharing error:', error);
      Alert.alert('Konum Hatası', 'Konum paylaşımı başlatılamadı. Lütfen konum izinlerini kontrol edin.');
      onSharingLocationChange(false);
    }
  }, [locationEnabled, onSharingLocationChange]);

  const handleShareLocation = useCallback(async () => {
    haptics.impactLight();
    const newSharing = !isSharingLocation;

    if (newSharing) {
      // CRITICAL FIX: Do NOT set sharing=true before startLocationSharing succeeds.
      // Previously the UI showed "Konum Acik" even when permission was denied or
      // the start failed, misleading users into thinking their location was shared.
      await startLocationSharing();
    } else {
      onSharingLocationChange(false);
      familyTrackingService?.stopTracking?.(FAMILY_TRACKING_CONSUMER_ID);
      // Persist sharing OFF so it does not auto-resume on next app restart
      try {
        const { useSettingsStore: useSettings } = require('../../stores/settingsStore');
        useSettings.getState().setFamilyLocationSharing(false);
      } catch (e) { logger.warn('Failed to persist family location sharing state:', e); }
      Alert.alert('Konum Paylaşımı', 'Konum paylaşımı durduruldu');
    }
  }, [isSharingLocation, onSharingLocationChange, startLocationSharing]);

  const handleStatusUpdate = useCallback(async (status: 'safe' | 'need-help' | 'critical') => {
    if (status === myStatus) {
      haptics.impactLight();
      return;
    }

    haptics.notificationSuccess();
    const previousStatus = myStatus;
    setStatusUpdating(true);

    try {
      // Start BLE Mesh if needed
      if (bleMeshService && typeof bleMeshService.getIsRunning === 'function' && !bleMeshService.getIsRunning()) {
        try {
          await bleMeshService.start();
        } catch (error) {
          logger.warn('BLE Mesh start failed (will try to continue):', error);
        }
      }

      // Get location
      let locStatus: string = 'denied';
      let location: any = null;
      if (Location) {
        try {
          const permResult = await Location.getForegroundPermissionsAsync();
          locStatus = permResult.status;
        } catch (permError) {
          logger.warn('Location permission request failed:', permError);
        }
      }

      if (locStatus === 'granted' && Location) {
        try {
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          let timeoutId: NodeJS.Timeout | null = null;
          const timeoutPromise = new Promise<any>((resolve) => {
            timeoutId = setTimeout(() => resolve(null), 10000);
          });
          location = await Promise.race([locationPromise, timeoutPromise]);
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (!location) {
            logger.warn('Location fetch timeout - continuing without location');
          }
        } catch (locationError) {
          logger.warn('Location fetch failed (non-critical):', locationError);
        }
      }

      let resolvedDeviceId = bleMeshService?.getMyDeviceId?.() ?? null;
      if (!resolvedDeviceId) {
        try {
          resolvedDeviceId = await getDeviceIdFromLib();
          if (resolvedDeviceId) {
            useMeshStore.getState().setMyDeviceId(resolvedDeviceId);
          }
        } catch (error) {
          logger.warn('Failed to get device ID from fallback provider:', error);
        }
      }

      const myIdentity = identityService.getIdentity();
      const senderRouteId = (
        resolvedDeviceId ||
        identityService.getUid() ||
        myIdentity?.uid ||
        ''
      ).trim();

      if (!senderRouteId) {
        logger.error('Status update aborted: sender identity could not be resolved');
        haptics.notificationError?.();
        setStatusUpdating(false);
        Alert.alert('Hata', 'Kimlik bilgisi alınamadı. Lütfen tekrar giriş yapıp yeniden deneyin.');
        return;
      }

      // Create status update message
      const statusMessage = JSON.stringify({
        type: 'family_status_update',
        deviceId: senderRouteId,
        senderUid: identityService.getUid() || senderRouteId || 'unknown',
        status,
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
        } : null,
        timestamp: Date.now(),
      });

      // Get all family members with deviceIds
      const familyMembers = useFamilyStore.getState().members;
      const selfIds = new Set(
        [
          senderRouteId,
          resolvedDeviceId,
          identityService.getUid(),
          myIdentity?.uid,
        ].filter((value): value is string => !!value && value.trim().length > 0),
      );
      const reachableMembers = familyMembers.filter((member: FamilyMember) => {
        if (!isApprovedFamilyMember(member)) return false;
        const targets = [
          member.uid?.trim(),
          member.deviceId?.trim(),
        ].filter((value): value is string => !!value && value.length > 0);
        if (targets.length === 0) return false;
        return targets.some((target) => !selfIds.has(target));
      });

      // Send via mesh
      let broadcastSuccess = false;
      if (bleMeshService?.getIsRunning?.() && reachableMembers.length > 0) {
        try {
          for (const member of reachableMembers) {
            const targetId = member.uid?.trim() || member.deviceId?.trim();
            if (targetId && !selfIds.has(targetId)) {
              await meshNetworkService.broadcastMessage(statusMessage, MeshMessageType.STATUS, {
                to: targetId,
                from: senderRouteId,
              });
            }
          }
          broadcastSuccess = true;
        } catch (meshError) {
          logger.warn('BLE Mesh family-only send failed (non-critical):', meshError);
        }
      }

      // Save to Firebase
      try {
        const { firebaseDataService } = await import('../../services/FirebaseDataService');
        const cloudTargetId = identityService.getUid() || myIdentity?.uid || senderRouteId;
        if (cloudTargetId) {
          await firebaseDataService.saveStatusUpdate(cloudTargetId, {
            status,
            location: location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            } : null,
            timestamp: Date.now(),
          });
          if (location) {
            await firebaseDataService.saveLocationUpdate(cloudTargetId, {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || null,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        logger.error('Failed to save status to Firebase:', error);
      }

      // Send to backend
      try {
        const { backendEmergencyService } = await import('../../services/BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          await backendEmergencyService.sendStatusUpdate({
            status,
            location: location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || undefined,
            } : undefined,
            timestamp: Date.now(),
          }).catch((error: unknown) => {
            logger.error('Failed to send status update to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send status update to backend:', error);
      }

      // Firestore fan-out to family members
      try {
        const { getFirestoreInstanceAsync } = await import('../../services/firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (db) {
          const { collection, doc, getDocs, limit, query, setDoc, where } = await import('firebase/firestore');
          const statusPayload = {
            fromDeviceId: senderRouteId,
            senderUid: identityService.getUid() || senderRouteId || 'unknown',
            fromName: identityService.getDisplayName() || 'Aile Uyesi',
            status,
            location: location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            } : null,
            timestamp: Date.now(),
            type: 'status_update',
          };
          // Removed obsolete fan-out. Status changes are explicitly captured
          // at 'users/{uid}/status/current' and 'devices/{deviceId}/status'.
          // Family tracking and live-status views read directly from these
          // Single Source of Truth (SSOT) documents.

          // Update own device doc
          try {
            const ownDeviceDocId = (
              resolvedDeviceId ||
              identityService.getMeshDeviceId?.() ||
              ''
            ).trim();
            if (ownDeviceDocId) {
              const deviceRef = doc(db, 'devices', ownDeviceDocId);
              await setDoc(deviceRef, {
                status: status,
                statusUpdatedAt: Date.now(),
                lastSeen: Date.now(),
              }, { merge: true });
            }
          } catch { /* best effort */ }

          // V3: Update users/{uid}/status/current
          try {
            const { getFirebaseAuth } = await import('../../../lib/firebase');
            const uid = getFirebaseAuth()?.currentUser?.uid;
            if (uid) {
              const v3StatusRef = doc(db, 'users', uid, 'status', 'current');
              await setDoc(v3StatusRef, {
                status: status,
                statusUpdatedAt: Date.now(),
                lastSeen: Date.now(),
                location: location ? {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                } : null,
              }, { merge: true });
            }
          } catch { /* V3 best effort */ }

          // CRITICAL FIX: Fan-out status to each family member's status_updates path.
          // This triggers onFamilyStatusUpdateV3 Cloud Function which sends push notifications.
          // Without this, only "critical" status (via multiChannelAlertService) sent notifications.
          try {
            const statusFanoutPayload = {
              fromDeviceId: senderRouteId,
              senderUid: identityService.getUid() || senderRouteId || 'unknown',
              fromName: identityService.getDisplayName() || 'Aile Üyesi',
              status,
              location: location ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              } : null,
              timestamp: Date.now(),
              type: 'status_update',
              isFamilyFanout: true,
            };

            for (const member of reachableMembers) {
              const memberUid = member.uid?.trim();
              if (memberUid && !selfIds.has(memberUid)) {
                try {
                  const fanoutRef = doc(
                    db,
                    'users',
                    memberUid,
                    'status_updates',
                    `${senderRouteId}_${Date.now()}`
                  );
                  await setDoc(fanoutRef, statusFanoutPayload);
                } catch (fanoutErr) {
                  logger.warn(`Status fanout to ${memberUid} failed:`, fanoutErr);
                }
              }
            }
            if (reachableMembers.length > 0) {
              logger.info(`✅ Status fan-out sent to ${reachableMembers.length} family members`);
            }
          } catch (fanoutError) {
            logger.warn('Family status fan-out failed:', fanoutError);
          }
        }
      } catch (fbError) {
        logger.warn('Firestore status fan-out failed:', fbError);
      }

      const statusText = status === 'safe' ? 'Güvendeyim' :
        status === 'need-help' ? 'Yardıma İhtiyacım Var' :
          'ACİL DURUM';

      const memberCount = reachableMembers.length;
      const deliveryMethod = broadcastSuccess
        ? (memberCount > 0 ? `${memberCount} aile üyesine` : 'Yakındaki cihazlara')
        : 'Bulut sunucusuna';

      Alert.alert(
        'Durum Güncellendi',
        `${statusText} - ${deliveryMethod} bildirildi`,
      );
      onStatusChange(status);
      try { DirectStorageRef.setString(getMyStatusStorageKey(), status); } catch { /* non-critical */ }

      // Send critical alert
      if (status === 'critical') {
        try {
          await multiChannelAlertService?.sendAlert?.({
            title: 'ACIL DURUM',
            body: 'Aile uyesi acil durum bildirdi!',
            priority: 'critical',
            channels: {
              pushNotification: true,
              fullScreenAlert: true,
              alarmSound: true,
              vibration: true,
              tts: true,
            },
            data: {
              type: 'family_status_update',
              status: 'critical',
              deviceId: senderRouteId,
            },
          }).catch((alertError: unknown) => {
            logger.warn('Multi-channel alert failed (non-critical):', alertError);
          });
        } catch (alertError) {
          logger.warn('Multi-channel alert error (non-critical):', alertError);
        }
      }

    } catch (error) {
      onStatusChange(previousStatus);
      logger.error('Status update error:', error);
      haptics.notificationError?.();
      Alert.alert('Hata', 'Durum güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      setStatusUpdating(false);
    }
  }, [myStatus, onStatusChange]);

  const handleStatusButtonPress = useCallback((status: 'safe' | 'need-help' | 'critical' | 'location') => {
    if (statusUpdating) return;
    if (status === 'location') {
      void handleShareLocation().catch((error) => {
        logger.error('Error sharing location:', error);
        haptics.notificationError?.();
      });
    } else {
      void handleStatusUpdate(status).catch((error) => {
        logger.error('Error in handleStatusUpdate:', error);
      });
    }
  }, [statusUpdating, handleShareLocation, handleStatusUpdate]);

  return (
    <View style={styles.statusSection}>
      <Text style={styles.sectionTitle}>Durumum</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <GlassButton
          title="Güvendeyim"
          variant="success"
          icon={statusUpdating && myStatus === 'safe' ? undefined : 'checkmark-circle'}
          disabled={statusUpdating}
          onPress={() => handleStatusButtonPress('safe')}
          style={[
            { flex: 1 },
            myStatus === 'safe'
              ? { backgroundColor: '#10b981', borderWidth: 2, borderColor: '#059669' }
              : { opacity: 0.6, borderWidth: 1, borderColor: '#10b981', borderStyle: 'solid' as const }
          ]}
        />
        <GlassButton
          title="Yardım Lazım"
          variant="secondary"
          icon={statusUpdating && myStatus === 'need-help' ? undefined : 'hand-left'}
          disabled={statusUpdating}
          onPress={() => handleStatusButtonPress('need-help')}
          style={[
            { flex: 1 },
            myStatus === 'need-help'
              ? { backgroundColor: '#f59e0b', borderWidth: 2, borderColor: '#d97706' }
              : { opacity: 0.6, borderWidth: 1, borderColor: '#f59e0b', borderStyle: 'solid' as const }
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GlassButton
          title="ACIL YARDIM"
          variant="danger"
          icon={statusUpdating && myStatus === 'critical' ? undefined : 'alert-circle'}
          disabled={statusUpdating}
          onPress={() => handleStatusButtonPress('critical')}
          style={[
            { flex: 1 },
            myStatus === 'critical'
              ? { backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#dc2626' }
              : { opacity: 0.6, borderWidth: 1, borderColor: '#ef4444', borderStyle: 'solid' as const }
          ]}
        />
        <GlassButton
          title={isSharingLocation ? 'Konum Açık' : 'Konum Paylaş'}
          variant="primary"
          icon={isSharingLocation ? 'location' : 'location-outline'}
          disabled={statusUpdating}
          onPress={() => handleStatusButtonPress('location')}
          style={[
            { flex: 1 },
            isSharingLocation
              ? { backgroundColor: '#3b82f6', borderWidth: 2, borderColor: '#2563eb' }
              : { opacity: 0.8, borderWidth: 1, borderColor: '#3b82f6', borderStyle: 'solid' as const }
          ]}
        />
      </View>
      {statusUpdating && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 6 }}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: '600' }}>Durum bildiriliyor...</Text>
        </View>
      )}
    </View>
  );
}

export const FamilyStatusSection = React.memo(FamilyStatusSectionInner);
