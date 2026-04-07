/**
 * AFETNET FIREBASE FUNCTIONS - EEW (Early Earthquake Warning) MODULE
 *
 * Functions:
 * - eewMonitorFast: Fast polling monitor (every 1 minute)
 * - eewMonitorBackup: Backup redundancy monitor
 * - eewEmergencyTrigger: Admin HTTP emergency trigger
 * - onPWaveDetection: Real-time P-wave consensus trigger
 * - broadcastEEW: Admin-only manual EEW broadcast
 * - eewWebhook: HTTP webhook for external triggers
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

import {
    db,
    messaging,
    REGION,
    EEWEvent,
    PWaveConsensus,
    ExpoPushMessage,
    AFAD_API,
    KANDILLI_API,
    USGS_API,
    EMSC_API,
    MIN_MAGNITUDE_ALERT,
    MIN_MAGNITUDE_CRITICAL,
    CONSENSUS_THRESHOLD,
    CONSENSUS_CONFIDENCE,
    NEARBY_RADIUS_CRITICAL,
    NEARBY_RADIUS_NORMAL,
    MAX_FCM_RETRIES,
    RETRY_DELAY_BASE_MS,
    TURKEY_BOUNDS,
    sendExpoPush,
    isExpoPushToken,
    cleanupInvalidTokens,
    calculateDistance,
} from './utils';

// ============================================================
// HELPER FUNCTIONS - DATA FETCHING
// ============================================================

async function fetchAFADEvents(): Promise<EEWEvent[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const formatTime = (d: Date) => d.toISOString().split('T')[1].substring(0, 8);

    const url = `${AFAD_API}?start=${formatDate(fiveMinutesAgo)}%20${formatTime(fiveMinutesAgo)}&end=${formatDate(now)}%20${formatTime(now)}&minmag=3&limit=10`;

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000), // 10s timeout
        });
        const data = await response.json();

        if (!Array.isArray(data)) return [];

        return data.map((item: Record<string, unknown>) => ({
            id: `afad-${String(item.eventID || item.id || Date.now())}`,
            magnitude: Number(item.magnitude || item.mag || 0),
            latitude: Number(item.latitude || item.lat || 0),
            longitude: Number(item.longitude || item.lng || 0),
            depth: Number(item.depth || 10),
            location: String(item.location || item.region || 'Türkiye'),
            source: 'AFAD' as const,
            timestamp: Date.now(),
            // CRITICAL FIX: Never default to Date.now() — makes old/invalid events look new
            issuedAt: new Date(String(item.date || '')).getTime() || 0,
        }));
    } catch (error) {
        functions.logger.error('AFAD fetch error:', error);
        return [];
    }
}

async function fetchKandilliEvents(): Promise<EEWEvent[]> {
    try {
        // Kandilli uses HTML, we need to parse it
        const response = await fetch(KANDILLI_API, {
            headers: { 'Accept': 'text/html' },
            signal: AbortSignal.timeout(10000),
        });
        const html = await response.text();

        // Parse HTML to extract earthquake data
        const events: EEWEvent[] = [];
        const lines = html.split('\n').filter(line => line.includes('.'));

        for (const line of lines.slice(0, 10)) { // Last 10 events
            try {
                // Kandilli format: Date Time Lat Lon Depth Mag Location
                const parts = line.trim().split(/\s+/);
                if (parts.length < 7) continue;

                const dateStr = parts[0];
                const timeStr = parts[1];
                const lat = parseFloat(parts[2]);
                const lon = parseFloat(parts[3]);
                const depth = parseFloat(parts[4]);
                const mag = parseFloat(parts[5]);
                const location = parts.slice(6).join(' ');

                if (isNaN(lat) || isNaN(lon) || isNaN(mag)) continue;
                if (mag < 3.0) continue; // Filter small events

                const timestamp = new Date(`${dateStr}T${timeStr}Z`).getTime();
                const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

                if (timestamp < fiveMinutesAgo) continue; // Only recent events

                events.push({
                    id: `kandilli-${timestamp}-${Math.round(lat * 100)}`,
                    magnitude: mag,
                    latitude: lat,
                    longitude: lon,
                    depth: depth,
                    location: location || 'Türkiye',
                    source: 'KANDILLI',
                    timestamp: Date.now(),
                    issuedAt: timestamp,
                });
            } catch {
                // Skip malformed lines
            }
        }

        return events;
    } catch (error) {
        functions.logger.error('Kandilli fetch error:', error);
        return [];
    }
}

async function fetchUSGSEvents(): Promise<EEWEvent[]> {
    try {
        const response = await fetch(USGS_API, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();

        if (!data.features) return [];

        return data.features
            .filter((f: any) => {
                // Filter for Turkey region only
                const lon = f.geometry.coordinates[0];
                const lat = f.geometry.coordinates[1];
                return lat >= TURKEY_BOUNDS.minLat && lat <= TURKEY_BOUNDS.maxLat &&
                    lon >= TURKEY_BOUNDS.minLon && lon <= TURKEY_BOUNDS.maxLon;
            })
            .slice(0, 10)
            .map((f: any) => ({
                id: `usgs-${f.id}`,
                magnitude: f.properties.mag,
                latitude: f.geometry.coordinates[1],
                longitude: f.geometry.coordinates[0],
                depth: f.geometry.coordinates[2],
                location: f.properties.place || 'Turkey Region',
                source: 'USGS' as const,
                timestamp: Date.now(),
                issuedAt: f.properties.time,
            }));
    } catch (error) {
        functions.logger.error('USGS fetch error:', error);
        return [];
    }
}

async function fetchEMSCEvents(): Promise<EEWEvent[]> {
    try {
        const response = await fetch(EMSC_API, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();

        if (!data.features) return [];

        return data.features
            .filter((f: any) => {
                // Filter for Turkey region only
                const lon = f.geometry.coordinates[0];
                const lat = f.geometry.coordinates[1];
                return lat >= TURKEY_BOUNDS.minLat && lat <= TURKEY_BOUNDS.maxLat &&
                    lon >= TURKEY_BOUNDS.minLon && lon <= TURKEY_BOUNDS.maxLon;
            })
            .slice(0, 10)
            .map((f: any) => ({
                id: `emsc-${f.id}`,
                magnitude: f.properties.mag,
                latitude: f.geometry.coordinates[1],
                longitude: f.geometry.coordinates[0],
                depth: f.geometry.coordinates[2] || 10,
                location: f.properties.flynn_region || 'Turkey Region',
                source: 'EMSC' as const,
                timestamp: Date.now(),
                issuedAt: new Date(f.properties.time).getTime(),
            }));
    } catch (error) {
        functions.logger.error('EMSC fetch error:', error);
        return [];
    }
}

// ============================================================
// HELPER FUNCTIONS - VERIFICATION & DEDUPLICATION
// ============================================================

function deduplicateEvents(events: EEWEvent[]): EEWEvent[] {
    const unique: EEWEvent[] = [];
    const seen = new Set<string>();

    for (const event of events) {
        // CRITICAL FIX: Include timestamp (rounded to minute) in dedup key.
        // Without timestamp, two different earthquakes at the same location+magnitude
        // would be treated as duplicates, or the same earthquake fetched across polls
        // would be treated as different events.
        const timeMinute = event.issuedAt > 0 ? Math.floor(event.issuedAt / 60000) : 0;
        const key = `${Math.round(event.latitude * 10)}-${Math.round(event.longitude * 10)}-${Math.round(event.magnitude * 10)}-${timeMinute}`;

        if (!seen.has(key)) {
            seen.add(key);
            unique.push(event);
        }
    }

    return unique;
}

function verifyEvent(event: EEWEvent, allEvents: EEWEvent[]): EEWEvent {
    // Find matching events from other sources
    const matches = allEvents.filter(e =>
        e.source !== event.source &&
        Math.abs(e.latitude - event.latitude) < 0.5 &&
        Math.abs(e.longitude - event.longitude) < 0.5 &&
        Math.abs(e.magnitude - event.magnitude) < 1.0
    );

    if (matches.length > 0) {
        return {
            ...event,
            verified: true,
            verificationSources: [event.source, ...matches.map(m => m.source)],
        };
    }

    return event;
}

// ============================================================
// HELPER FUNCTIONS - DATABASE
// ============================================================


export async function saveEEWEvent(event: EEWEvent): Promise<void> {
    await db.collection('eew_events').doc(event.id).set({
        ...event,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// ============================================================
// HELPER FUNCTIONS - FCM WITH RETRY & LOCATION-BASED
// ============================================================

export async function sendEEWPushWithRetry(event: EEWEvent): Promise<{ sent: number; failed: number }> {
    functions.logger.warn(`🚨 SENDING FCM PUSH: M${event.magnitude} ${event.location}`);

    const isCritical = event.magnitude >= MIN_MAGNITUDE_CRITICAL;

    // ================================================================
    // PHASE 1: FCM TOPIC SEND — O(1), instant delivery to ALL subscribers
    // This is the FASTEST path: no token iteration, no Firestore reads.
    // Users subscribe to 'earthquake-alerts' and 'eew-turkey' topics via
    // FCMTokenService on the client.
    // ================================================================
    try {
        const eewData: Record<string, string> = {
            type: 'EEW',
            eventId: event.id,
            magnitude: String(event.magnitude),
            latitude: String(event.latitude),
            longitude: String(event.longitude),
            depth: String(event.depth),
            location: event.location,
            source: event.source,
            timestamp: String(event.timestamp),
            verified: String(event.verified || false),
        };

        // CRITICAL FIX: Use collapseKey/apns-collapse-id so that if the same user
        // receives this event via BOTH topic subscription AND per-token fan-out,
        // the OS collapses them into a single notification instead of showing two.
        const collapseKey = `eew_${event.id}`;

        const topicMessage: admin.messaging.Message = {
            topic: isCritical ? 'eew-turkey' : 'earthquake-alerts',
            notification: {
                title: isCritical ? '🚨 ACİL DEPREM UYARISI!' : '⚠️ DEPREM UYARISI',
                body: `M${event.magnitude.toFixed(1)} - ${event.location}${event.verified ? ' ✓' : ''}`,
            },
            data: eewData,
            android: {
                priority: 'high',
                collapseKey,
                notification: {
                    channelId: isCritical ? 'eew_critical' : 'earthquake_alerts',
                    priority: 'max',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    tag: collapseKey,
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        'content-available': 1,
                        'interruption-level': isCritical ? 'time-sensitive' : 'active',
                        'relevance-score': isCritical ? 1.0 : 0.7,
                        'thread-id': collapseKey,
                    },
                    ...eewData,
                },
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'alert',
                    'apns-expiration': '0',
                    'apns-collapse-id': collapseKey,
                },
            },
        };

        const topicResult = await messaging.send(topicMessage);
        functions.logger.info(`✅ FCM TOPIC SEND (${isCritical ? 'eew-turkey' : 'earthquake-alerts'}): ${topicResult}`);

        // For critical events, also send to the general earthquake-alerts topic
        if (isCritical) {
            const generalTopicMessage = { ...topicMessage, topic: 'earthquake-alerts' };
            await messaging.send(generalTopicMessage);
            functions.logger.info('✅ FCM TOPIC SEND (earthquake-alerts) for critical event');
        }
    } catch (topicError) {
        functions.logger.error('FCM topic send failed (falling through to per-token):', topicError);
    }

    // ================================================================
    // PHASE 2: PER-TOKEN SEND — fallback for users without topic subscription
    // (legacy tokens, Expo Push tokens that can't subscribe to FCM topics)
    // ================================================================
    const radiusKm = isCritical ?
        NEARBY_RADIUS_CRITICAL : NEARBY_RADIUS_NORMAL;

    const tokens = await getNearbyTokens(event.latitude, event.longitude, radiusKm);

    if (tokens.length === 0) {
        // Fallback: Send to all if no location data
        return sendToAllTokens(event);
    }

    return sendToTokensWithRetry(event, tokens);
}

async function getNearbyTokens(lat: number, lon: number, radiusKm: number): Promise<string[]> {
    const nearbyTokens: string[] = [];
    const seenTokens = new Set<string>();

    // V3: Check locations_current for proximity, then batch get tokens
    try {
        const locationsSnap = await db.collection('locations_current').select('latitude', 'longitude').limit(10000).get();
        const nearbyUids: string[] = [];
        for (const locDoc of locationsSnap.docs) {
            const locData = locDoc.data();
            if (typeof locData.latitude === 'number' && typeof locData.longitude === 'number') {
                const distance = calculateDistance(lat, lon, locData.latitude, locData.longitude);
                if (distance <= radiusKm) {
                    nearbyUids.push(locDoc.id);
                }
            }
        }
        // Batch token retrieval (max 30 concurrent)
        const BATCH_SIZE = 30;
        for (let i = 0; i < nearbyUids.length; i += BATCH_SIZE) {
            const batch = nearbyUids.slice(i, i + BATCH_SIZE);
            const tokenPromises = batch.map(uid =>
                db.collection('push_tokens').doc(uid).collection('devices').get()
            );
            const tokenSnaps = await Promise.all(tokenPromises);
            for (const v3Snap of tokenSnaps) {
                for (const tDoc of v3Snap.docs) {
                    const t = tDoc.data()?.token;
                    if (t && !seenTokens.has(t)) { seenTokens.add(t); nearbyTokens.push(t); }
                }
            }
        }
    } catch { /* V3 location lookup is best-effort */ }

    // Legacy: Get all tokens with location from fcm_tokens
    try {
        const tokensSnapshot = await db.collection('fcm_tokens')
            .where('location', '!=', null)
            .select('token', 'location')
            .limit(50000)
            .get();

        for (const doc of tokensSnapshot.docs) {
            const data = doc.data();
            if (data.location && data.token && !seenTokens.has(data.token)) {
                const distance = calculateDistance(
                    lat, lon,
                    data.location.latitude, data.location.longitude
                );

                if (distance <= radiusKm) {
                    seenTokens.add(data.token);
                    nearbyTokens.push(data.token);
                }
            }
        }
    } catch { /* legacy fallback */ }

    // If not enough nearby tokens, include all
    if (nearbyTokens.length < 10) {
        const allTokens = await getAllTokensMerged();
        return allTokens;
    }

    return nearbyTokens;
}

// V3: Merge tokens from both push_tokens and fcm_tokens collections
async function getAllTokensMerged(): Promise<string[]> {
    const allTokens: string[] = [];
    const seenTokens = new Set<string>();

    // V3: push_tokens/{uid}/devices
    try {
        const v3Snap = await db.collectionGroup('devices').select('token').limit(10000).get();
        for (const tDoc of v3Snap.docs) {
            // Only include docs under push_tokens (not fcm_tokens/devices)
            if (tDoc.ref.parent.parent?.parent.id === 'push_tokens') {
                const t = tDoc.data()?.token;
                if (t && !seenTokens.has(t)) { seenTokens.add(t); allTokens.push(t); }
            }
        }
    } catch { /* collectionGroup may fail if no composite index */ }

    // Legacy: fcm_tokens
    const tokensSnapshot = await db.collection('fcm_tokens').select('token').limit(50000).get();
    for (const d of tokensSnapshot.docs) {
        const t = d.data()?.token;
        if (t && !seenTokens.has(t)) { seenTokens.add(t); allTokens.push(t); }
    }

    return allTokens;
}

async function sendToAllTokens(event: EEWEvent): Promise<{ sent: number; failed: number }> {
    const tokens = await getAllTokensMerged();
    return sendToTokensWithRetry(event, tokens);
}

async function sendToTokensWithRetry(
    event: EEWEvent,
    tokens: string[]
): Promise<{ sent: number; failed: number }> {
    if (tokens.length === 0) {
        functions.logger.warn('No push tokens found');
        return { sent: 0, failed: 0 };
    }

    const isCritical = event.magnitude >= MIN_MAGNITUDE_CRITICAL;
    const expoTokens = tokens.filter(isExpoPushToken);
    const nativeTokens = tokens.filter(t => !isExpoPushToken(t));
    let totalSent = 0;
    let totalFailed = 0;

    // 1) Expo tokens (ExponentPushToken / ExpoPushToken)
    if (expoTokens.length > 0) {
        const expoChannelId = isCritical ? 'eew_critical' : 'earthquake_alerts';
        const expoMessages: ExpoPushMessage[] = expoTokens.map((token) => ({
            to: token,
            title: isCritical ? '🚨 ACİL DEPREM UYARISI!' : '⚠️ DEPREM UYARISI',
            body: `M${event.magnitude.toFixed(1)} - ${event.location}${event.verified ? ' ✓' : ''}`,
            data: {
                type: 'EEW',
                eventId: event.id,
                magnitude: String(event.magnitude),
                latitude: String(event.latitude),
                longitude: String(event.longitude),
                depth: String(event.depth),
                location: event.location,
                source: event.source,
                timestamp: String(event.timestamp),
                verified: String(event.verified || false),
            },
            sound: 'default',
            priority: 'high',
            channelId: expoChannelId,
        }));

        for (let i = 0; i < expoMessages.length; i += 100) {
            const batch = expoMessages.slice(i, i + 100);
            const result = await sendExpoPush(batch);
            totalSent += result.successCount;
            totalFailed += result.failCount;
        }
    }

    if (nativeTokens.length === 0) {
        return { sent: totalSent, failed: totalFailed };
    }

    // Extract data payload so it can be spread into APNS payload
    const eewData: Record<string, string> = {
        type: 'EEW',
        eventId: event.id,
        magnitude: String(event.magnitude),
        latitude: String(event.latitude),
        longitude: String(event.longitude),
        depth: String(event.depth),
        location: event.location,
        source: event.source,
        timestamp: String(event.timestamp),
        verified: String(event.verified || false),
    };

    // CRITICAL FIX: Use collapseKey/tag/apns-collapse-id matching the topic message
    // so the OS collapses topic + per-token duplicates into a single notification.
    const perTokenCollapseKey = `eew_${event.id}`;

    const message: admin.messaging.MulticastMessage = {
        tokens: nativeTokens,
        notification: {
            title: isCritical ? '🚨 ACİL DEPREM UYARISI!' : '⚠️ DEPREM UYARISI',
            body: `M${event.magnitude.toFixed(1)} - ${event.location}${event.verified ? ' ✓' : ''}`,
        },
        data: eewData,
        android: {
            priority: 'high',
            collapseKey: perTokenCollapseKey,
            notification: {
                channelId: isCritical ? 'eew_critical' : 'earthquake_alerts',
                priority: 'max',
                defaultSound: true,
                defaultVibrateTimings: true,
                tag: perTokenCollapseKey,
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1,
                    'content-available': 1,
                    'interruption-level': isCritical ? 'time-sensitive' : 'active',
                    'relevance-score': isCritical ? 1.0 : 0.7,
                    'thread-id': perTokenCollapseKey,
                },
                // CRITICAL FIX: Include data in APNS payload for iOS notification tap
                // Firebase Admin SDK does NOT auto-merge top-level data into apns.payload
                ...eewData,
            },
            headers: {
                'apns-priority': '10',
                'apns-push-type': 'alert',
                'apns-expiration': '0',
                'apns-collapse-id': perTokenCollapseKey,
            },
        },
    };

    // V2: Retry with exponential backoff
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_FCM_RETRIES; attempt++) {
        try {
            const response = await messaging.sendEachForMulticast(message);

            functions.logger.info(`✅ FCM sent (attempt ${attempt + 1}): ${response.successCount} success, ${response.failureCount} failed`);

            // Clean up invalid tokens
            await cleanupInvalidTokens(nativeTokens, response.responses);

            totalSent += response.successCount;
            totalFailed += response.failureCount;
            return { sent: totalSent, failed: totalFailed };
        } catch (error) {
            lastError = error as Error;
            functions.logger.error(`FCM attempt ${attempt + 1} failed:`, error);

            if (attempt < MAX_FCM_RETRIES - 1) {
                // Exponential backoff
                const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    functions.logger.error(`FCM failed after ${MAX_FCM_RETRIES} attempts:`, lastError);
    totalFailed += nativeTokens.length;
    return { sent: totalSent, failed: totalFailed };
}

// ============================================================
// CROWDSOURCED ALERT
// ============================================================

async function createCrowdsourcedAlert(consensus: PWaveConsensus): Promise<void> {
    // Estimate magnitude from G-force
    const estimatedMagnitude = Math.min(7.0, 4.0 + Math.log10(consensus.avgMagnitude * 100));

    const event: EEWEvent = {
        id: `crowdsourced-${Date.now()}`,
        magnitude: estimatedMagnitude,
        latitude: consensus.centerLatitude,
        longitude: consensus.centerLongitude,
        depth: 10,
        location: 'P-Wave Detection (Crowdsourced)',
        source: 'CROWDSOURCED',
        timestamp: Date.now(),
        issuedAt: consensus.firstDetectionAt,
    };

    await saveEEWEvent(event);

    // Save consensus
    await db.collection('eew_consensus').add({
        ...consensus,
        alertEventId: event.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send push if confidence is high enough
    if (consensus.avgConfidence >= 85 && consensus.detectionCount >= 5) {
        await sendEEWPushWithRetry(event);
    }
}

// ============================================================
// 1. FAST EEW MONITOR (Every 10 seconds) - CRITICAL
// ============================================================

export const eewMonitorFast = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .pubsub.schedule('every 1 minutes')
    .onRun(async () => {
        functions.logger.info('🔍 EEW Monitor FAST running...');

        try {
            // Fetch from ALL sources in parallel
            const [afadEvents, kandilliEvents, usgsEvents, emscEvents] = await Promise.all([
                fetchAFADEvents(),
                fetchKandilliEvents(),
                fetchUSGSEvents(),
                fetchEMSCEvents(),
            ]);

            // Combine all events
            const allEvents = [...afadEvents, ...kandilliEvents, ...usgsEvents, ...emscEvents];

            // Deduplicate by location/time proximity
            const uniqueEvents = deduplicateEvents(allEvents);

            functions.logger.info(`📊 Sources: AFAD=${afadEvents.length}, Kandilli=${kandilliEvents.length}, USGS=${usgsEvents.length}, EMSC=${emscEvents.length}`);

            let processedCount = 0;
            for (const event of uniqueEvents) {
                // Multi-source verification
                const verifiedEvent = verifyEvent(event, allEvents);

                // IDEMPOTENCY: Use Firestore transaction to atomically check+create.
                // A simple read-then-write check is NOT race-safe — two Cloud Function
                // instances can both read "not exists" at the same time and both send FCM.
                // The transaction makes the entire check+save atomic; only ONE instance wins.
                const eventRef = db.collection('eew_events').doc(verifiedEvent.id);
                let alreadyProcessed = false;
                try {
                    await db.runTransaction(async (tx) => {
                        const doc = await tx.get(eventRef);
                        if (doc.exists) {
                            alreadyProcessed = true;
                            return;
                        }
                        tx.set(eventRef, {
                            ...verifiedEvent,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    });
                } catch (txError) {
                    functions.logger.error(`Transaction failed for event ${verifiedEvent.id}:`, txError);
                    continue; // Skip this event on transaction failure
                }
                if (alreadyProcessed) continue;

                // CRITICAL FIX: Timestamp freshness check — NEVER send push for stale events.
                // Old earthquakes (hours/days old) can appear if API returns historical data,
                // Firestore doc was deleted, or service restarted. This is the ROOT CAUSE of
                // false earthquake notifications.
                const MAX_EVENT_AGE_MS = 15 * 60 * 1000; // 15 minutes
                const eventAge = Date.now() - verifiedEvent.issuedAt;
                if (verifiedEvent.issuedAt <= 0 || eventAge > MAX_EVENT_AGE_MS) {
                    functions.logger.warn(`⏭️ Skipping stale/invalid event M${verifiedEvent.magnitude} at ${verifiedEvent.location} (age: ${Math.round(eventAge / 60000)}min, issuedAt: ${verifiedEvent.issuedAt})`);
                    continue;
                }

                // Send FCM if significant (only reached by the ONE winning transaction)
                if (verifiedEvent.magnitude >= MIN_MAGNITUDE_ALERT) {
                    // V2: Location-based push
                    await sendEEWPushWithRetry(verifiedEvent);
                    processedCount++;
                }
            }

            functions.logger.info(`✅ Processed ${processedCount} new significant events`);
        } catch (error) {
            functions.logger.error('❌ EEW Monitor error:', error);
        }

        return null;
    });

// ============================================================
// 2. BACKUP MONITOR (Every 30 seconds) - REDUNDANCY
// ============================================================

export const eewMonitorBackup = functions
    .region(REGION)
    .pubsub.schedule('every 3 minutes')
    .onRun(async () => {
        // Same logic as fast monitor but offset by 30 seconds internally
        // This provides redundancy if fast monitor fails
        functions.logger.info('🔄 EEW Backup Monitor running...');

        try {
            // Only fetch AFAD and Kandilli for backup (faster)
            const [afadEvents, kandilliEvents] = await Promise.all([
                fetchAFADEvents(),
                fetchKandilliEvents(),
            ]);

            const allEvents = [...afadEvents, ...kandilliEvents];

            for (const event of allEvents) {
                if (event.magnitude < MIN_MAGNITUDE_CRITICAL) continue;

                // CRITICAL FIX: Same freshness check as fast monitor
                const backupEventAge = Date.now() - event.issuedAt;
                if (event.issuedAt <= 0 || backupEventAge > 15 * 60 * 1000) {
                    functions.logger.warn(`⏭️ Backup: skipping stale event M${event.magnitude} (age: ${Math.round(backupEventAge / 60000)}min)`);
                    continue;
                }

                // IDEMPOTENCY: Atomic transaction (same pattern as fast monitor)
                const eventRef = db.collection('eew_events').doc(event.id);
                let alreadyProcessed = false;
                try {
                    await db.runTransaction(async (tx) => {
                        const doc = await tx.get(eventRef);
                        if (doc.exists) { alreadyProcessed = true; return; }
                        tx.set(eventRef, {
                            ...event,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    });
                } catch { continue; }
                if (alreadyProcessed) continue;

                await sendEEWPushWithRetry(event);
                functions.logger.warn(`🚨 BACKUP caught critical event: M${event.magnitude}`);
            }
        } catch (error) {
            functions.logger.error('❌ Backup Monitor error:', error);
        }

        return null;
    });

// ============================================================
// 3. EMERGENCY MANUAL TRIGGER (HTTP) - For admins
// ============================================================

export const eewEmergencyTrigger = functions
    .region(REGION)
    .https.onRequest(async (req, res) => {
        // CORS - ELITE SECURITY: Restrict to AfetNet domains
        const allowedOrigins = [
            'https://afetnet.com',
            'https://www.afetnet.com',
            'https://api.afetnet.com',
            'https://afetnet-app.web.app',
            'https://afetnet-app.firebaseapp.com',
        ];
        const origin = req.headers.origin || '';
        if (allowedOrigins.includes(origin)) {
            res.set('Access-Control-Allow-Origin', origin);
        }

        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Methods', 'POST');
            res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
            res.status(204).send('');
            return;
        }

        // Verify API key - ELITE SECURITY: No fallback, environment variable REQUIRED
        const apiKey = req.headers['x-api-key'];
        const validKey = process.env.EEW_API_KEY;

        if (!validKey) {
            functions.logger.error('EEW_API_KEY environment variable not configured!');
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }

        // SECURITY FIX: Timing-safe comparison to prevent timing attacks
        if (!apiKey || typeof apiKey !== 'string' ||
            apiKey.length !== validKey.length ||
            !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(validKey))) {
            res.status(403).json({ error: 'Invalid API key' });
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'POST only' });
            return;
        }

        try {
            // Force immediate fetch from all sources
            const [afadEvents, kandilliEvents, usgsEvents] = await Promise.all([
                fetchAFADEvents(),
                fetchKandilliEvents(),
                fetchUSGSEvents(),
            ]);

            const allEvents = [...afadEvents, ...kandilliEvents, ...usgsEvents];
            let sentCount = 0;

            for (const event of allEvents) {
                if (event.magnitude >= MIN_MAGNITUDE_ALERT) {
                    // IDEMPOTENCY: Atomic transaction (same pattern as eewMonitorFast/Backup)
                    // A simple read-then-write is NOT race-safe — two concurrent HTTP triggers
                    // can both read "not exists" and both send FCM. Transaction makes it atomic.
                    const eventId = `${event.source}_${event.id || event.timestamp}`;
                    const eventRef = db.collection('eew_events').doc(eventId);
                    let alreadyProcessed = false;
                    try {
                        await db.runTransaction(async (tx) => {
                            const doc = await tx.get(eventRef);
                            if (doc.exists) {
                                alreadyProcessed = true;
                                return;
                            }
                            tx.set(eventRef, {
                                ...event,
                                id: eventId,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        });
                    } catch (txError) {
                        functions.logger.error(`Emergency trigger transaction failed for ${eventId}:`, txError);
                        continue;
                    }
                    if (alreadyProcessed) continue;

                    await sendEEWPushWithRetry(event);
                    sentCount++;
                }
            }

            res.json({
                success: true,
                message: `Emergency check completed. Sent ${sentCount} alerts.`,
                sources: {
                    afad: afadEvents.length,
                    kandilli: kandilliEvents.length,
                    usgs: usgsEvents.length,
                }
            });
        } catch (error) {
            functions.logger.error('Emergency trigger error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });

// ============================================================
// 4. REAL-TIME P-WAVE CONSENSUS TRIGGER
// ============================================================

export const onPWaveDetection = functions
    .region(REGION)
    .firestore.document('eew_pwave_detections/{detectionId}')
    .onCreate(async (snap, _context) => {
        const detection = snap.data();

        // Idempotency guard: onCreate can fire more than once
        if (detection._processed) return;

        functions.logger.info('🌊 New P-wave detection:', detection);

        try {
            // Find nearby detections in last 30 seconds
            // CRITICAL FIX: Add .limit(500) to prevent unbounded reads. During a real earthquake
            // with thousands of device reports, unbounded query can timeout or explode billing.
            // NOTE: This query needs a composite index: (timestamp ASC, latitude ASC)
            const thirtySecondsAgo = Date.now() - 30000;
            const nearbyDetections = await db
                .collection('eew_pwave_detections')
                .where('timestamp', '>', thirtySecondsAgo)
                .where('latitude', '>=', detection.latitude - 1)
                .where('latitude', '<=', detection.latitude + 1)
                .limit(500)
                .get();

            // FIX: Client-side longitude filter — Firestore only supports range filter on one field
            const detections = nearbyDetections.docs
                .map(d => d.data())
                .filter(d => Math.abs(d.longitude - detection.longitude) <= 1);

            // SECURITY FIX: Deduplicate by userId to prevent Sybil attacks
            // Each unique user can only contribute one detection to consensus
            const uniqueUserDetections = new Map<string, typeof detections[0]>();
            for (const d of detections) {
                const userId = d.userId || d.deviceId;
                if (!uniqueUserDetections.has(userId)) {
                    uniqueUserDetections.set(userId, d);
                }
            }
            const uniqueDetections = Array.from(uniqueUserDetections.values());

            // SECURITY FIX: Raised threshold from 3 to 5 unique users
            if (uniqueDetections.length >= CONSENSUS_THRESHOLD) {
                const avgConfidence = uniqueDetections.reduce((sum, d) => sum + d.confidence, 0) / uniqueDetections.length;

                if (avgConfidence >= CONSENSUS_CONFIDENCE) {
                    functions.logger.warn(`🚨 CONSENSUS REACHED: ${uniqueDetections.length} unique devices!`);

                    // Create crowdsourced alert
                    const consensus: PWaveConsensus = {
                        centerLatitude: uniqueDetections.reduce((sum, d) => sum + d.latitude, 0) / uniqueDetections.length,
                        centerLongitude: uniqueDetections.reduce((sum, d) => sum + d.longitude, 0) / uniqueDetections.length,
                        radiusKm: 100,
                        detectionCount: uniqueDetections.length,
                        avgConfidence,
                        avgMagnitude: uniqueDetections.reduce((sum, d) => sum + d.magnitude, 0) / uniqueDetections.length,
                        deviceIds: uniqueDetections.map(d => d.deviceId),
                        firstDetectionAt: Math.min(...uniqueDetections.map(d => d.timestamp)),
                        lastDetectionAt: Math.max(...uniqueDetections.map(d => d.timestamp)),
                    };

                    await createCrowdsourcedAlert(consensus);
                }
            }

            // Mark as processed after all work is done
            await snap.ref.update({ _processed: true }).catch(() => {});
        } catch (error) {
            // Do NOT set _processed on error — allow CF retry
            functions.logger.error('onPWaveDetection error:', error);
            throw error; // Re-throw to trigger Cloud Functions retry
        }

        return null;
    });

// ============================================================
// 6. MANUAL EEW BROADCAST (Admin only)
// ============================================================

export const broadcastEEW = functions
    .region(REGION)
    .https.onCall(async (data, context) => {
        // Check admin
        if (!context.auth?.token?.admin) {
            throw new functions.https.HttpsError('permission-denied', 'Admin only');
        }

        // SECURITY FIX: Validate required fields even for admin endpoints (defense-in-depth)
        const magnitude = Number(data.magnitude);
        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);

        if (!Number.isFinite(magnitude) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new functions.https.HttpsError('invalid-argument', 'magnitude, latitude, and longitude must be valid numbers');
        }

        if (magnitude < 0 || magnitude > 12) {
            throw new functions.https.HttpsError('invalid-argument', 'magnitude must be between 0 and 12');
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid latitude/longitude range');
        }

        const event: EEWEvent = {
            id: `manual-${Date.now()}`,
            magnitude,
            latitude,
            longitude,
            depth: Number(data.depth) || 10,
            location: data.location || 'Unknown',
            source: 'AFAD',
            timestamp: Date.now(),
            issuedAt: Date.now(),
        };

        await saveEEWEvent(event);
        const result = await sendEEWPushWithRetry(event);

        return { success: true, ...result };
    });

// ============================================================
// 7. HTTP WEBHOOK FOR EXTERNAL TRIGGERS
// ============================================================

export const eewWebhook = functions
    .region(REGION)
    .https.onRequest(async (req, res) => {
        // Verify API key - ELITE SECURITY: No fallback, environment variable REQUIRED
        const apiKey = req.headers['x-api-key'];
        const validKey = process.env.EEW_API_KEY;

        if (!validKey) {
            functions.logger.error('EEW_API_KEY environment variable not configured!');
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }

        // SECURITY FIX: Timing-safe comparison to prevent timing attacks
        if (!apiKey || typeof apiKey !== 'string' ||
            apiKey.length !== validKey.length ||
            !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(validKey))) {
            res.status(403).json({ error: 'Invalid API key' });
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'POST only' });
            return;
        }

        try {
            // SECURITY FIX: Validate required numeric fields before constructing event
            const magnitude = Number(req.body.magnitude);
            const latitude = Number(req.body.latitude);
            const longitude = Number(req.body.longitude);

            if (!Number.isFinite(magnitude) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                res.status(400).json({ error: 'magnitude, latitude, and longitude must be valid numbers' });
                return;
            }

            if (magnitude < 0 || magnitude > 12) {
                res.status(400).json({ error: 'magnitude must be between 0 and 12' });
                return;
            }

            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                res.status(400).json({ error: 'Invalid latitude/longitude range' });
                return;
            }

            // SECURITY FIX: Validate source against known list to prevent arbitrary values
            const VALID_SOURCES: EEWEvent['source'][] = ['AFAD', 'KANDILLI', 'USGS', 'EMSC', 'CROWDSOURCED'];
            const rawSource = typeof req.body.source === 'string' ? req.body.source.toUpperCase() : 'AFAD';
            const source = (VALID_SOURCES.includes(rawSource as EEWEvent['source']) ? rawSource : 'AFAD') as EEWEvent['source'];

            const event: EEWEvent = {
                id: req.body.id || `webhook-${Date.now()}`,
                magnitude,
                latitude,
                longitude,
                depth: Number(req.body.depth) || 10,
                location: req.body.location || 'Unknown',
                source,
                timestamp: Date.now(),
                issuedAt: Date.now(),
            };

            await saveEEWEvent(event);

            if (event.magnitude >= MIN_MAGNITUDE_ALERT) {
                await sendEEWPushWithRetry(event);
            }

            res.json({ success: true, eventId: event.id });
        } catch (error) {
            functions.logger.error('Webhook error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });
