# Phase 3 - Initial Findings (Line Review Started)

This is an active findings log. Severity order: `P0` -> `P1` -> `P2`.

## P0 Findings

1. **Conversation identity split risk (legacy ID vs UID aliases)**  
   Evidence:
   - `src/core/services/HybridMessageService.ts:426`
   - `src/core/screens/messages/ConversationScreen.tsx:414`
   - `src/core/services/ContactService.ts:708`
   Status: **Fixed** (alias-set normalization + canonical recipient UID resolution applied across send/store/render paths).

2. **Family sync may miss updates without dual path listeners**  
   Evidence:
   - `src/core/stores/familyStore.ts:96`
   - `src/core/stores/familyStore.ts:262`
   - `src/core/stores/familyStore.ts:319`
   Status: **Fixed** (for members with both `uid` and `deviceId`, listeners now subscribe to both paths for location/status updates).

3. **Error boundary active in production-like flows (TestFlight screenshots)**  
   Evidence:
   - `src/core/components/ErrorBoundary.tsx:44`
   Status: **Partially mitigated** (error fingerprint + source-component + active-route tagging added and Crashlytics bootstrap moved to app init; runtime crash reproduction and root fix still required).

4. **Cloud message facade could return success on failed V3 write (fixed now)**  
   Evidence:
   - `src/core/services/FirebaseDataService.ts:327`
   - `src/core/services/FirebaseDataService.ts:357`
   Impact: false-positive delivery success; message persistence failures could be masked.
   Status: **Fixed + typecheck pass**.

5. **Status/location cloud writes still passed legacy deviceId into UID-only paths**  
   Evidence:
   - `src/core/screens/family/FamilyScreen.tsx:528`
   - `src/core/services/LocationService.ts:117`
   - `src/core/stores/userStatusStore.ts:70`
   - `src/core/services/FirebaseDataService.ts:277`
   Impact: permission-denied/no-op writes in `users/{uid}` paths, causing stale family status/location.
   Status: **Fixed** with UID resolver fallback + call-site UID preference.

6. **User-location subscription depended on global Firestore singleton race**  
   Evidence:
   - `src/core/services/FirebaseDataService.ts:296`
   - `src/core/services/firebase/FirebaseLocationOperations.ts:152`
   Impact: member location listeners could fail to attach on cold start, leading to persistent "Konum Yok".
   Status: **Fixed** by moving facade to async subscription path.

7. **Outgoing UID messages could be misclassified as incoming (self-ID gap)**  
   Evidence:
   - `src/core/services/HybridMessageService.ts:541`
   - `src/core/stores/messageStore.ts:189`
   - `src/core/screens/messages/ConversationScreen.tsx:439`
   Impact: sender could lose own message visibility, conversation indexing could drift to self-thread, unread counters become inconsistent.
   Status: **Fixed** (UID/publicCode/deviceId self-set normalization across service/store/screen).

8. **Group chat Firestore writes did not satisfy V3 `senderUid` security rule**  
   Evidence:
   - `src/core/services/firebase/FirebaseGroupOperations.ts:251`
   - `src/core/services/GroupChatService.ts:242`
   - `firestore.rules:789` (`request.resource.data.senderUid == request.auth.uid`)
   Impact: group message create could fail with permission-denied; users see broken group chat (especially online path).
   Status: **Fixed** (`senderUid` write alias added, backward-compatible read mapping added, and regression test added).

9. **DM cloud send path could persist with unresolved recipient alias (non-UID)**  
   Evidence:
   - `src/core/services/FirebaseDataService.ts:402`
   - `src/core/services/FirebaseDataService.ts:422`
   Impact: DM conversation could be created with a non-canonical participant ID, causing recipient thread visibility failures.
   Status: **Fixed** (recipient UID resolver now maps contact/family/qrId aliases before conversation write).

10. **Nearby SOS realtime listener depended on composite-indexed query shape**  
   Evidence:
   - `src/core/services/sos/NearbySOSListener.ts:66`
   - `firestore.indexes.json` (no `sos_broadcasts(status,timestamp)` composite definition in tracked set)
   Impact: foreground nearby SOS listener could fail to attach with index error, causing missed critical proximity SOS alerts.
   Status: **Fixed** (listener query now index-light on `timestamp`, with `status === active` filtered in callback).

11. **SOS responder routing could drift across UID/device aliases (message + ACK path mismatch)**  
   Evidence:
   - `src/core/services/sos/SOSChannelRouter.ts:325`
   - `src/core/screens/map/DisasterMapScreen.tsx:1572`
   - `src/core/screens/messages/SOSConversationScreen.tsx:134`
   Impact: responder could message/ACK a non-canonical target ID, causing failed cloud delivery or sender not seeing ACK in mixed-identity accounts.
   Status: **Fixed** (`senderUid` propagated in SOS payload, SOS conversation target uses alias set + UID-first resolution, ACK writes now dual-path for sender device/UID aliases, ACK listener listens multi-target aliases).

12. **Family local record ID (`family-*`) could be used as DM target**  
   Evidence:
   - `src/core/screens/family/FamilyScreen.tsx:1373`
   - `src/core/screens/messages/NewMessageScreen.tsx:596`
   - `src/core/screens/messages/ConversationScreen.tsx:399`
   Impact: conversation could open on non-routable local member ID, then message sends fail/split across wrong threads.
   Status: **Fixed** (UID/deviceId-first target selection + generated-local-ID guard + invalid-target fail-fast alerts).

13. **Family group cloud-channel convergence could create self-only duplicate groups**
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:295`
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:346`
   Impact: while group list snapshot was still loading, users could create divergent self-only groups and lose shared cloud thread continuity.
   Status: **Fixed** (snapshot-gated group creation + best-group selection + create dedupe + peer-UID precondition + missing-participant reconciliation).

14. **Media/voice base64 decode path used `atob` in RN runtime-critical services**
   Evidence:
   - `src/core/services/HybridMessageService.ts:800`
   - `src/core/services/VoiceMessageService.ts:383`
   - `src/core/services/mesh/GroupKeyService.ts:672`
   - `src/core/services/mesh/MeshCompressionService.ts:196`
   Impact: on Hermes/TestFlight builds, missing `atob/btoa` globals can break media upload/backup/encryption flows and trigger runtime failures.
   Status: **Fixed** (`Buffer`-based base64 encode/decode migration in messaging and group-mesh critical paths).

## P1 Findings

1. **Quick family message argument order defect (fixed now)**  
   Evidence:
   - Before fix call site was malformed in `handleQuickMessage`.
   - Fixed call shape at `src/core/screens/family/FamilyScreen.tsx:793`.
   Impact: message text/recipient inversion could silently fail deliveries.
   Status: **Fixed + typecheck pass**.

2. **Map member "Mesaj" action used non-canonical member ID (fixed now)**  
   Evidence:
   - Fixed to UID-first in `src/core/screens/map/DisasterMapScreen.tsx:1348`.
   Impact: wrong conversation target, especially in mixed UID/device migration.
   Status: **Fixed + typecheck pass**.

3. **Navigation typing does not represent actual route surface**  
   Evidence:
   - Minimal stack types in `src/core/types/navigation.ts:14`.
   - Actual route list in `src/core/navigation/MainNavigator.tsx:92`.
   Impact: compile-time route safety is weak; runtime navigation errors can slip through.
   Status: **Partially mitigated** (central type map updated; screen-level `ParamListBase` cleanup still pending).

4. **Offline sync queue retry scheduling gap (fixed now)**  
   Evidence:
   - `src/core/services/OfflineSyncService.ts:113`
   - `src/core/services/OfflineSyncService.ts:166`
   Impact: transient online errors could leave queue items pending without timed retry.
   Status: **Fixed + typecheck pass**.

5. **Communication screen treated send API result as boolean (fixed now)**  
   Evidence:
   - `src/core/screens/mesh/MeshNetworkScreen.tsx:65`
   Impact: incorrect success handling path for send action.
   Status: **Fixed + typecheck pass**.

6. **Family tab QR output incompatible with QR parser on add-member screen**  
   Evidence:
   - `src/core/screens/family/FamilyScreen.tsx:1405`
   - `src/core/screens/family/AddFamilyMemberScreen.tsx:80`
   Impact: "Geçersiz AfetNet QR Kodu" despite app-generated QR scan.
   Status: **Fixed** (QR payload share + parser fallback for encoded/plain IDs).

7. **Family member timestamps/fields not normalized when loading from Firestore**  
   Evidence:
   - `src/core/services/firebase/FirebaseFamilyOperations.ts:304`
   - `src/core/services/firebase/FirebaseFamilyOperations.ts:416`
   Impact: stale/incorrect time badges, missing location/status metadata on reload.
   Status: **Fixed** (seconds/ms/Timestamp normalization + complete field mapping).

8. **Family group mesh messages could be dropped by recipient filter**  
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:120`
   - `src/core/services/GroupChatService.ts:294`
   Impact: group-addressed mesh packets (`group:<id>`) treated as invalid direct messages, causing offline group chat loss.
   Status: **Fixed** (group recipient rule + payload parser compatibility + send fallback hardening).

9. **Family/map time freshness labels could drift due to raw timestamp-unit assumptions**  
   Evidence:
   - `src/core/components/map/FamilyMarker.tsx:36`
   - `src/core/components/family/MemberCard.tsx:92`
   - `src/core/screens/family/FamilyScreen.tsx:660`
   Impact: mixed seconds/ms/ISO writes could surface incorrect staleness and "çok eski" labels (including extreme day counts).
   Status: **Fixed** (shared timestamp normalization + numeric `lastSeen` writes + online/stale checks aligned to normalized ms).

10. **Family location availability checks were too strict in some paths**  
   Evidence:
   - `src/core/screens/family/FamilyScreen.tsx:1392`
   - `src/core/components/family/FamilyMapView.tsx:35`
   Impact: members with fallback `latitude/longitude` could be treated as "Konum Yok".
   Status: **Fixed** (resolved location fallback and finite-coordinate validation in both list and map flows).

11. **Family group media flow lacked durable cloud-thread persistence in common path**  
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:493`
   Impact: image/voice/location payloads could appear only via ephemeral mesh path and disappear after reload or across online devices.
   Status: **Fixed** (group-first media send + Storage upload + mesh fallback).

12. **New-message flow could create duplicate conversations for one real user (alias mismatch)**  
   Evidence:
   - `src/core/screens/messages/NewMessageScreen.tsx:522`
   - `src/core/services/ContactService.ts:708`
   Impact: one person appears as separate `uid`/`deviceId` threads, causing unread/read drift and operator confusion.
   Status: **Fixed** (alias-set existing-conversation resolver + canonical target normalization).

13. **Message store conversation operations were alias-fragile (pin/mute/read/search/delete drift risk)**  
   Evidence:
   - `src/core/stores/messageStore.ts:527`
   - `src/core/stores/messageStore.ts:569`
   - `src/core/stores/messageStore.ts:715`
   - `src/core/stores/messageStore.ts:825`
   - `src/core/stores/messageStore.ts:1008`
   Impact: same real person could still diverge across UID/device/public-code aliases in metadata operations and in-conversation search.
   Status: **Fixed** (alias-aware identity match helper + canonical conversation dedup + alias-safe read/delete/pin/mute/search paths).

14. **Add-family flow allowed self identity to be added as a member**
   Evidence:
   - `src/core/screens/family/AddFamilyMemberScreen.tsx:75`
   - `src/core/screens/family/AddFamilyMemberScreen.tsx:241`
   Impact: user could add own identity, creating misleading family state and breaking critical actions (message/locate/safety semantics).
   Status: **Fixed** (self-identity guard for QR/manual add + UID/device field separation hardening).

15. **Legacy/corrupt family member records could survive into runtime without normalization**
   Evidence:
   - `src/core/stores/familyStore.ts:230`
   - `src/core/stores/familyStore.ts:430`
   Impact: stale epoch-like timestamps and malformed IDs could leak into UI state and produce misleading safety indicators.
   Status: **Fixed** (startup/realtime member normalization with timestamp sanity bounds and field guards).

16. **QR scanner in new-message flow lacked duplicate-read guard**
   Evidence:
   - `src/core/screens/messages/NewMessageScreen.tsx:408`
   - `src/core/screens/messages/NewMessageScreen.tsx:901`
   Impact: same QR frame could trigger repeated add/navigate attempts and inconsistent UX/state.
   Status: **Fixed** (scan cooldown lock + scanner callback guard + cooldown cleanup).

17. **Newly added family members were seeded with synthetic fresh `lastSeen`**
   Evidence:
   - `src/core/screens/family/AddFamilyMemberScreen.tsx:273`
   Impact: contact could appear active before any real status/location signal, misleading triage decisions.
   Status: **Fixed** (`lastSeen` starts as unknown until first real update).

18. **Family group screen could leak recording interval/recording session on unmount**
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:464`
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:771`
   Impact: leaving screen during active record could retain timers/session and destabilize subsequent voice operations.
   Status: **Fixed** (unmount cleanup now clears interval + best-effort recording cancel; double-start guarded).

19. **Blocked-user filter in message ingestion was exact-ID only (alias bypass)**
   Evidence:
   - `src/core/stores/messageStore.ts:488`
   Impact: blocked user could still appear in message list when sending from alternate alias (UID/device/public code mismatch).
   Status: **Fixed** (blocked check now uses alias-set matching in `addMessage` path).

20. **Add-family QR scanner could stay latched after duplicate/invalid flow**
   Evidence:
   - `src/core/screens/family/AddFamilyMemberScreen.tsx:150`
   - `src/core/screens/family/AddFamilyMemberScreen.tsx:540`
   Impact: scanner could remain disabled (`scanned=true`) after duplicate detection or method switch, forcing manual reset and breaking operator flow.
   Status: **Fixed** (scanner reset scheduler + timeout cleanup + QR tab re-entry unlock).

21. **Group message realtime subscriptions had async unsubscribe race (listener leak risk)**
   Evidence:
   - `src/core/services/firebase/FirebaseGroupOperations.ts:334`
   - `src/core/services/firebase/FirebaseGroupOperations.ts:416`
   Impact: rapid mount/unmount could leave stale listeners alive, causing duplicate callbacks, memory growth, and inconsistent message state.
   Status: **Fixed** (disposed-guarded async setup + late-unsubscribe cancellation).

22. **Group mesh payload omitted media/location metadata for offline peers**
   Evidence:
   - `src/core/services/GroupChatService.ts:292`
   Impact: image/voice/location messages sent to group could degrade to plain text on mesh-only receivers during outage conditions.
   Status: **Fixed** (mesh payload now carries media/location/thread metadata).

23. **Family group payload parser discarded embedded media fields**
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:258`
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:503`
   Impact: even when payload contained media/location, UI merge path dropped those fields and rendered incomplete content.
   Status: **Fixed** (parser + merge now normalize and apply payload media/location fields).

24. **Direct conversation render path did not enforce blocked-user filtering for merged sources**
   Evidence:
   - `src/core/screens/messages/ConversationScreen.tsx:455`
   - `src/core/screens/messages/ConversationScreen.tsx:470`
   Impact: blocked identity traffic from alternate ingest path could still appear in thread render despite store-level block rules.
   Status: **Fixed** (alias-aware blocked filtering applied in both store-message and mesh-message merge filters).

25. **Family location tracking used inconsistent consumer IDs across toggle paths**
   Evidence:
   - `src/core/screens/family/FamilyScreen.tsx:432`
   - `src/core/screens/family/FamilyScreen.tsx:762`
   Impact: tracking could remain active after screen transitions or produce duplicate start/stop behavior, risking battery drain and unstable location-share state.
   Status: **Fixed** (single `FAMILY_TRACKING_CONSUMER_ID` path + toggle handler no longer starts/stops tracking independently from effect lifecycle).

26. **Family map online pulse logic could show stale members as online**
   Evidence:
   - `src/core/components/family/FamilyMapView.tsx:158`
   Impact: members with old/invalid `lastSeen` could still be rendered as active if status wasn’t `unknown`, misleading emergency triage.
   Status: **Fixed** (online indicator now uses normalized recent `lastSeen` threshold with optional explicit `isOnline` override).

27. **Messages list could surface non-routable legacy conversation IDs**
   Evidence:
   - `src/core/screens/messages/MessagesScreen.tsx:53`
   - `src/core/screens/messages/MessagesScreen.tsx:161`
   Impact: stale `family-*` style local IDs could remain visible and route users into broken/empty conversation paths.
   Status: **Fixed** (conversation list/search pipeline now filters to routable IDs before render/search operations).

28. **Direct conversation reply action did not propagate reply metadata on send**
   Evidence:
   - `src/core/screens/messages/ConversationScreen.tsx:749`
   - `src/core/screens/messages/ConversationScreen.tsx:832`
   Impact: users could enter reply mode in UI, but outbound message lacked `replyTo/replyPreview`, breaking thread context in delivery and persistence paths.
   Status: **Fixed** (reply metadata now included in send options; reply banner clears on successful send).

29. **QR parser rejected valid v3 payloads when `uid` was absent**
   Evidence:
   - `src/core/services/IdentityService.ts:390`
   - `src/core/screens/family/AddFamilyMemberScreen.tsx:139`
   - `src/core/screens/messages/NewMessageScreen.tsx:434`
   Impact: app-generated or deep-link wrapped QR values could be flagged as invalid in TestFlight despite containing a valid share code.
   Status: **Fixed** (parser now accepts v3 with code-only fallback, supports URL/query payload extraction, and keeps UID/device/plain-code fallbacks).

30. **Family realtime merge could duplicate same person under alias variants**
   Evidence:
   - `src/core/stores/familyStore.ts:537`
   - `src/core/stores/familyStore.ts:606`
   Impact: same user could exist twice (UID/device/public code variants), causing unstable family cards, action routing drift, and potential key collisions.
   Status: **Fixed** (alias-based merge/dedup helper added; add-member duplicate check now intersects all identity aliases).

31. **Hybrid send path dropped reply metadata and used wrong legacy cloud fallback target**
   Evidence:
   - `src/core/services/HybridMessageService.ts:1044`
   - `src/core/services/HybridMessageService.ts:1103`
   - `src/core/services/FirebaseDataService.ts:443`
   Impact: reply context could be lost across channels, and unresolved-recipient fallback could incorrectly persist to sender path, reducing DM delivery reliability.
   Status: **Fixed** (mesh/cloud payloads now include `replyTo/replyPreview`; legacy fallback target now prefers recipient identity).

32. **Remote family status/location updates could write back to cloud and loop**
   Evidence:
   - `src/core/screens/family/FamilyScreen.tsx:129`
   - `src/core/stores/familyStore.ts:144`
   - `src/core/stores/familyStore.ts:470`
   - `src/core/stores/familyStore.ts:1047`
   Impact: incoming remote updates could be re-written as local updates, increasing listener churn and causing noisy/resiliency-degrading write storms.
   Status: **Fixed** (`updateMemberStatus` now supports `source` and remote callsites use `'remote'`; pending family updates now call remote-safe status/location updates).

33. **Family tracking sync could drop alias-based member updates and disable offline start**
   Evidence:
   - `src/core/services/FamilyTrackingService.ts:188`
   - `src/core/services/FamilyTrackingService.ts:413`
   - `src/core/services/FamilyTrackingService.ts:447`
   Impact: updates coming as UID/device alias could miss target member in store sync, and tracking could abort when UID is temporarily unavailable even though mesh/device identity exists.
   Status: **Fixed** (tracking start now allows UID fallback to device/public identity; sync now writes via resolved `member.id` and marks source as remote).

34. **Group chat startup could lock into a non-subscribed state during auth race**
   Evidence:
   - `src/core/services/GroupChatService.ts:52`
   - `src/core/services/firebase/FirebaseGroupOperations.ts:428`
   Impact: if `initialize()` ran before auth became ready, `groupListSubscription` could be set while no actual Firestore listener was attached, preventing later retries and making family group chat appear broken.
   Status: **Fixed** (`GroupChatService.initialize()` now short-circuits when auth user is unavailable and retries safely on subsequent calls).

35. **Direct `getAuth()` access in family group screen could trigger runtime crash when app/auth not ready**
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:140`
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:487`
   Impact: unguarded auth access in render/effects could throw and bubble to `ErrorBoundary`, matching TestFlight critical error patterns.
   Status: **Fixed** (safe auth accessor added and used for participant/model + read-tracking paths).

36. **Contact QR import accepted non-UID values as `cloudUid` and polluted routing**
   Evidence:
   - `src/core/services/ContactService.ts:484`
   - `src/core/services/ContactService.ts:722`
   Impact: AFN/public-code values could be treated as Firebase UIDs, causing invalid cloud target resolution and degraded message/contact-request reliability.
   Status: **Fixed** (UID validation added for QR import + `resolveCloudUid`; contact requests now sent only when a valid UID exists).

37. **Family tracking normalized `lastSeen` with `Date.now()` fallback, creating false-online members**
   Evidence:
   - `src/core/services/FamilyTrackingService.ts:126`
   Impact: newly added or stale members could appear recently active without telemetry, undermining trust in family status/location freshness.
   Status: **Fixed** (timestamp normalization now preserves unknown freshness as `0` and avoids synthetic “just now” values).

38. **Family group mesh sender filter could drop legitimate messages in mixed alias states**
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:113`
   Impact: when a member was stored by public/device alias but sent with UID identity, strict sender-ID matching could reject real group messages.
   Status: **Fixed** (allowed-sender set now expands aliases with contact UID resolution).

39. **Create-group flow used legacy/local member IDs instead of canonical UIDs**
   Evidence:
   - `src/core/screens/messages/CreateGroupScreen.tsx:43`
   - `src/core/services/GroupChatService.ts:100`
   Impact: groups were created with non-UID participants (e.g., `family-*` / device aliases), causing cloud membership mismatch and broken realtime group delivery.
   Status: **Fixed** (group member selection now resolves canonical UID per member, blocks unresolved entries, and uses UID-keyed participant maps).

40. **Family-group fallback path polluted direct-message conversation index with `broadcast` threads**
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:680`
   - `src/core/services/HybridMessageService.ts:598`
   Impact: when no cloud group was available, group messages were sent through direct-message hybrid broadcast, producing non-routable/ghost direct conversations and inconsistent UX.
   Status: **Fixed** (fallback switched to direct mesh group broadcast in family chat screen with local optimistic message append; no DM `broadcast` pollution).

41. **Family member `lastKnownLocation.timestamp` normalization could fabricate fresh timestamps**
   Evidence:
   - `src/core/stores/familyStore.ts:314`
   Impact: invalid/missing `lastKnownLocation.timestamp` was replaced with `Date.now()`, making stale records appear fresh and weakening trust in map recency data.
   Status: **Fixed** (fallback timestamp now derives from normalized member timestamps, defaulting to `0` instead of synthetic “now”).

42. **Broadcast/group pseudo-targets could leak into DM conversation index**
   Evidence:
   - `src/core/stores/messageStore.ts:206`
   - `src/core/screens/messages/MessagesScreen.tsx:37`
   Impact: non-routable targets such as `broadcast` / `group:*` could be treated as regular DM peers, creating ghost threads and unstable navigation paths.
   Status: **Fixed** (`messageStore` now canonicalizes these IDs as non-routable; messages list also filters them at render level).

43. **Family group selection could lock to stale/non-canonical group ID across devices**
   Evidence:
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:50`
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:188`
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:337`
   Impact: once a client latched to an initial group ID, it did not re-evaluate better/shared candidates; this could create split-brain family group threads between devices.
   Status: **Fixed** (UID-resolution strengthened in participant model, group ranking made deterministic, stale active-group cleanup added, and convergence now re-evaluates on snapshots).

44. **Create-group flow did not pass created `groupId` into chat route**
   Evidence:
   - `src/core/screens/messages/CreateGroupScreen.tsx:174`
   - `src/core/types/navigation.ts:30`
   - `src/core/screens/family/FamilyGroupChatScreen.tsx:79`
   Impact: after successful group creation, UI could open a different active group than the newly created one, causing operator confusion and delivery ambiguity.
   Status: **Fixed** (navigation now passes `{ groupId }`, stack param type updated, and family group screen accepts preferred route group ID).

45. **Family location fallback logic was duplicated and inconsistent across map/list/actions**
   Evidence:
   - `src/core/components/family/FamilyMapView.tsx:47`
   - `src/core/components/family/MemberCard.tsx:81`
   - `src/core/screens/family/FamilyScreen.tsx:1416`
   Impact: `lastKnownLocation` data could exist but still surface as "Konum Yok" depending on the UI entry point, reducing operator trust during emergency flows.
   Status: **Fixed** (shared resolver utility introduced and adopted across map markers, member cards, and locate action path).

46. **Family check-in request could target non-routable generated member IDs**
   Evidence:
   - `src/core/services/FamilyTrackingService.ts:623`
   Impact: when a member had only local `family-*` record ID and no canonical routing identity, check-in requests could be sent to invalid targets and silently fail.
   Status: **Fixed** (UID/device alias resolution hardened; cloud and mesh targets now selected separately with routability guard).

47. **Release validator drifted from current V3 implementation details**
   Evidence:
   - `scripts/validate-production.js:217`
   - `src/core/services/HybridMessageService.ts:426`
   - `src/core/services/FamilyTrackingService.ts:623`
   Impact: pre-submit gate produced false failures from stale string checks, masking true release readiness and slowing emergency fix cycles.
   Status: **Fixed** (validator checks rewritten to architecture-accurate patterns + critical-test gate integration).

48. **Notification startup safety test referenced deleted service file**
   Evidence:
   - `src/core/services/__tests__/NotificationPermissionPromptSafety.test.ts:19`
   - deleted file path expected: `src/core/services/ComprehensiveNotificationService.ts`
   Impact: full regression suite produced false red status, hiding real regressions behind obsolete test wiring.
   Status: **Fixed** (test migrated to current `NotificationService` initialization contract).

## P2 Findings

1. Widespread `ParamListBase` usage in screen props weakens type safety.
2. Broad `any` usage and lint suppression in infra-heavy services.
3. Some TODO-level cryptography/security notes remain unresolved.

## Verification Log (Current Turn)

1. `npm run -s typecheck` -> pass after fixes.
2. `npm run -s healthcheck` -> pass (with external/env warnings in `reports/e2e-report.md`).
3. `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/EEWService.test.ts` -> pass (21 tests; open-handle warning remains).
4. `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` -> pass after messaging identity fixes.
5. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` -> pass.
6. `npm run -s typecheck` -> pass after SOS identity/listener hardening.
7. `npm run -s healthcheck` -> pass after SOS patches (`reports/e2e-report.md` refreshed).
8. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` -> pass after SOS patches.
9. `npm run -s typecheck` -> pass after SOS/DisasterMap route typing hardening.
10. `npm run -s healthcheck` -> pass after latest typing patches.
11. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` -> pass after latest SOS typing updates.
12. `npm run -s typecheck` -> pass after Family/Messages identity-routing fixes.
13. `npm run -s healthcheck` -> pass after Family/Messages fixes.
14. `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` -> pass after Family/Messages fixes.
15. Re-ran `npm run -s typecheck` after audit report updates -> pass.
16. Re-ran `npm run -s healthcheck` after audit report updates -> pass.
17. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` -> pass after final patch set.
18. Re-ran `npm run -s typecheck` after NewMessage identity-display cleanup -> pass.
19. Re-ran `npm run -s healthcheck` after NewMessage identity-display cleanup -> pass.
20. Re-ran `npm run -s typecheck` after `messageStore` alias canonicalization patch -> pass.
21. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest message/family patches -> pass.
22. Re-ran `npm run -s healthcheck` after alias-safe MessagesScreen filter update -> pass.
23. Re-ran `npm run -s typecheck` after AddFamilyMember self-add hardening -> pass.
24. Re-ran `npm run -s healthcheck` after AddFamilyMember self-add hardening -> pass.
25. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after AddFamilyMember hardening -> pass.
26. Re-ran `npm run -s typecheck` after self-identity Auth UID fallback hardening in AddFamilyMember -> pass.
27. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest AddFamilyMember guard updates -> pass.
28. Re-ran `npm run -s healthcheck` after latest AddFamilyMember guard updates -> pass.
29. Re-ran `npm run -s typecheck` after FamilyStore member-normalization migration patch -> pass.
30. Re-ran `npm run -s healthcheck` after FamilyStore normalization patch -> pass.
31. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after FamilyStore normalization patch -> pass.
32. Re-ran `npm run -s typecheck` after NewMessage QR cooldown-lock patch -> pass.
33. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after NewMessage QR cooldown-lock patch -> pass.
34. Re-ran `npm run -s healthcheck` after NewMessage QR cooldown-lock patch -> pass.
35. Re-ran `npm run -s typecheck` after AddFamilyMember initial `lastSeen` correction -> pass.
36. Re-ran `npm run -s healthcheck` after AddFamilyMember initial `lastSeen` correction -> pass.
37. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after AddFamilyMember initial `lastSeen` correction -> pass.
38. Re-ran `npm run -s typecheck` after family-group convergence + base64 runtime hardening patches -> pass.
39. Re-ran `npm run -s healthcheck` after family-group convergence + base64 runtime hardening patches -> pass.
40. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest family/messages lifecycle hardening -> pass.
41. Re-ran `npm run -s typecheck` after FamilyScreen tracking consumer/lifecycle unification -> pass.
42. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after FamilyScreen lifecycle patch -> pass.
43. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` after SOS/family alias fallback hardening -> pass.
44. Re-ran `npm run -s healthcheck` after FamilyScreen lifecycle patch -> pass.
45. Re-ran `npm run -s typecheck` after FamilyMapView online-signal hardening -> pass.
46. Re-ran `npm run -s healthcheck` after FamilyMapView online-signal hardening -> pass.
47. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after FamilyMapView patch -> pass.
48. Re-ran `npm run -s typecheck` after MessagesScreen routable-conversation filter patch -> pass.
49. Re-ran `npm run -s healthcheck` after MessagesScreen routable-conversation filter patch -> pass.
50. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` after MessagesScreen patch -> pass.
51. Re-ran `npm run -s typecheck` after ConversationScreen reply-metadata send patch -> pass.
52. Re-ran `npm run -s healthcheck` after ConversationScreen reply-metadata patch -> pass.
53. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts` after ConversationScreen reply patch -> pass.
54. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest Family/Messages hardening batch -> pass.
55. Re-ran `npm run -s typecheck` after QR parser + alias-merge + hybrid-reply/fallback fixes -> pass.
56. Re-ran `npm run -s healthcheck` after latest reliability/cleanup patch set -> pass.
57. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest reliability/cleanup patch set -> pass.
58. Re-ran `npm run -s typecheck` after audit/refactor log updates -> pass.
59. Re-ran `npm run -s healthcheck` after audit/refactor log updates -> pass.
60. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after final verification loop -> pass.
61. Re-ran `npm run -s typecheck` after family remote-loop + tracking alias/start hardening -> pass.
62. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest family hardening -> pass.
63. Re-ran `npm run -s healthcheck` after latest family hardening -> pass.
64. Re-ran `npm run -s typecheck` after family-group deterministic convergence + route-param patch -> pass.
65. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest family-group convergence fixes -> pass.
66. Re-ran `npm run -s healthcheck` after latest family-group convergence fixes -> pass.
67. Re-ran `npm run -s typecheck` after preferred-group route precedence patch -> pass.
68. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts` after latest family-group patch -> pass.
69. Re-ran `npm run -s healthcheck` after latest family-group patch -> pass.
70. Re-ran `npm run -s typecheck` after shared family-location resolver + group sender device-id patch -> pass.
71. Re-ran `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/GroupChatService.test.ts src/core/utils/__tests__/dateUtils.test.ts src/core/utils/__tests__/familyLocation.test.ts` after latest family/message hardening -> pass.
72. Re-ran `npm run -s healthcheck` after shared family-location resolver patch -> pass.
73. Re-ran `npm run -s typecheck` after family check-in target-resolution hardening -> pass.
74. Re-ran `npm test -- --watchman=false src/core/services/__tests__/GroupChatService.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/utils/__tests__/familyLocation.test.ts src/core/utils/__tests__/dateUtils.test.ts` after check-in patch -> pass.
75. Ran `npm run -s test:critical` after adding IdentityService QR tests -> fail (`ExpoSecureStore` native module unavailable in Jest runtime).
76. Added native-safe Jest mocks in `src/core/services/__tests__/IdentityService.test.ts` and re-ran `npm run -s test:critical` -> pass (5 suites, 22 tests).
77. Re-ran `npm run -s pre-submit` after validator hardening + critical-test integration -> pass (Errors: 0, Warnings: 0).
78. Ran `node scripts/user-scenario-tests.mjs` after architecture-aligned rewrite -> pass (7/7 scenarios).
79. Ran `RUN_JEST_ADVISORY=true node scripts/comprehensive-apple-user-test.mjs` after marker updates -> pass (Failures: 0, Warnings: 0).
80. Ran `npm test -- --watchman=false --runInBand --silent` -> initially failed due stale notification safety test reference.
81. Updated `NotificationPermissionPromptSafety.test.ts` to assert `NotificationService` initialization safety and re-ran full Jest -> pass (20/20 suites, 162/162 tests).
82. Ran `npm test -- --watchman=false --runInBand --detectOpenHandles --silent` -> pass (20/20 suites, 162/162 tests).

## Next Review Slice (Immediate)

1. TestFlight runtime crash root-cause extraction from enriched ErrorBoundary IDs (`err_<ts>_<fingerprint>` + route/source).
2. Full P0 E2E rerun with SOS trigger/ack/cancel under online/offline transitions.
3. Remaining screen-level `ParamListBase` cleanup for stricter compile-time route safety.
4. Family group chat and direct DM transition audit on mixed UID/device users (2 real devices).
