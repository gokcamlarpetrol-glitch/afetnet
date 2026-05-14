/**
 * AFETNET FIREBASE FUNCTIONS - ADMIN / UTILITY MODULE
 *
 * Functions:
 * - dailyAnalytics: Daily analytics aggregation
 * - tokenCleanup: Weekly old token cleanup
 * - cleanupSeismicReports: Hourly seismic report cleanup
 * - sendCustomEmail: Premium branded email sender
 * - openAIChatProxy: Authenticated OpenAI chat proxy
 * - registerFCMToken: FCM/Expo push token registration
 * - subscribeToTopics: FCM topic subscription for native tokens
 * - onSeismicReportCreated: Crowdsourced seismic report trigger
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

import {
    db,
    REGION,
    FCMToken,
    EEWEvent,
    OpenAIProxyMessage,
    MIN_MAGNITUDE_ALERT,
    calculateDistance,
} from './utils';

import { saveEEWEvent, sendEEWPushWithRetry } from './eew';

// ============================================================
// SMTP CONFIGURATION
// ============================================================

const SMTP_EMAIL = process.env.SMTP_EMAIL || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';

// ============================================================
// OPENAI PROXY RATE LIMITING
// ============================================================

// SECURITY FIX: Per-UID rate limiting with Firestore persistence
// In-memory cache as primary, with Firestore backup for cross-instance consistency
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // SECURITY FIX: Reduced from 30 to 20
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

async function checkRateLimitPersistent(uid: string): Promise<boolean> {
    const now = Date.now();
    // Quick in-memory check first
    const entry = rateLimitMap.get(uid);
    if (entry && now < entry.resetAt && entry.count >= RATE_LIMIT_MAX) {
        return false;
    }
    if (!entry || now >= (entry?.resetAt || 0)) {
        rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
        entry.count++;
    }

    // Also check Firestore for cross-instance consistency
    try {
        const rateLimitRef = db.collection('rate_limits').doc(uid);
        let firestoreAllowed = true;
        await db.runTransaction(async (tx) => {
            const rateLimitDoc = await tx.get(rateLimitRef);
            const data = rateLimitDoc.exists ? rateLimitDoc.data() : undefined;
            const resetAt = typeof data?.resetAt === 'number' ? data.resetAt : 0;
            const count = typeof data?.count === 'number' ? data.count : 0;

            if (resetAt > now && count >= RATE_LIMIT_MAX) {
                firestoreAllowed = false;
                return;
            }

            if (!rateLimitDoc.exists || resetAt <= now) {
                tx.set(rateLimitRef, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }, { merge: true });
            } else {
                tx.set(rateLimitRef, {
                    count: admin.firestore.FieldValue.increment(1),
                    resetAt,
                }, { merge: true });
            }
        });
        if (!firestoreAllowed) {
            return false;
        }
    } catch {
        // If Firestore check fails, fall back to in-memory only
    }
    return true;
}

function isOpenAIProxyRole(value: unknown): value is OpenAIProxyMessage['role'] {
    return value === 'system' || value === 'user' || value === 'assistant';
}

function resolveOpenAIKey(): string {
    const envKeys = [
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_KEY,
        process.env.OPENAI_SECRET_KEY,
    ];
    for (const candidate of envKeys) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }

    return '';
}

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// PREMIUM EMAIL TEMPLATES
// ============================================================

function getVerificationEmailHTML(displayName: string, link: string): string {
    const safeDisplayName = escapeHtml(displayName);
    const safeLink = escapeHtml(link);
    return `<div style="max-width:600px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 24px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;letter-spacing:-0.5px;">AfetNet</h1>
<p style="color:#94a3b8;font-size:13px;margin:8px 0 0;font-weight:400;">Afet Bilgi ve Koordinasyon Platformu</p>
</div>
<div style="padding:32px 28px;">
<p style="font-size:17px;color:#1a1a2e;margin:0 0 8px;font-weight:600;">Merhaba ${safeDisplayName},</p>
<p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">AfetNet ailesine hoşgeldiniz! Hesabınızı aktif hale getirmek için aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın.</p>
<div style="text-align:center;margin:28px 0;">
<a href="${safeLink}" style="display:inline-block;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#ffffff;padding:16px 48px;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">Hesabımı Doğrula</a>
</div>
<p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:24px 0 0;">Bu bağlantı 24 saat geçerlidir. Eğer bu hesabı siz oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
</div>
<div style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e8e8e8;text-align:center;">
<p style="font-size:12px;color:#94a3b8;margin:0;">Bu e-posta AfetNet tarafından otomatik olarak gönderilmiştir.</p>
<p style="font-size:11px;color:#cbd5e1;margin:6px 0 0;">© 2026 AfetNet. Tüm hakları saklıdır.</p>
</div>
</div>`;
}

function getEmailChangeHTML(displayName: string, newEmail: string, link: string): string {
    const safeDisplayName = escapeHtml(displayName);
    const safeNewEmail = escapeHtml(newEmail);
    const safeLink = escapeHtml(link);
    return `<div style="max-width:600px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 24px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;letter-spacing:-0.5px;">AfetNet</h1>
<p style="color:#94a3b8;font-size:13px;margin:8px 0 0;font-weight:400;">Afet Bilgi ve Koordinasyon Platformu</p>
</div>
<div style="padding:32px 28px;">
<p style="font-size:17px;color:#1a1a2e;margin:0 0 8px;font-weight:600;">Merhaba ${safeDisplayName},</p>
<p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">AfetNet hesabınızın e-posta adresi <strong>${safeNewEmail}</strong> olarak değiştirildi. Eğer bu değişikliği siz yapmadıysanız, aşağıdaki butona tıklayarak geri alabilirsiniz.</p>
<div style="text-align:center;margin:28px 0;">
<a href="${safeLink}" style="display:inline-block;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#ffffff;padding:16px 48px;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">Değişikliği Geri Al</a>
</div>
<p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:24px 0 0;">Eğer bu değişikliği siz yaptıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
</div>
<div style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e8e8e8;text-align:center;">
<p style="font-size:12px;color:#94a3b8;margin:0;">Bu e-posta AfetNet tarafından otomatik olarak gönderilmiştir.</p>
<p style="font-size:11px;color:#cbd5e1;margin:6px 0 0;">© 2026 AfetNet. Tüm hakları saklıdır.</p>
</div>
</div>`;
}

// ============================================================
// SEISMIC REPORT HELPER
// ============================================================

function estimateMagnitudeFromAccel(peakAccelG: number): number {
    // Convert g to cm/s² (1g = 980.665 cm/s²)
    const pgaCmS2 = peakAccelG * 980.665;
    if (pgaCmS2 <= 0) return 3.0;

    const estimated = Math.log10(pgaCmS2) + 2.5;
    return Math.max(3.0, Math.min(8.0, estimated));
}

// ============================================================
// 9. DAILY ANALYTICS AGGREGATION
// ============================================================

export const dailyAnalytics = functions
    .region(REGION)
    .pubsub.schedule('every day 00:00')
    .timeZone('Europe/Istanbul')
    .onRun(async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count events (use count aggregation to avoid full document reads)
        const eventsCount = await db
            .collection('eew_events')
            .where('timestamp', '>=', yesterday.getTime())
            .where('timestamp', '<', today.getTime())
            .count().get();

        // Count P-wave detections
        const detectionsCount = await db
            .collection('eew_pwave_detections')
            .where('timestamp', '>=', yesterday.getTime())
            .where('timestamp', '<', today.getTime())
            .count().get();

        // Count FCM tokens (legacy + V3)
        const tokensSnapshot = await db.collection('fcm_tokens').count().get();
        let v3TokenCount = 0;
        try {
            const pushTokensSnap = await db.collectionGroup('devices').count().get();
            v3TokenCount = pushTokensSnap.data().count;
        } catch { /* collectionGroup may not exist */ }

        // Save analytics
        await db.collection('eew_analytics_daily').add({
            date: yesterday.toISOString().split('T')[0],
            eventCount: eventsCount.data().count,
            detectionCount: detectionsCount.data().count,
            activeTokenCount: tokensSnapshot.data().count,
            v3TokenCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(`📊 Daily analytics: ${eventsCount.data().count} events, ${detectionsCount.data().count} detections, ${tokensSnapshot.data().count} legacy tokens, ${v3TokenCount} V3 tokens`);

        return null;
    });

// ============================================================
// TOKEN CLEANUP (Weekly)
// ============================================================

export const tokenCleanup = functions
    .region(REGION)
    .pubsub.schedule('every sunday 03:00')
    .timeZone('Europe/Istanbul')
    .onRun(async () => {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const oldTokens = await db
            .collection('fcm_tokens')
            .where('lastUpdated', '<', thirtyDaysAgo)
            .limit(5000)
            .get();

        // FIX #2: Chunk batches to stay under Firestore 500 doc limit
        const BATCH_SIZE = 450;
        const docs = oldTokens.docs;
        let deletedCount = 0;

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const chunk = docs.slice(i, i + BATCH_SIZE);
            const batch = db.batch();
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deletedCount += chunk.length;
        }

        // Also cleanup device subcollections for deleted users
        for (const tokenDoc of docs) {
            try {
                const devicesSnapshot = await tokenDoc.ref.collection('devices').get();
                if (devicesSnapshot.size > 0) {
                    const subBatch = db.batch();
                    devicesSnapshot.docs.forEach(d => subBatch.delete(d.ref));
                    await subBatch.commit();
                }
            } catch {
                // Subcollection may not exist — safe to ignore
            }
        }

        // V3: Also cleanup old push_tokens (same 30-day threshold)
        let v3DeletedCount = 0;
        try {
            const oldV3Tokens = await db
                .collectionGroup('devices')
                .where('lastUpdated', '<', thirtyDaysAgo)
                .limit(10000)
                .get();

            // Filter to only push_tokens subcollections (not fcm_tokens/devices)
            const v3Docs = oldV3Tokens.docs.filter(d => {
                const parentId = d.ref.parent.parent?.parent?.id;
                return parentId === 'push_tokens';
            });

            for (let i = 0; i < v3Docs.length; i += BATCH_SIZE) {
                const chunk = v3Docs.slice(i, i + BATCH_SIZE);
                const v3Batch = db.batch();
                chunk.forEach(d => v3Batch.delete(d.ref));
                await v3Batch.commit();
                v3DeletedCount += chunk.length;
            }
        } catch (v3Err) {
            functions.logger.warn('V3 push_tokens cleanup error (non-critical):', v3Err);
        }

        functions.logger.info(`🧹 Cleaned up ${deletedCount} old FCM tokens + ${v3DeletedCount} old V3 push_tokens`);

        return null;
    });

// ============================================================
// FCM TOKEN REGISTRATION
// ============================================================

export const registerFCMToken = functions
    .region(REGION)
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
        }

        const { token, platform, latitude, longitude, installationId } = data;

        const normalizedToken = typeof token === 'string' ? token.trim() : '';
        const normalizedPlatform = typeof platform === 'string' ? platform.trim().toLowerCase() : '';

        if (!normalizedToken || !normalizedPlatform) {
            throw new functions.https.HttpsError('invalid-argument', 'Token and platform required');
        }

        if (normalizedToken.length < 10 || normalizedToken.length > 4096 || normalizedToken.includes('/')) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid push token');
        }

        if (normalizedPlatform !== 'ios' && normalizedPlatform !== 'android') {
            throw new functions.https.HttpsError('invalid-argument', 'platform must be ios or android');
        }

        const latNum = typeof latitude === 'number' ? latitude : Number(latitude);
        const lonNum = typeof longitude === 'number' ? longitude : Number(longitude);
        const hasValidLocation = Number.isFinite(latNum) &&
            Number.isFinite(lonNum) &&
            latNum >= -90 &&
            latNum <= 90 &&
            lonNum >= -180 &&
            lonNum <= 180;

        // CANONICAL: uid (from Firebase Auth context) is THE primary key.
        const uid = context.auth.uid;

        const tokenDoc: FCMToken = {
            token: normalizedToken,
            userId: uid,
            platform: normalizedPlatform,
            lastUpdated: Date.now(),
            location: hasValidLocation ? { latitude: latNum, longitude: lonNum } : undefined,
        };

        // CANONICAL: Use installationId from client when provided (matches client-side
        // write path: push_tokens/{uid}/devices/{installationId}).
        // Fall back to tokenHash for backward compatibility with older clients.
        const tokenHash = normalizedToken.substring(normalizedToken.length - 16).replace(/[\/#?\[\]]/g, '_');
        const normalizedInstallationId = typeof installationId === 'string'
            ? installationId.trim()
            : '';
        const deviceKey = /^[A-Za-z0-9_.:-]{8,128}$/.test(normalizedInstallationId)
            ? normalizedInstallationId
            : tokenHash;

        // Also add installationId to the doc for traceability
        const tokenDocWithInstallation = {
            ...tokenDoc,
            ...(deviceKey !== tokenHash
                ? { installationId: deviceKey }
                : {}),
        };

        await Promise.all([
            // V3 PRIMARY: push_tokens/{uid}/devices/{deviceKey}
            db.collection('push_tokens').doc(uid).collection('devices').doc(deviceKey).set(tokenDocWithInstallation, { merge: true }),
            // Legacy: fcm_tokens/{uid} + subcollection
            db.collection('fcm_tokens').doc(uid).collection('devices').doc(deviceKey).set(tokenDoc, { merge: true }),
            db.collection('fcm_tokens').doc(uid).set(tokenDoc, { merge: true }),
        ]);

        functions.logger.info(`✅ FCM token registered for user ${uid} (device: ${deviceKey}) — both push_tokens + fcm_tokens`);

        return { success: true };
    });

// ============================================================
// OPENAI CHAT PROXY (Authenticated)
// ============================================================

export const openAIChatProxy = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 300, memory: '256MB' })
    .https.onRequest(async (req, res) => {
        // FIX #6: Restrict CORS to AfetNet domains instead of wildcard
        const proxyAllowedOrigins = [
            'https://afetnet.com',
            'https://www.afetnet.com',
            'https://api.afetnet.com',
            'https://afetnet-app.web.app',
            'https://afetnet-app.firebaseapp.com',
        ];
        const reqOrigin = req.headers.origin || '';
        if (proxyAllowedOrigins.includes(reqOrigin)) {
            res.set('Access-Control-Allow-Origin', reqOrigin);
        } else {
            // Allow mobile apps (no origin header) but block unknown web origins
            if (!reqOrigin) {
                res.set('Access-Control-Allow-Origin', '*');
            }
        }
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'POST only' });
            return;
        }

        const authHeader = typeof req.headers.authorization === 'string'
            ? req.headers.authorization
            : '';
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing bearer token' });
            return;
        }

        const idToken = authHeader.substring(7).trim();
        if (idToken.length === 0) {
            res.status(401).json({ error: 'Invalid bearer token' });
            return;
        }

        let uid: string;
        try {
            const decoded = await admin.auth().verifyIdToken(idToken);
            uid = decoded.uid;
        } catch (error) {
            functions.logger.warn('OpenAI proxy auth failed', { error });
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // SECURITY FIX: Persistent rate limiting (cross-instance)
        const allowed = await checkRateLimitPersistent(uid);
        if (!allowed) {
            functions.logger.warn('OpenAI proxy rate limit exceeded', { uid });
            res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
            return;
        }

        const openAIKey = resolveOpenAIKey();
        if (!openAIKey) {
            functions.logger.error('OPENAI_API_KEY not configured in function environment');
            res.status(500).json({ error: 'AI backend not configured' });
            return;
        }

        const body = req.body && typeof req.body === 'object'
            ? req.body as Record<string, unknown>
            : {};
        const rawMessages = Array.isArray(body.messages) ? body.messages : [];

        const messages: OpenAIProxyMessage[] = [];
        for (const rawMessage of rawMessages) {
            if (!rawMessage || typeof rawMessage !== 'object') {
                continue;
            }
            const candidate = rawMessage as Record<string, unknown>;
            if (!isOpenAIProxyRole(candidate.role)) {
                continue;
            }
            if (typeof candidate.content !== 'string') {
                continue;
            }
            const content = candidate.content.trim();
            if (content.length === 0 || content.length > 12000) {
                continue;
            }
            messages.push({ role: candidate.role, content });
        }

        if (messages.length === 0 || messages.length > 30) {
            res.status(400).json({ error: 'Invalid messages payload' });
            return;
        }

        // SECURITY FIX: Lock model to approved whitelist to prevent cost abuse
        const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-3.5-turbo'];
        const requestedModel = typeof body.model === 'string' ? body.model.trim() : '';
        const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : 'gpt-4o-mini';
        const requestedMaxTokens = typeof body.max_tokens === 'number'
            ? body.max_tokens
            : typeof body.maxTokens === 'number'
                ? body.maxTokens
                : 500;
        const requestedTemperature = typeof body.temperature === 'number'
            ? body.temperature
            : 0.7;
        // SECURITY FIX: Cap maxTokens at 4000 to limit cost (gpt-4o-mini is cheap)
        // Previous cap of 1000 was truncating PreparednessPlanService JSON responses
        const maxTokens = Math.max(16, Math.min(4000, Math.floor(requestedMaxTokens)));
        const temperature = Math.max(0, Math.min(1.5, requestedTemperature));
        // Streaming: when body.stream === true, forward OpenAI SSE chunks line-by-line.
        // Backward compatible — sync clients omit the flag and get a single JSON response.
        const streamRequested = body.stream === true;

        try {
            const controller = new AbortController();
            // Stream responses keep the connection open until OpenAI finishes — give them more headroom.
            const upstreamTimeoutMs = streamRequested ? 240_000 : 25_000;
            const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);

            let openAIResponse: Response;
            try {
                openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${openAIKey}`,
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        max_tokens: maxTokens,
                        temperature,
                        ...(streamRequested ? { stream: true, stream_options: { include_usage: true } } : {}),
                    }),
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!openAIResponse.ok) {
                const errorText = await openAIResponse.text();
                functions.logger.error('OpenAI upstream error', {
                    status: openAIResponse.status,
                    statusText: openAIResponse.statusText,
                    body: errorText.slice(0, 500),
                    uid,
                });
                if (streamRequested) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.write(`data: ${JSON.stringify({ error: 'OpenAI upstream error', status: openAIResponse.status })}\n\n`);
                    res.end();
                } else {
                    res.status(502).json({ error: 'OpenAI upstream error' });
                }
                return;
            }

            if (streamRequested) {
                // Forward OpenAI SSE response chunks straight to the client.
                // Client (OpenAIService.chatStream) parses `data: {...}` lines and accumulates content.
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                if (typeof (res as { flushHeaders?: () => void }).flushHeaders === 'function') {
                    (res as { flushHeaders: () => void }).flushHeaders();
                }

                const reader = openAIResponse.body?.getReader();
                if (!reader) {
                    res.write(`data: ${JSON.stringify({ error: 'No upstream body' })}\n\n`);
                    res.end();
                    return;
                }

                const decoder = new TextDecoder();
                let buffer = '';
                let promptTokens = 0;
                let completionTokens = 0;

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });

                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith(':')) continue;
                            res.write(line + '\n');
                            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                                try {
                                    const payload = JSON.parse(trimmed.slice(6));
                                    if (payload && typeof payload === 'object' && payload.usage) {
                                        promptTokens = payload.usage.prompt_tokens || promptTokens;
                                        completionTokens = payload.usage.completion_tokens || completionTokens;
                                    }
                                } catch {
                                    // Non-JSON chunk — already forwarded, ignore parsing failure
                                }
                            }
                        }
                        // Emit blank line between events to flush each SSE record promptly
                        res.write('\n');
                    }
                    // Final marker carries final usage tally so the client can record cost
                    res.write(`data: ${JSON.stringify({ afetnet_done: true, usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens } })}\n\n`);
                    res.end();
                } catch (streamErr) {
                    functions.logger.error('OpenAI stream forward error', { error: streamErr, uid });
                    try {
                        res.write(`data: ${JSON.stringify({ error: 'stream interrupted' })}\n\n`);
                    } catch { /* socket may already be closed */ }
                    res.end();
                }
                return;
            }

            const data = await openAIResponse.json() as Record<string, unknown>;
            const choices = Array.isArray(data.choices) ? data.choices : [];
            if (choices.length === 0) {
                res.status(502).json({ error: 'Invalid OpenAI response' });
                return;
            }

            const usageRaw = data.usage as Record<string, unknown> | undefined;
            const usage = {
                prompt_tokens: typeof usageRaw?.prompt_tokens === 'number' ? usageRaw.prompt_tokens : 0,
                completion_tokens: typeof usageRaw?.completion_tokens === 'number' ? usageRaw.completion_tokens : 0,
                total_tokens: typeof usageRaw?.total_tokens === 'number' ? usageRaw.total_tokens : 0,
            };

            res.status(200).json({
                id: typeof data.id === 'string' ? data.id : `proxy-${Date.now()}`,
                object: typeof data.object === 'string' ? data.object : 'chat.completion',
                created: typeof data.created === 'number' ? data.created : Math.floor(Date.now() / 1000),
                model: typeof data.model === 'string' ? data.model : model,
                choices,
                usage,
            });
        } catch (error) {
            functions.logger.error('OpenAI proxy internal error', { error, uid });
            res.status(500).json({ error: 'AI proxy request failed' });
        }
    });

// ============================================================
// CUSTOM PREMIUM EMAIL SENDER
// Sends branded AfetNet emails for verification & email change
// (Firebase blocks body customization for these templates)
// ============================================================

export const sendCustomEmail = functions
    .region(REGION)
    .https.onCall(async (data, context) => {
        // Security: Only authenticated users can send emails
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Kimlik doğrulama gereklidir.'
            );
        }

        const { type, displayName } = data;
        const uid = context.auth.uid;

        if (!type) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Geçersiz parametreler.'
            );
        }

        // Rate limiting: Max 5 emails per user per hour
        const oneHourAgo = Date.now() - 3600000;
        const recentEmails = await db
            .collection('email_logs')
            .where('uid', '==', uid)
            .where('timestamp', '>', oneHourAgo)
            .limit(6)
            .get();

        if (recentEmails.size >= 5) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Çok fazla e-posta gönderildi. Lütfen bir saat sonra tekrar deneyin.'
            );
        }

        // Get user info from Firebase Auth
        const userRecord = await admin.auth().getUser(uid);
        const email = userRecord.email;

        if (!email) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Kullanıcının e-posta adresi bulunamadı.'
            );
        }

        // Validate SMTP credentials before attempting to send
        if (!SMTP_EMAIL || !SMTP_PASSWORD) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'SMTP kimlik bilgileri yapılandırılmamış. Lütfen yöneticiyle iletişime geçin.'
            );
        }

        // Create Nodemailer transporter
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: SMTP_EMAIL,
                pass: SMTP_PASSWORD,
            },
        });

        let subject: string;
        let html: string;
        const name = displayName || userRecord.displayName || 'Kullanıcı';

        try {
            switch (type) {
                case 'verification': {
                    // Generate verification link via Admin SDK
                    const actionCodeSettings = {
                        url: 'https://afetnet-4a6b6.firebaseapp.com/__/auth/action',
                        handleCodeInApp: false,
                    };
                    const verificationLink = await admin.auth().generateEmailVerificationLink(
                        email,
                        actionCodeSettings
                    );
                    subject = 'AfetNet - E-posta Adresinizi Doğrulayın';
                    html = getVerificationEmailHTML(name, verificationLink);
                    break;
                }
                case 'emailChange': {
                    // For email change, we send notification about the change
                    // The actual change link is managed by Firebase internally
                    const newEmail = data.newEmail || email;
                    subject = 'AfetNet - E-posta Adresi Değişikliği';
                    html = getEmailChangeHTML(name, newEmail, '');
                    break;
                }
                default:
                    throw new functions.https.HttpsError(
                        'invalid-argument',
                        'Geçersiz e-posta tipi.'
                    );
            }

            await transporter.sendMail({
                from: `"AfetNet" <${SMTP_EMAIL}>`,
                replyTo: 'destek@afetnet.app',
                to: email,
                subject,
                html,
            });

            // Log the email send
            await db.collection('email_logs').add({
                uid,
                type,
                email,
                timestamp: Date.now(),
                success: true,
            });

            functions.logger.info(`📧 Premium email sent: ${type} to ${email} (uid: ${uid})`);

            return { success: true, message: 'E-posta başarıyla gönderildi.' };
        } catch (error) {
            functions.logger.error('Email send error:', error);

            // Log failed attempt
            await db.collection('email_logs').add({
                uid,
                type,
                email,
                timestamp: Date.now(),
                success: false,
                error: String(error),
            });

            throw new functions.https.HttpsError(
                'internal',
                'E-posta gönderilemedi. Lütfen tekrar deneyin.'
            );
        }
    });

// ============================================================
// REALTIME DATABASE TRIGGER - CROWDSOURCED SEISMIC REPORTS
// ============================================================

export const onSeismicReportCreated = functions
    .region(REGION)
    .database.ref('seismic_reports/{reportId}')
    .onCreate(async (snapshot, _context) => {
        const report = snapshot.val();
        functions.logger.info('📱 New seismic report received', {
            hasLocation: Boolean(report?.location),
            confidence: report?.detection?.confidence,
            platform: report?.deviceInfo?.platform,
        });

        if (!report.location || !report.detection) {
            functions.logger.warn('Invalid report format');
            return null;
        }

        const { latitude, longitude } = report.location;
        const { confidence } = report.detection;

        // Skip low confidence reports
        if (confidence < 0.5) {
            functions.logger.debug('Low confidence report, skipping');
            return null;
        }

        // Find nearby reports in last 60 seconds
        const recentReportsRef = admin.database().ref('seismic_reports');
        const sixtySecondsAgo = Date.now() - 60000;

        const nearbyReportsSnapshot = await recentReportsRef
            .orderByChild('timestamp')
            .startAt(sixtySecondsAgo)
            .limitToLast(500)
            .once('value');

        // SECURITY FIX: Deduplicate reports by userId to prevent Sybil attacks
        const reportsByUser = new Map<string, any>();
        nearbyReportsSnapshot.forEach(child => {
            const r = child.val();
            if (r.location && r.detection) {
                const dist = calculateDistance(latitude, longitude, r.location.latitude, r.location.longitude);
                if (dist <= 100) { // 100km radius
                    const userId = r.userId || 'unknown';
                    // Only keep the first report per user
                    if (!reportsByUser.has(userId)) {
                        reportsByUser.set(userId, {
                            ...r,
                            distance: dist
                        });
                    }
                }
            }
        });

        const allReports = Array.from(reportsByUser.values());
        functions.logger.info(`Found ${allReports.length} unique-user nearby reports in cluster`);

        // SECURITY FIX: Raised thresholds to prevent small-scale attacks
        const CLUSTER_THRESHOLD = 5;       // was 3
        const HIGH_CONFIDENCE_THRESHOLD = 8; // was 5

        if (allReports.length >= CLUSTER_THRESHOLD) {
            // Calculate cluster metrics
            const avgLat = allReports.reduce((sum, r) => sum + r.location.latitude, 0) / allReports.length;
            const avgLon = allReports.reduce((sum, r) => sum + r.location.longitude, 0) / allReports.length;
            const avgConfidence = allReports.reduce((sum, r) => sum + r.detection.confidence, 0) / allReports.length;
            const maxAccel = Math.max(...allReports.map(r => r.detection.peakAcceleration));

            functions.logger.warn(`🚨 CROWDSOURCED CLUSTER DETECTED: ${allReports.length} unique devices, ${(avgConfidence * 100).toFixed(1)}% confidence`);

            // Create active event in Realtime Database
            const activeEventRef = admin.database().ref('active_events').push();
            await activeEventRef.set({
                id: activeEventRef.key,
                epicenter: { latitude: avgLat, longitude: avgLon },
                reportCount: allReports.length,
                estimatedMagnitude: estimateMagnitudeFromAccel(maxAccel),
                confidence: avgConfidence,
                firstReportTime: Math.min(...allReports.map(r => r.timestamp)),
                lastUpdateTime: Date.now(),
                status: avgConfidence >= 0.8 ? 'confirmed' : 'pending', // SECURITY FIX: Raised from 0.7 to 0.8
            });

            // If high confidence and enough reports, send FCM
            if (allReports.length >= HIGH_CONFIDENCE_THRESHOLD && avgConfidence >= 0.8) { // SECURITY FIX: Raised from 0.7
                const estimatedMag = estimateMagnitudeFromAccel(maxAccel);

                if (estimatedMag >= MIN_MAGNITUDE_ALERT) {
                    const event: EEWEvent = {
                        id: `crowdsourced-rt-${Date.now()}`,
                        magnitude: estimatedMag,
                        latitude: avgLat,
                        longitude: avgLon,
                        depth: 10,
                        location: `On-Device (${allReports.length} rapor)`,
                        source: 'CROWDSOURCED',
                        timestamp: Date.now(),
                        issuedAt: Math.min(...allReports.map(r => r.timestamp)),
                    };

                    await saveEEWEvent(event);
                    await sendEEWPushWithRetry(event);

                    functions.logger.warn(`🚨 FCM SENT for crowdsourced event: M${estimatedMag.toFixed(1)}`);
                }
            }
        }

        return null;
    });

// ============================================================
// FCM TOPIC SUBSCRIPTION
// ============================================================

export const subscribeToTopics = functions
    .region(REGION)
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
        }

        const { nativeToken, topics, platform } = data;

        if (platform && platform !== 'android') {
            functions.logger.info(`Skipping FCM topic subscription for non-Android platform (${platform}); APNs/Expo tokens are covered by per-token fan-out.`);
            return { success: false, skipped: true, reason: 'platform-not-topic-capable' };
        }

        if (!nativeToken || typeof nativeToken !== 'string' || nativeToken.length < 10) {
            throw new functions.https.HttpsError('invalid-argument', 'Valid nativeToken required');
        }

        if (!Array.isArray(topics) || topics.length === 0 || topics.length > 20) {
            throw new functions.https.HttpsError('invalid-argument', 'topics must be a non-empty array (max 20)');
        }

        // Validate each topic is a non-empty string matching FCM topic format
        const TOPIC_REGEX = /^[a-zA-Z0-9\-_.~%]+$/;
        for (const topic of topics) {
            if (typeof topic !== 'string' || !TOPIC_REGEX.test(topic)) {
                throw new functions.https.HttpsError('invalid-argument', `Invalid topic name: ${topic}`);
            }
        }

        const results: { topic: string; success: boolean; error?: string }[] = [];

        for (const topic of topics) {
            try {
                await admin.messaging().subscribeToTopic(nativeToken, topic);
                results.push({ topic, success: true });
            } catch (error: any) {
                const errorMsg = error?.message || String(error);
                functions.logger.warn(`FCM topic subscribe failed: ${topic}`, { error: errorMsg, uid: context.auth.uid });
                results.push({ topic, success: false, error: errorMsg });
            }
        }

        const successCount = results.filter(r => r.success).length;
        functions.logger.info(`📡 FCM topic subscription: ${successCount}/${topics.length} topics for user ${context.auth.uid}`);

        return { success: successCount > 0, results };
    });

// ============================================================
// LOCATION HISTORY CLEANUP (Daily — 90 day retention)
// GDPR/KVKK: Purge old location history points across all users
// ============================================================

export const locationHistoryCleanup = functions
    .region(REGION)
    .pubsub.schedule('every day 02:00')
    .timeZone('Europe/Istanbul')
    .onRun(async () => {
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

        // Query old location history points across all users
        const pointsRef = db.collectionGroup('points');
        const oldPoints = await pointsRef
            .where('timestamp', '<', ninetyDaysAgo)
            .limit(500)
            .get();

        if (oldPoints.empty) {
            functions.logger.info('locationHistoryCleanup: No old points found');
            return null;
        }

        const batch = db.batch();
        oldPoints.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        functions.logger.info(`locationHistoryCleanup: Deleted ${oldPoints.size} old location points`);
        return null;
    });

// ============================================================
// SEISMIC REPORT CLEANUP (Hourly)
// ============================================================

export const cleanupSeismicReports = functions
    .region(REGION)
    .pubsub.schedule('every 1 hours')
    .onRun(async () => {
        // Delete reports older than 1 hour from Realtime Database
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        const reportsRef = admin.database().ref('seismic_reports');
        const oldReportsSnapshot = await reportsRef
            .orderByChild('timestamp')
            .endAt(oneHourAgo)
            .once('value');

        let deletedCount = 0;
        const updates: { [key: string]: null } = {};

        oldReportsSnapshot.forEach(child => {
            updates[child.key!] = null;
            deletedCount++;
        });

        if (deletedCount > 0) {
            await reportsRef.update(updates);
            functions.logger.info(`🧹 Cleaned up ${deletedCount} old seismic reports`);
        }

        // Also cleanup active_events older than 10 minutes
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        const activeEventsRef = admin.database().ref('active_events');
        const oldEventsSnapshot = await activeEventsRef
            .orderByChild('lastUpdateTime')
            .endAt(tenMinutesAgo)
            .once('value');

        const eventUpdates: { [key: string]: null } = {};
        oldEventsSnapshot.forEach(child => {
            eventUpdates[child.key!] = null;
        });

        if (Object.keys(eventUpdates).length > 0) {
            await activeEventsRef.update(eventUpdates);
            functions.logger.info(`🧹 Cleaned up ${Object.keys(eventUpdates).length} old active events`);
        }

        return null;
    });
