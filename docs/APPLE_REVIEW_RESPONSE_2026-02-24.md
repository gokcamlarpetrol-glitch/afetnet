Hello App Review Team,

Thank you for the detailed feedback.

This response addresses the review dated February 24, 2026 for version 1.3.12.
All requested changes are implemented in the current resubmission build (version 1.3.13, iOS build 27).

Guideline 5.1.1
- Removed skip/exit behavior from permission onboarding flow before system permission prompts ("Atla" is removed).
- Permission slides are now non-skippable by swipe.
- Location permission is requested directly via the iOS system dialog from the location onboarding action.

Guideline 5.1.5
- Added explicit EULA clauses for:
  - no direct integration with 112/official emergency dispatch systems,
  - location accuracy and transmission limitations,
  - user responsibility in emergencies,
  - service scope and limitation of liability.
- Updated iOS permission purpose strings to remove any wording that could imply direct official emergency dispatch integration.
- The app now clearly states that SOS/location data is shared with user-selected contacts/groups inside the app, and users must call 112 for official emergency response.

Offline SOS reliability hardening (current build)
- Mesh SOS sender identity is now installation-scoped (not account UID only).
- Receiver-side self-message filtering now checks full local identity aliases (UID/public code/device/installation), preventing false self-drop on nearby multi-device scenarios.
- Rescue ACK mesh backup path uses the same installation-scoped sender identity.
- BLE mesh advertisement payload is now refreshed per outgoing packet (instead of being blocked by prior advertising state), so nearby offline recipients can receive current SOS/message packets reliably.

Evidence of location identification/receiving capability in app scope
- SOS payload includes sender identity + timestamp + coordinates (lat/lng) and is delivered to selected contacts/groups through:
  - Cloud channel (Firestore conversation message records),
  - Offline mesh channel (BLE store-and-forward packets).
- Recipient clients resolve sender identity and render incoming SOS/location messages with the attached coordinates on map/message UI.
- Internal reliability tests for messaging and mesh protocol compatibility pass in this build.
- Direct messaging reliability hardening in this build:
  - outgoing DM/SOS sends now include recipient alias set (UID + share code/device alias) for robust online/offline target matching,
  - cloud-to-local recipient restore and conversation isolation checks were re-validated with release test scripts.

How App Review can verify SOS flow directly
1. Install the submitted build on two physical iOS devices placed nearby (Bluetooth ON on both devices).
2. Sign in on both devices and keep both apps in foreground.
3. Disable internet on both devices (Airplane Mode + re-enable Bluetooth).
4. On Device A, trigger SOS from Home.
5. Expected on Device B: incoming SOS alert appears with sender and location context; SOS marker appears on map.
6. On Device B, tap the rescue/ack action.
7. Expected on Device A: rescue ACK is shown.

If needed, we can provide:
- short screen recording of permission flow (no skip/exit before prompt),
- sanitized Firestore message sample showing sender + coordinate fields,
- device-to-device offline mesh SOS/location test recording.

Best regards,
AfetNet Team
