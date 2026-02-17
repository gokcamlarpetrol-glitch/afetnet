# Phase 7 - Fix Log (P0/P1) - Current Cycle

Date: 2026-02-14

## Applied Fixes

1. **Family quick message send argument order fixed**
   - File: `src/core/screens/family/FamilyScreen.tsx`
   - Details:
     - Corrected `hybridMessageService.sendMessage(content, recipientId)` argument order.
     - Added self-identity filter using UID/id/deviceId set.
   - Impact: prevents silent quick-message failures.

2. **Map member message action changed to UID-first target**
   - File: `src/core/screens/map/DisasterMapScreen.tsx`
   - Details:
     - Conversation navigation now uses `uid || id || deviceId`.
   - Impact: consistent thread resolution with mixed legacy identities.

3. **Cloud message write success criteria corrected**
   - File: `src/core/services/FirebaseDataService.ts`
   - Details:
     - `saveMessage` now returns success only when at least one write path actually succeeds.
     - Logs unresolved conversation creation.
   - Impact: avoids false-positive sent state and masked persistence failures.

4. **Offline sync retry scheduling hardened**
   - File: `src/core/services/OfflineSyncService.ts`
   - Details:
     - Added timed backoff retry scheduling for pending failed queue items.
     - Added timer cleanup consistency in destroy.
   - Impact: improves eventual consistency under transient network faults.

5. **Mesh communication screen send-result misuse fixed**
   - File: `src/core/screens/mesh/MeshNetworkScreen.tsx`
   - Details:
     - Removed boolean-style success check on `hybridMessageService.sendMessage`.
     - Switched to `try/catch` based send handling.
   - Impact: prevents incorrect send-state handling in communication screen.

6. **UID/deviceId compatibility hardened for status/location writes**
   - File: `src/core/services/FirebaseDataService.ts`
   - Details:
     - Added backward-compatible UID resolver for user-scoped Firestore paths.
     - `saveLocationUpdate` and `saveStatusUpdate` now resolve UID before write.
     - `subscribeToUserLocation` now uses async Firestore subscription path.
   - Impact: prevents silent cloud sync failures caused by legacy deviceId inputs.

7. **Family QR interoperability fix**
   - Files:
     - `src/core/screens/family/FamilyScreen.tsx`
     - `src/core/screens/family/AddFamilyMemberScreen.tsx`
   - Details:
     - Family tab now shares/parades IdentityService QR payload (not raw deviceId-only QR).
     - Add-member scanner now supports URI-decoded payload and plain ID/UID fallback.
   - Impact: removes app-generated QR false negatives and stabilizes member add flow.

8. **Family member data normalization and persistence completeness**
   - File: `src/core/services/firebase/FirebaseFamilyOperations.ts`
   - Details:
     - Added robust timestamp normalization (seconds/ms/ISO/Timestamp objects).
     - Persisted and loaded full member state (`lastSeen`, `location`, `battery`, `notes`, `updatedAt`).
     - Applied same normalization to legacy load and realtime subscription paths.
   - Impact: fixes stale member cards, time anomalies, and missing location metadata after reload.

9. **Family facade owner resolution hardened**
   - File: `src/core/services/FirebaseDataService.ts`
   - Details:
     - Family save/load/delete/subscribe now resolve owner UID when legacy deviceId is provided.
   - Impact: prevents accidental family namespace drift and improves auth-race resilience.

10. **Messaging self-identity normalization (UID/publicCode/deviceId)**
   - Files:
     - `src/core/services/HybridMessageService.ts`
     - `src/core/stores/messageStore.ts`
     - `src/core/screens/messages/ConversationScreen.tsx`
     - `src/core/screens/messages/MessagesScreen.tsx`
   - Details:
     - Fixed sender self-detection to include UID/public code/deviceId aliases.
     - Normalized stored outgoing messages to `from: 'me'` to avoid legacy self-thread corruption.
     - Updated conversation/message filters to treat all self aliases consistently.
   - Impact: resolves missing own messages, wrong thread targeting, and unread count drift in mixed identity states.

11. **Family group offline mesh routing and fallback send hardened**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Accepted `group:<id>` recipients in group-message filter (instead of wrongly treating as direct DM target).
     - Extended parser to accept GroupChatService mesh payload contract (`groupId` + `content`).
     - Removed hard dependency on `myDeviceId` for sending text (cloud path can proceed without it).
     - Switched to group-send-first + mesh fallback only when group send fails.
   - Impact: prevents dropped group packets and improves online/offline continuity without duplicate fan-out.

12. **Family/map timestamp freshness normalization hardened**
   - Files:
     - `src/core/utils/dateUtils.ts`
     - `src/core/components/map/FamilyMarker.tsx`
     - `src/core/components/family/MemberCard.tsx`
   - Details:
     - Exported shared `normalizeTimestampMs` helper (seconds/ms/Date/string safe normalization).
     - Updated map marker stale/very-old and time-ago logic to run on normalized timestamp.
     - Updated member-card online indicator to use normalized timestamp instead of raw compare.
   - Impact: removes false stale/offline rendering from mixed timestamp units.

13. **Status write timestamp contract aligned to numeric ms**
   - File: `src/core/screens/family/FamilyScreen.tsx`
   - Details:
     - Replaced ISO-string `lastSeen` writes with `Date.now()` in both device and user status documents.
   - Impact: keeps Firestore status timeline consistent with app-wide numeric timestamp expectations.

14. **Timestamp normalization regression test coverage added**
   - File: `src/core/utils/__tests__/dateUtils.test.ts`
   - Details:
     - Added unit tests for seconds->ms normalization, invalid timestamp fallback, and relative-time rendering.
   - Impact: prevents reintroduction of "çok eski / yanlış gün sayısı" regressions from mixed timestamp units.

15. **ErrorBoundary crash diagnostics enriched (fingerprint + source component)**
   - File: `src/core/components/ErrorBoundary.tsx`
   - Details:
     - Added deterministic error fingerprint hash from message + stack + component stack.
     - Added source-component extraction and surfaced it in both UI and Crashlytics metadata.
     - Replaced generic runtime-only ID with enriched ID (`err_<timestamp>_<fingerprint>`).
   - Impact: TestFlight error screens now provide actionable crash provenance for root-cause isolation.

16. **Group chat Firestore rule compatibility fixed (`senderUid`)**
   - Files:
     - `src/core/services/firebase/FirebaseGroupOperations.ts`
     - `src/core/services/GroupChatService.ts`
     - `src/core/services/__tests__/GroupChatService.test.ts`
   - Details:
     - Group message writes now include `senderUid` alias populated from `from` UID.
     - Group message reads/subscriptions now tolerate legacy docs lacking `from` by falling back to `senderUid`.
     - Added regression test to assert `senderUid === auth.uid` on send path.
     - Hardened mesh fallback sender ID to avoid empty `from` in fallback broadcast.
   - Impact: eliminates permission-denied on group message creates under V3 conversation rules.

17. **Family realtime listeners now subscribe to both UID and device paths**
   - File: `src/core/stores/familyStore.ts`
   - Details:
     - `syncMemberLocationSubscriptions` now attaches both `users/{uid}` and `devices/{deviceId}` listeners when both identifiers exist.
     - `syncStatusUpdateListeners` now mirrors the same dual-path subscription behavior.
   - Impact: prevents missed family updates in mixed legacy/V3 identity traffic.

18. **Crashlytics/global error hooks are now initialized at app bootstrap**
   - File: `src/core/init.ts`
   - Details:
     - Added early `firebaseCrashlyticsService.initialize()` call before feature module startup.
   - Impact: TestFlight runtime errors now get captured consistently with global handlers active from app launch.

19. **New message contact list `lastSeen` display normalized**
   - File: `src/core/screens/messages/NewMessageScreen.tsx`
   - Details:
     - Replaced raw `new Date(lastSeen)` rendering with shared `formatLastSeen()` helper.
   - Impact: removes incorrect contact last-seen times caused by seconds/ms drift.

20. **DM cloud recipient identity resolution hardened (alias -> UID)**
   - File: `src/core/services/FirebaseDataService.ts`
   - Details:
     - Added dedicated recipient resolver for DM writes (`uid/public code/deviceId/qrId`).
     - Prevented non-UID participant writes in conversation create flow by resolving aliases first.
     - Corrected legacy write fallback target to recipient device path when available.
   - Impact: reduces orphaned DM threads and improves online message delivery consistency.

21. **Family group media send path moved to cloud-first durability**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Added shared on-demand `ensureActiveGroupId()` for both text and media sends.
     - Media sends now try GroupChatService first; image/voice uploads to Firebase Storage before thread write.
     - Base64 decode switched to `Buffer.from(..., 'base64')` in upload path to avoid `atob` runtime dependency issues.
     - Retained Hybrid mesh send as fallback when group/cloud path fails.
   - Impact: improves persistence and cross-device visibility of group image/voice/location messages.

22. **Navigation route correlation added to crash diagnostics**
   - Files:
     - `src/core/navigation/navigationRef.ts`
     - `src/core/App.tsx`
     - `src/core/components/ErrorBoundary.tsx`
   - Details:
     - Added global active-route tracker and wired it to `NavigationContainer` state changes.
     - ErrorBoundary now includes current route in UI, crash report payload, and copied error report text.
   - Impact: TestFlight crash reports can now be mapped directly to failing screen context.

23. **SOS payload identity contract hardened (`senderUid` + alias-safe routing)**
   - Files:
     - `src/core/services/sos/SOSChannelRouter.ts`
     - `src/core/services/sos/SOSAlertListener.ts`
     - `src/core/services/sos/NearbySOSListener.ts`
     - `src/core/services/sos/SOSStateManager.ts`
     - `src/core/screens/map/DisasterMapScreen.tsx`
     - `src/core/screens/family/FamilyScreen.tsx`
     - `src/core/screens/messages/SOSConversationScreen.tsx`
   - Details:
     - SOS family/global payload now includes canonical `senderUid` (and `userId` alias on broadcast docs).
     - Incoming SOS store model extended with `senderUid`.
     - SOS map/family navigation to `SOSConversation` now prefers UID with alias set fallback.
     - SOS conversation thread matching now uses peer alias set (UID/device/contact/family mapping) instead of single-ID equality.
   - Impact:
     - Reduces responder-to-victim routing mismatches in mixed legacy/V3 identity states.
     - Improves online SOS message delivery probability by targeting canonical UID when available.

24. **SOS ACK delivery and listener resilience upgraded (dual-path + multi-target)**
   - Files:
     - `src/core/services/sos/SOSChannelRouter.ts`
     - `src/core/services/sos/SOSAckListener.ts`
   - Details:
     - `sendRescueACK` now writes ACK records to both sender alias targets (device and optional UID), including V3 ack path.
     - ACK listener now subscribes across self identity aliases (deviceId + uid + legacy IDs) instead of a single path.
     - ACK timestamp handling now normalized for mixed timestamp formats.
   - Impact:
     - Victim sees rescue ACK more reliably across legacy/V3 identity combinations.
     - Prevents ACK loss when sender/receiver identity path differs by UID vs device alias.

25. **Nearby SOS realtime listener made index-light**
   - File: `src/core/services/sos/NearbySOSListener.ts`
   - Details:
     - Removed `status + timestamp` composite query dependency.
     - Listener now queries on `timestamp` window and filters `status === active` client-side.
     - Added self-message skip by both `senderDeviceId` and `senderUid`.
   - Impact:
     - Avoids silent listener failure due to missing composite index on `sos_broadcasts`.
     - Improves foreground nearby-SOS reception reliability.

26. **Unified SOS controller sender identity freshness hardened**
   - File: `src/core/services/sos/UnifiedSOSController.ts`
   - Details:
     - Added runtime user-id resolver (`identityService uid` -> `auth uid` -> `deviceId`) and refresh before trigger/force.
   - Impact:
     - Reduces chance of SOS being emitted with stale non-canonical sender identity after auth transitions.

27. **Family/Messages conversation targeting hardened against local `family-*` IDs**
   - Files:
     - `src/core/screens/family/FamilyScreen.tsx`
     - `src/core/screens/messages/NewMessageScreen.tsx`
     - `src/core/screens/messages/ConversationScreen.tsx`
   - Details:
     - Added UID/deviceId-first member target resolver; generated local record IDs are no longer used as message recipient IDs.
     - Family card/map actions now fail-fast with user alert when no routable identity exists.
     - Conversation screen now blocks send/media actions if recipient identity resolves to non-routable target.
   - Impact:
     - Prevents silent DM delivery failures and wrong-thread creation from family list/map entry points.

28. **New-message alias dedup and self-target checks strengthened**
   - File: `src/core/screens/messages/NewMessageScreen.tsx`
   - Details:
     - Added alias-set based existing conversation resolver (uid/device/public/device alias match).
     - Manual/scanned self-add checks now validate against all self aliases (uid + deviceId + identity IDs), not only one deviceId string.
   - Impact:
     - Reduces duplicate thread creation and avoids accidental self-chat setup in mixed identity states.

29. **`messageStore` alias-canonicalization and conversation-state consistency hardened**
   - File: `src/core/stores/messageStore.ts`
   - Details:
     - Added alias-aware identity matcher helpers and equivalent-conversation resolution.
     - `addConversation` now rejects non-routable IDs and deduplicates by alias-equivalence (not raw ID equality only).
     - `markConversationRead`, `deleteConversation`, `pinConversation`, `muteConversation` now operate on alias sets.
     - `searchMessages(conversationId)` now uses alias-aware `getConversationMessages`.
     - Added sorted insertion guard in incremental conversation index updates.
     - Forward action now canonicalizes recipient and rejects invalid target IDs.
   - Impact:
     - Reduces split-thread behavior, read/unread drift, and metadata desync when the same person appears as UID/device/public-code aliases.

30. **Messages list content search made alias-safe**
   - File: `src/core/screens/messages/MessagesScreen.tsx`
   - Details:
     - Replaced manual raw message bucketing with `messageStore.getConversationMessages(conv.userId)` in filter path.
   - Impact:
     - Prevents search misses caused by UID/device/public-code alias mismatch for the same conversation.

31. **Family add-member flow now blocks self-add and keeps UID/device semantics clean**
   - File: `src/core/screens/family/AddFamilyMemberScreen.tsx`
   - Details:
     - Added self-identity candidate resolver (`uid/public code/deviceId`) and blocked self-add in QR/manual flows.
     - Manual ID typing now derives `targetUid` only for UID-like inputs and avoids writing UID into `deviceId` by default.
   - Impact:
     - Prevents self-entry records that break family safety flows and avoids invalid `devices/{uid}` routing assumptions.

32. **Family store startup migration now normalizes stale/corrupt member records**
   - File: `src/core/stores/familyStore.ts`
   - Details:
     - Added record-level normalization for cached and realtime-loaded members (ID trimming, status validation, timestamp sanity checks, numeric coordinate guards).
     - Added reasonable timestamp lower-bound filtering to suppress epoch/garbage `lastSeen` values from legacy data.
   - Impact:
     - Reduces false "çok eski gün" time badges and improves stability for users carrying forward old local/cloud family data.

33. **New-message QR scanner duplicate-read storm prevention**
   - File: `src/core/screens/messages/NewMessageScreen.tsx`
   - Details:
     - Added QR scan cooldown lock and guarded `CameraView.onBarcodeScanned` during cooldown.
     - Added cooldown timer cleanup on unmount.
   - Impact:
     - Prevents repeated alert/navigation bursts from the same QR frame and stabilizes add-contact flow.

34. **Newly added family members no longer get false-fresh `lastSeen`**
   - File: `src/core/screens/family/AddFamilyMemberScreen.tsx`
   - Details:
     - New members now start with `lastSeen: 0` until first real activity update.
   - Impact:
     - Prevents misleading "şimdi/çok yeni" availability inference for members who have never sent status/location.

35. **Family group cloud convergence now waits for group snapshot and avoids self-only cloud shards**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Added best-candidate existing group selection and in-flight create dedupe.
     - Added snapshot-gated group creation to avoid premature duplicate group create during startup races.
     - Added guard to skip creating cloud group when peers exist but no resolvable peer UID is available.
   - Impact:
     - Prevents fragmented/self-only family cloud groups and preserves shared thread continuity.

36. **Base64 runtime hardening in media/voice/group-mesh critical paths (`Buffer` migration)**
   - Files:
     - `src/core/services/HybridMessageService.ts`
     - `src/core/services/VoiceMessageService.ts`
     - `src/core/services/mesh/GroupKeyService.ts`
     - `src/core/services/mesh/MeshCompressionService.ts`
   - Details:
     - Replaced `atob/btoa` dependent paths with `Buffer` encode/decode.
   - Impact:
     - Removes Hermes/TestFlight runtime dependency on missing globals and stabilizes media/voice encode/decode operations.

37. **Family group voice recording lifecycle cleanup + rejection-safe voice backup**
   - Files:
     - `src/core/screens/family/FamilyGroupChatScreen.tsx`
     - `src/core/screens/messages/ConversationScreen.tsx`
   - Details:
     - Added unmount interval/session cleanup and duplicate-record-start guard.
     - Converted voice backup fire-and-forget calls to explicit `.catch(...)` logging.
   - Impact:
     - Reduces recording lifecycle leaks and avoids unhandled rejection noise/crash-risk during backup failures.

38. **Blocked-message ingestion now enforces alias-aware sender blocking**
   - File: `src/core/stores/messageStore.ts`
   - Details:
     - Replaced exact `blockedUsers.includes(from)` check with alias-expanded identity matching in `addMessage`.
   - Impact:
     - Prevents blocked users from bypassing filters via UID/device/public-code alias drift.

39. **Direct conversation block action now blocks peer aliases and deletes canonical thread**
   - File: `src/core/screens/messages/ConversationScreen.tsx`
   - Details:
     - Block flow now applies to full peer alias set and conversation delete uses canonical active recipient.
   - Impact:
     - Improves block effectiveness and reduces re-appearing conversations via alternate identity aliases.

40. **Add-family QR scanner latch/reset reliability hardened**
   - File: `src/core/screens/family/AddFamilyMemberScreen.tsx`
   - Details:
     - Added scanner reset timeout ref + cleanup on unmount.
     - Duplicate/invalid/self-scan branches now schedule scanner unlock.
     - Switching back to QR tab now force-unlocks scanner state.
   - Impact:
     - Eliminates stuck scanner states and improves repeated add-attempt reliability.

41. **Group subscriptions now cancel safely during async setup race windows**
   - File: `src/core/services/firebase/FirebaseGroupOperations.ts`
   - Details:
     - Added `isDisposed` guards for `subscribeToGroupMessages` and `subscribeToMyGroupConversations`.
     - If component unmounts before onSnapshot registration completes, newly created listener is immediately unsubscribed.
   - Impact:
     - Prevents zombie listeners, duplicate callbacks, and incremental memory pressure in rapid navigation cycles.

42. **Group mesh payload enriched for offline media/location fidelity**
   - File: `src/core/services/GroupChatService.ts`
   - Details:
     - Mesh payload now includes `mediaType`, `mediaUrl`, `mediaDuration`, `mediaThumbnail`, `location`, `replyTo`, `replyPreview`, and `senderUid`.
     - Mesh sender ID now has robust fallback (`fromDeviceId || uid`).
   - Impact:
     - Offline group participants receive complete message context instead of text-only degradation.

43. **Family cloud group metadata hardened for creator device identity**
   - File: `src/core/services/GroupChatService.ts`
   - Details:
     - `createGroup` now guarantees `participantDeviceIds[myUid]` is populated using identity fallback chain.
   - Impact:
     - Reduces sender identity ambiguity for mesh fallback and group participant routing.

44. **Family group mesh parser/merge now preserves payload media and location**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Extended payload parser to normalize embedded media/location fields from both family-channel and group-service payload shapes.
     - Merge path now prioritizes parsed payload media over sparse mesh envelope fields.
   - Impact:
     - Media/location messages render correctly in offline mesh path.

45. **Direct conversation UI now enforces alias-aware blocked filtering on merged streams**
   - File: `src/core/screens/messages/ConversationScreen.tsx`
   - Details:
     - Added alias-expansion helpers for identity matching (`contact + family aliases`).
     - Applied blocked filtering to both `messageStore` and `meshStore` merge passes before render.
   - Impact:
     - Closes UI-level blocked-message bypass where alternate ingestion source still showed blocked sender traffic.

46. **New-message QR flow now blocks self-scan and supports URI-decoded payloads**
   - File: `src/core/screens/messages/NewMessageScreen.tsx`
   - Details:
     - Added decode fallback (`decodeURIComponent`) for QR payload parsing.
     - Added self-identity guard for payload and raw-ID fallback paths.
     - Conversation start calls from QR path are now awaited for deterministic flow.
   - Impact:
     - Prevents accidental self-conversation loops and improves scan robustness for encoded QR payloads.

47. **Family location tracking lifecycle unified under a single consumer identity**
   - File: `src/core/screens/family/FamilyScreen.tsx`
   - Details:
     - Introduced `FAMILY_TRACKING_CONSUMER_ID` and removed mixed `FamilyScreen`/`family-screen` consumer usage.
     - `handleShareLocation` now only toggles intent state; actual start/stop is handled in one effect lifecycle.
     - Family update ingest now resolves sender aliases (`uid/deviceId/senderId`) and batches by `member.id`.
     - Status fan-out payload now includes `senderUid`, and sender name resolves from identity display name.
   - Impact:
     - Eliminates duplicate-tracking/race behavior, improves offline family update matching, and stabilizes location sharing teardown behavior.

48. **Family map online-state rendering hardened against stale timestamps**
   - File: `src/core/components/family/FamilyMapView.tsx`
   - Details:
     - Replaced status-based online heuristic with normalized `lastSeen` recency check.
     - Added `normalizeTimestampMs` usage and 10-minute freshness threshold while preserving explicit `member.isOnline === true` override.
   - Impact:
     - Prevents stale members from appearing active on map pulse/ring UI and improves situational accuracy.

49. **Messages list now excludes non-routable legacy conversation IDs**
   - File: `src/core/screens/messages/MessagesScreen.tsx`
   - Details:
     - Added `isRoutableConversationId` guard and derived `routableConversations` list.
     - Search suggestion and filtered-list pipelines now operate only on routable conversations.
   - Impact:
     - Prevents users from opening stale/broken threads backed by non-routable local IDs.

50. **Conversation reply mode now persists thread metadata on send**
   - File: `src/core/screens/messages/ConversationScreen.tsx`
   - Details:
     - Outbound DM send now forwards `replyTo` + `replyPreview` when reply banner is active.
     - Reply state is cleared only after successful send.
   - Impact:
     - Restores functional reply threading behavior in direct conversations.

51. **Identity QR parser hardened for TestFlight compatibility**
   - File: `src/core/services/IdentityService.ts`
   - Details:
     - Relaxed v3 parser contract to accept code-only payloads when `uid` is temporarily unavailable.
     - Added deep-link/query extraction support (`payload`, `data`, `qr`, `code`, `id` params).
     - Added structured best-effort parsing for unknown payload versions and plain UID/code fallbacks.
   - Impact:
     - Reduces false “Geçersiz AfetNet QR Kodu” outcomes in add-member/new-message QR flows.

52. **Family member realtime merge deduplicated by identity alias set**
   - File: `src/core/stores/familyStore.ts`
   - Details:
     - Added alias helpers (`id/uid/deviceId`) and `mergeFamilyMembersByIdentity` to merge local/cloud records safely.
     - Replaced fragile `uid || id` key-map merge that could create duplicate entries for the same person.
     - Strengthened `addMember` duplicate guard to detect overlap on any identity alias.
   - Impact:
     - Prevents split/duplicated family members and stabilizes downstream action routing.

53. **Hybrid send payload now preserves reply metadata across channels**
   - File: `src/core/services/HybridMessageService.ts`
   - Details:
     - Added `replyTo` and `replyPreview` to mesh payload and cloud write payload.
   - Impact:
     - Keeps reply threading context intact for both offline mesh and online cloud delivery paths.

54. **Hybrid cloud fallback target corrected for unresolved-recipient cases**
   - File: `src/core/services/HybridMessageService.ts`
   - Details:
     - Updated `firebaseDataService.saveMessage(...)` fallback argument to prefer recipient identity instead of sender identity.
   - Impact:
     - Avoids accidental sender-path legacy writes that reduce DM delivery reliability when recipient resolution degrades.

55. **Family status/location remote updates now avoid write-back loops**
   - Files:
     - `src/core/stores/familyStore.ts`
     - `src/core/screens/family/FamilyScreen.tsx`
   - Details:
     - Extended `updateMemberStatus` with optional `source` parameter and gated cloud/backend writes to `source === 'local'`.
     - Updated remote listener callsites and pending-update applier to pass `'remote'` for both status and location updates.
   - Impact:
     - Prevents remote snapshot updates from re-triggering outbound writes, improving realtime stability.

56. **Family tracking alias sync fixed (`uid/deviceId` -> canonical member ID)**
   - File: `src/core/services/FamilyTrackingService.ts`
   - Details:
     - When member is matched by alias, FamilyStore sync now uses resolved `member.id` (not raw incoming alias).
     - FamilyStore sync is marked remote (`source='remote'`) to prevent feedback loops.
   - Impact:
     - Restores reliable family location/status propagation under mixed identity aliases.

57. **Family tracking startup no longer hard-fails without UID**
   - File: `src/core/services/FamilyTrackingService.ts`
   - Details:
     - `startTracking` now allows fallback identity (`identityService.getMyId()` / device ID) when UID is not yet available.
   - Impact:
     - Preserves offline/mesh-first tracking startup in auth-race or limited-connectivity scenarios.

58. **Group chat auth-race hardening (no false-initialized subscription state)**
   - File: `src/core/services/GroupChatService.ts`
   - Details:
     - Added safe auth accessor and guarded `initialize()` to skip subscription setup until auth user is available.
     - Replaced direct `getAuth().currentUser` reads in create/send/system/leave paths with safe accessor.
   - Impact:
     - Prevents family group chat from silently staying unsubscribed when service initializes before auth settles.

59. **Family group screen auth access hardened against startup crashes**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Added safe auth helper and replaced direct auth reads in participant model + read-marking flow.
     - Removed dynamic auth import in media-upload path; uses safe accessor fallback.
   - Impact:
     - Reduces ErrorBoundary-triggering crash risk during app/auth initialization races.

60. **Contact QR import now enforces valid UID semantics**
   - File: `src/core/services/ContactService.ts`
   - Details:
     - Added UID regex guard for QR-derived `cloudUid`.
     - `resolveCloudUid()` now returns only valid UID values.
     - Contact requests after QR import now require a valid UID target.
   - Impact:
     - Avoids invalid cloud routing (`users/{AFN-*}` style targets) and improves DM/contact-request reliability.

61. **Family tracking freshness normalization no longer fabricates recent activity**
   - File: `src/core/services/FamilyTrackingService.ts`
   - Details:
     - Added reasonable timestamp normalization in `syncMembersFromStore()`.
     - Removed `Date.now()` fallback for unknown `lastSeen`; preserves `0` unknown state.
   - Impact:
     - Prevents false “online/just now” presence for members without real telemetry.

62. **Family group sender allow-list now resolves UID aliases**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Extended `allowedSenderIds` construction to add contact-resolved UID aliases for member `id/deviceId` values.
   - Impact:
     - Prevents valid group messages from being dropped when sender identity arrives as UID but local family record is alias-based.

63. **Create-group member identity model is now UID-first and live-synced**
   - File: `src/core/screens/messages/CreateGroupScreen.tsx`
   - Details:
     - Added UID resolver (`uid/id/deviceId -> canonical uid`) with `ContactService` fallback.
     - Group participant mapping now uses UID keys for `memberUids`, `memberNames`, `memberDeviceIds`.
     - Added guard to block group creation when selected members lack resolvable UID.
     - Selection list now refreshes when family members update, preserving selected state.
   - Impact:
     - Fixes cloud group membership mismatches and prevents silently broken groups.

64. **Family-group fallback messaging no longer routes through DM broadcast channel**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Replaced fallback `HybridMessageService.sendMessage(..., broadcast)` path with direct `meshNetworkService.broadcastMessage` on family group channel.
     - Added optimistic local group message append for fallback path (text + media/location metadata).
   - Impact:
     - Prevents direct-message conversation pollution (`broadcast` ghost threads) and stabilizes offline family group UX.

65. **FamilyStore last-known-location timestamp normalization avoids synthetic freshness**
   - File: `src/core/stores/familyStore.ts`
   - Details:
     - Replaced `lastKnownLocation.timestamp || Date.now()` fallback with normalized historical fallback chain (`lastSeen/updatedAt/createdAt/0`).
   - Impact:
     - Eliminates false “recent location” artifacts in family map/detail surfaces.

66. **DM conversation canonicalization now excludes non-routable broadcast/group IDs**
   - Files:
     - `src/core/stores/messageStore.ts`
     - `src/core/screens/messages/MessagesScreen.tsx`
   - Details:
     - Added non-routable ID guard (`broadcast`, `group:*`, `family-*`) to canonical peer resolution.
     - Added list-level route filter hardening in Messages screen for the same ID classes.
   - Impact:
     - Prevents ghost/invalid threads from broadcast/group traffic and stabilizes conversation navigation.

67. **Family group convergence hardened with deterministic group selection**
   - File: `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - Removed “first active group lock” behavior and re-evaluate best group on snapshots.
     - Strengthened member UID resolution (`uid/id/deviceId` + `ContactService.resolveCloudUid`).
     - Added stale active-group cleanup when current ID is no longer visible in group list.
     - Updated ranking tie-breakers (`missingRequired`, `overlap`, `extraParticipants`, `createdAt`, `id`) for deterministic multi-device convergence.
   - Impact:
     - Reduces split-brain family group threads and improves cross-device message continuity.

68. **Create-group -> chat route now carries concrete group context**
   - Files:
     - `src/core/screens/messages/CreateGroupScreen.tsx`
     - `src/core/types/navigation.ts`
     - `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Details:
     - `CreateGroupScreen` now navigates with `{ groupId }` after successful create.
     - Main stack type updated: `FamilyGroupChat: { groupId?: string } | undefined`.
     - FamilyGroupChat screen now accepts route params and seeds preferred active group from route.
   - Impact:
     - Eliminates post-create ambiguity where user could land in a different group than the one just created.

69. **Family location resolution unified (live/legacy/last-known)**
   - Files:
     - `src/core/utils/familyLocation.ts`
     - `src/core/components/family/FamilyMapView.tsx`
     - `src/core/components/family/MemberCard.tsx`
     - `src/core/screens/family/FamilyScreen.tsx`
     - `src/core/utils/__tests__/familyLocation.test.ts`
   - Details:
     - Added shared resolver utility for coordinate validity + fallback ordering.
     - Adopted resolver in map markers, list-card location chip, and “Konum” action routing.
     - Added test coverage for live/legacy/lastKnown and invalid-coordinate cases.
   - Impact:
     - Eliminates UI drift where one surface showed location while another showed “Konum Yok”.

70. **Group sender device identity now prefers mesh device ID**
   - Files:
     - `src/core/services/GroupChatService.ts`
     - `src/core/services/__tests__/GroupChatService.test.ts`
   - Details:
     - `fromDeviceId` population now prioritizes `getMeshDeviceId()` with safe fallback chain.
     - Added regression assertion to ensure persisted group message carries mesh sender ID.
   - Impact:
     - Improves offline mesh sender consistency and avoids UID-as-device leakage in group payload metadata.

71. **Family check-in routing hardened for UID/device alias correctness**
   - File:
     - `src/core/services/FamilyTrackingService.ts`
   - Details:
     - Check-in target resolution now includes `uid/deviceId/id` alias set with contact UID mapping.
     - Cloud and mesh targets are resolved independently; generated local `family-*` IDs are no longer used as primary route targets.
     - Added fail-fast guard when no routable identity exists.
   - Impact:
     - Prevents silent check-in delivery failures caused by non-routable local member IDs.

72. **Release pre-submit validator updated to match current V3 architecture**
   - Files:
     - `scripts/pre_submit_check.sh`
     - `scripts/validate-production.js`
     - `package.json`
   - Details:
     - Replaced brittle/legacy safeguard checks with current alias-aware messaging/family rule checks.
     - Added Firestore sender-ownership regex validation for message update path.
     - Added critical release quality gate (`test:critical`) into production validator (`typecheck + critical tests + healthcheck`).
     - Upgraded shell scans to `rg` (with safe grep fallback) for deterministic pre-submit scanning.
   - Impact:
     - Release gate now fails on real safety-critical regressions instead of stale string mismatches.

73. **QR parsing reliability test coverage added for family add flow**
   - Files:
     - `src/core/services/__tests__/IdentityService.test.ts`
     - `package.json`
     - `scripts/validate-production.js`
   - Details:
     - Added unit tests for relaxed v3 payloads (code-only), URI-encoded payloads, deep-link payload params, raw AFN/UID fallbacks, and invalid payload rejection.
     - Added native-safe Jest mocks for device/firebase dependencies so tests remain stable in CI/Jest runtime.
     - Included IdentityService QR tests in `test:critical` and production validator gate.
   - Impact:
     - Reduces recurrence risk of “Geçersiz AfetNet QR Kodu” regressions in production add-member flows.

74. **User-scenario gate rewritten to current architecture**
   - File:
     - `scripts/user-scenario-tests.mjs`
   - Details:
     - Removed stale checks for deleted Premium/SOS legacy service paths.
     - Added user-flow checks for bootstrap/auth/family/messaging/SOS/map and enforced `pre-submit` + `test:critical` command gates.
   - Impact:
     - Scenario gate now measures real production flows instead of obsolete file existence assumptions.

75. **Obsolete notification-safety test migrated to active notification stack**
   - File:
     - `src/core/services/__tests__/NotificationPermissionPromptSafety.test.ts`
   - Details:
     - Replaced removed `ComprehensiveNotificationService` file assertion with `NotificationService` initialization assertion.
   - Impact:
     - Full Jest regression suite is green again; notification startup safety coverage remains active.

## Verification

1. `npm run -s typecheck` -> pass after each code fix.
2. `npm run -s healthcheck` -> pass.
3. `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/EEWService.test.ts` -> pass (21 tests; open-handle warning remains).
4. Health baseline remains available from `reports/e2e-report.md`.
5. `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` -> pass after identity normalization changes.
6. Re-ran `npm run -s typecheck`, `npm run -s healthcheck`, and `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/EEWService.test.ts` after timestamp/location patches -> pass.
7. `npm test -- --watchman=false src/core/utils/__tests__/dateUtils.test.ts src/core/services/__tests__/MessagingReliability.test.ts` -> pass.
8. Re-ran `npm run -s typecheck` after ErrorBoundary diagnostics patch -> pass.
9. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts` -> pass.
10. Re-ran `npm run -s typecheck` after group senderUid patch -> pass.
11. Re-ran `npm run -s typecheck` after dual-path family listener patch -> pass.
12. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` -> pass.
13. Re-ran `npm run -s typecheck` and `npm run -s healthcheck` after crash diagnostics bootstrap patch -> pass.
14. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/EEWService.test.ts` -> pass (open-handle warning remains).
15. Re-ran `npm run -s typecheck` after contact `lastSeen` normalization patch -> pass.
16. Re-ran `npm run -s typecheck`, `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts`, and `npm run -s healthcheck` after DM recipient/group media patches -> pass.
17. Re-ran `npm run -s typecheck` after Buffer-based media upload decode hardening -> pass.
18. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` -> pass.
19. Re-ran `npm run -s typecheck` and `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` after navigation-route crash diagnostics patch -> pass.
20. Re-ran `npm run -s healthcheck` after latest messaging/diagnostics patches -> pass.
21. Re-ran `npm run -s typecheck` after SOS identity/ACK/listener hardening -> pass.
22. Re-ran `npm run -s healthcheck` after SOS patches -> pass.
23. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after SOS patches -> pass.
24. Re-ran `npm run -s typecheck` after SOS/DisasterMap navigation type tightening -> pass.
25. Re-ran `npm run -s healthcheck` after navigation typing patch -> pass.
26. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest SOS typing updates -> pass.
27. Re-ran `npm run -s typecheck` after Family/Messages target-resolution hardening -> pass.
28. Re-ran `npm run -s healthcheck` after Family/Messages hardening -> pass.
29. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after Family/Messages hardening -> pass.
30. Re-ran `npm run -s typecheck` after report-sync updates -> pass.
31. Re-ran `npm run -s healthcheck` after report-sync updates -> pass.
32. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after final patch set -> pass.
33. Re-ran `npm run -s typecheck` after NewMessage identity-display cleanup -> pass.
34. Re-ran `npm run -s healthcheck` after NewMessage identity-display cleanup -> pass.
35. Re-ran `npm run -s typecheck` after `messageStore` alias canonicalization patch -> pass.
36. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest message/family patches -> pass (Expo native-module warnings remain in Jest runtime).
37. Re-ran `npm run -s healthcheck` after alias-safe MessagesScreen filter update -> pass.
38. Re-ran `npm run -s typecheck` after AddFamilyMember self-add hardening -> pass.
39. Re-ran `npm run -s healthcheck` after AddFamilyMember self-add hardening -> pass.
40. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after AddFamilyMember hardening -> pass.
41. Re-ran `npm run -s typecheck` after self-identity Auth UID fallback hardening in AddFamilyMember -> pass.
42. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest AddFamilyMember guard updates -> pass.
43. Re-ran `npm run -s healthcheck` after latest AddFamilyMember guard updates -> pass.
44. Re-ran `npm run -s typecheck` after FamilyStore member-normalization migration patch -> pass.
45. Re-ran `npm run -s healthcheck` and `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after FamilyStore normalization patch -> pass.
46. Re-ran `npm run -s typecheck` after NewMessage QR cooldown-lock patch -> pass.
47. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after NewMessage QR cooldown-lock patch -> pass.
48. Re-ran `npm run -s healthcheck` after NewMessage QR cooldown-lock patch -> pass.
49. Re-ran `npm run -s typecheck` after AddFamilyMember initial `lastSeen` correction -> pass.
50. Re-ran `npm run -s healthcheck` after AddFamilyMember initial `lastSeen` correction -> pass.
51. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after AddFamilyMember initial `lastSeen` correction -> pass.
52. Re-ran `npm run -s typecheck` after family-group convergence hardening + base64 runtime migration -> pass.
53. Re-ran `npm run -s healthcheck` after family-group convergence hardening + base64 runtime migration -> pass.
54. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after family/messages lifecycle hardening -> pass.
55. Re-ran `npm run -s typecheck` after blocked-alias + scanner-reset + conversation-block hardening -> pass.
56. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest messaging/family hardening -> pass.
57. Re-ran `npm run -s healthcheck` after latest messaging/family hardening -> pass.
58. Re-ran `npm run -s typecheck` after group subscription race + parser/filter hardening -> pass.
59. Re-ran `npm run -s healthcheck` after latest group/message hardening -> pass.
60. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest patches -> pass.
61. Re-ran `npm run -s typecheck` after FamilyScreen tracking-lifecycle + alias-match hardening -> pass.
62. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` after FamilyScreen patch -> pass.
63. Re-ran `npm run -s healthcheck` after FamilyScreen patch -> pass.
64. Re-ran `npm run -s typecheck` after FamilyMapView online-state hardening -> pass.
65. Re-ran `npm run -s healthcheck` after FamilyMapView online-state hardening -> pass.
66. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after FamilyMapView patch -> pass.
67. Re-ran `npm run -s typecheck` after MessagesScreen routable-ID filter patch -> pass.
68. Re-ran `npm run -s healthcheck` after MessagesScreen routable-ID filter patch -> pass.
69. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` after MessagesScreen patch -> pass.
70. Re-ran `npm run -s typecheck` after ConversationScreen reply-metadata patch -> pass.
71. Re-ran `npm run -s healthcheck` after ConversationScreen reply-metadata patch -> pass.
72. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` after ConversationScreen reply patch -> pass.
73. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest Family/Messages hardening batch -> pass.
74. Re-ran `npm run -s typecheck` after QR parser + alias-dedup + hybrid fallback/reply fixes -> pass.
75. Re-ran `npm run -s healthcheck` after latest reliability/cleanup patch set -> pass.
76. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest reliability/cleanup patch set -> pass.
77. Re-ran `npm run -s typecheck` after audit/refactor log updates -> pass.
78. Re-ran `npm run -s healthcheck` after audit/refactor log updates -> pass.
79. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after final verification loop -> pass.
80. Re-ran `npm run -s typecheck` after family remote-loop + tracking alias/start fixes -> pass.
81. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest family hardening -> pass.
82. Re-ran `npm run -s healthcheck` after latest family hardening -> pass.
83. Re-ran `npm run -s typecheck` after group auth-race + contact UID + family freshness fixes -> pass.
84. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest hardening and new group auth tests -> pass.
85. Re-ran `npm run -s healthcheck` after latest hardening set -> pass.
86. Re-ran `npm run -s typecheck` after family-group sender alias allow-list patch -> pass.
87. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after sender-alias patch -> pass.
88. Re-ran `npm run -s healthcheck` after sender-alias patch -> pass.
89. Re-ran `npm run -s typecheck` after CreateGroup UID-resolution and FamilyGroup fallback mesh routing patch -> pass.
90. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after group fallback routing patch -> pass.
91. Re-ran `npm run -s healthcheck` after group fallback routing patch -> pass.
92. Re-ran `npm run -s typecheck` after `familyStore` last-known timestamp fallback correction -> pass.
93. Re-ran `npm test -- --watchman=false src/core/utils/__tests__/dateUtils.test.ts src/core/services/__tests__/GroupChatService.test.ts` after `familyStore` timestamp correction -> pass.
94. Re-ran `npm run -s healthcheck` after `familyStore` timestamp correction + report sync updates -> pass.
95. Re-ran `npm run -s typecheck` after non-routable conversation canonicalization patch -> pass.
96. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` after canonicalization patch -> pass.
97. Re-ran `npm run -s healthcheck` after canonicalization patch -> pass.
98. Re-ran `npm run -s typecheck` after family-group deterministic convergence + route-param patch -> pass.
99. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest family-group convergence fixes -> pass.
100. Re-ran `npm run -s healthcheck` after latest family-group convergence fixes -> pass.
101. Re-ran `npm run -s typecheck` after preferred-group route precedence patch -> pass.
102. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest family-group patch -> pass.
103. Re-ran `npm run -s healthcheck` after latest family-group patch -> pass.
104. Re-ran `npm run -s typecheck` after shared family-location resolver + group sender-id patch -> pass.
105. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts src/core/utils/__tests__/familyLocation.test.ts` after latest patches -> pass.
106. Re-ran `npm run -s healthcheck` after latest patches -> pass.
107. Re-ran `npm run -s typecheck` after family check-in target-resolution hardening -> pass.
108. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/familyLocation.test.ts src/core/utils/__tests__/dateUtils.test.ts` after check-in patch -> pass.
109. Re-ran `npm run -s healthcheck` after check-in patch -> pass.
110. Ran `npm run -s test:critical` after adding `IdentityService.test.ts` -> fail (`ExpoSecureStore` native module unavailable in Jest runtime).
111. Added Jest dependency mocks in `src/core/services/__tests__/IdentityService.test.ts` and re-ran `npm run -s test:critical` -> pass (5/5 suites, 22/22 tests).
112. Re-ran `npm run -s pre-submit` after release-gate hardening -> pass (validator errors: 0, warnings: 0).
113. Ran `node scripts/user-scenario-tests.mjs` after rewrite -> pass (7/7 scenarios, 0 failures).
114. Ran `RUN_JEST_ADVISORY=true node scripts/comprehensive-apple-user-test.mjs` after marker alignment -> pass (0 failures, 0 warnings).
115. Ran `RUN_JEST_ADVISORY=true node scripts/apple-grade-comprehensive-test.mjs` -> pass (required failures: 0; optional warning: large-file scan).
116. Ran `npm test -- --watchman=false --runInBand --silent` -> failed on stale `ComprehensiveNotificationService` test reference.
117. Patched `NotificationPermissionPromptSafety.test.ts` and re-ran full Jest -> pass (20/20 suites, 162/162 tests).
118. Ran `npm test -- --watchman=false --runInBand --detectOpenHandles --silent` -> pass (20/20 suites, 162/162 tests).
