# Phase 1 - System Map (Initial)

## Navigation Topology

### Root Tab Routes

Reference: `src/core/navigation/MainTabs.tsx:36`

- `Home`
- `Map`
- `Family`
- `Messages`
- `Settings`

### Main Stack Routes

Reference: `src/core/navigation/MainNavigator.tsx:89`

- Main: `MainTabs`
- Earthquake: `RiskScore`, `AllEarthquakes`, `EarthquakeDetail`
- Map: `DisasterMap`
- Family: `AddFamilyMember`, `FamilyGroupChat`
- Messaging: `NewMessage`, `Conversation`, `SOSConversation`, `CreateGroup`, `SOSHistory`
- AI: `PreparednessPlan`, `PanicAssistant`, `LocalAIAssistant`
- Waves: `WaveVisualization`
- Settings/Policy: `EarthquakeSettings`, `NotificationSettings`, `OfflineMapSettings`, `AdvancedSettings`, `About`, `PrivacyPolicy`, `TermsOfService`, `Security`, `EEWSettings`
- Other modules: `DrillMode`, `UserReports`, `VolunteerModule`, `HealthProfile`, `MedicalInformation`, `DisasterPreparedness`, `AssemblyPoints`, `AddAssemblyPoint`, `FlashlightWhistle`, `PsychologicalSupport`, `MeshNetwork`, `MyQR`, `RescueTeam`

### Auth & Onboarding

- Auth stack: `Login`, `EmailRegister`, `ForgotPassword`, `PrivacyPolicy`, `TermsOfService`  
  Reference: `src/core/navigation/AuthNavigator.tsx:29`
- Onboarding stack: `SevenSlideTour`  
  Reference: `src/core/navigation/OnboardingNavigator.tsx:16`

## Data Plane (Operational)

UI Screen -> Zustand Store -> Service Layer -> Dual transport:

1. Cloud (Firebase conversation/inbox, family/status/location documents)
2. Mesh (BLE message transport + relay)

## Identity Plane (Critical)

Application currently uses three identifiers across modules:

1. Firebase UID (canonical cloud identity)
2. App/public code (AFN-like format / public user code)
3. Device/mesh ID

The reliability strategy must enforce canonical resolution with deterministic fallback:

- First: UID
- Then: mapped contact UID via alias
- Then: legacy device/public ID fallback

## Critical Feature Entry Points

1. Family add flow: `src/core/screens/family/AddFamilyMemberScreen.tsx`
2. Family state sync: `src/core/stores/familyStore.ts`
3. Direct/Hybrid messaging: `src/core/services/HybridMessageService.ts`
4. Contact identity mapping: `src/core/services/ContactService.ts`
5. Conversation rendering: `src/core/screens/messages/ConversationScreen.tsx`
6. Group messaging: `src/core/screens/family/FamilyGroupChatScreen.tsx`
7. SOS orchestration: `src/core/services/sos/UnifiedSOSController.ts`
8. Cloud facade: `src/core/services/FirebaseDataService.ts`

## Structural Gaps Identified in Phase 1

1. Navigation typing drift:
   - `src/core/types/navigation.ts:14` only declares `MainTabs`, `Wave`, `Risk`.
   - Actual stack has many more routes (`src/core/navigation/MainNavigator.tsx:92` onward).
2. Type safety bypass in many screens:
   - widespread `ParamListBase` usage in navigation props.
3. Runtime route coercion present:
   - `as never` usage in family SOS navigation (`src/core/screens/family/FamilyScreen.tsx:285`).

These gaps reduce compile-time protection and increase runtime crash risk.
