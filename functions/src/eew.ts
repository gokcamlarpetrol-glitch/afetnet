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

const TURKEY_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const OFFICIAL_EVENT_MAX_AGE_MS = 15 * 60 * 1000;
const OFFICIAL_EVENT_MAX_FUTURE_SKEW_MS = 60 * 1000;
const EMERGENCY_NOTIFICATION_SOUND = 'emergency-alert.wav';

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

// AFAD apiv2 — start/end sorgu parametreleri UTC bekler (yanıt `date` alanı da
// UTC'dir). Canlı doğrulama (2026-05-21): start/end=05:55-06:05 UTC penceresi
// M5.6 Malatya olayını döndürdü; +3sa kaydırılmış (yerel saat) pencere boş `[]`
// döndürdü. Bu yüzden pencere UTC üretilir — saat dilimi ofseti EKLENMEZ.
function formatUtcApiDateTimeFromMs(timestamp: number): { date: string; time: string } {
    const date = new Date(timestamp);
    return {
        date: `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`,
        time: `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`,
    };
}

function parseTurkeyLocalDateTime(value: unknown): number {
    if (typeof value !== 'string') return 0;

    const raw = value.trim();
    if (!raw) return 0;

    const normalized = raw
        .replace(/\./g, '-')
        .replace(/\s+/, 'T');
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

    if (hasExplicitTimezone) {
        const parsed = Date.parse(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (!match) {
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || 0);

    if (
        month < 1 || month > 12 ||
        day < 1 || day > 31 ||
        hour < 0 || hour > 23 ||
        minute < 0 || minute > 59 ||
        second < 0 || second > 59
    ) {
        return 0;
    }

    return Date.UTC(year, month - 1, day, hour, minute, second) - TURKEY_UTC_OFFSET_MS;
}

/**
 * AFAD apiv2 olay zaman damgalarını UTC olarak ayrıştırır.
 *
 * AFAD `date` alanı saat dilimi eki OLMADAN UTC verir (örn. "2026-05-20T06:00:15";
 * bazen "2026-05-20T06:47:37.28205" gibi kesirli saniyeli). Çalışma ortamının
 * timezone'undan bağımsız UTC ayrıştırmak için ek yoksa 'Z' eklenir.
 *
 * NOT: parseTurkeyLocalDateTime YALNIZCA Kandilli (KOERI lst0.asp) içindir —
 * o kaynak Türkiye yerel saatiyle yayımlar. AFAD'a uygulanırsa issuedAt 3 saat
 * hatalı çıkar ve isFreshOfficialEvent tüm AFAD olaylarını "stale" eler.
 */
function parseAfadUtcDateTime(value: unknown): number {
    if (typeof value !== 'string') return 0;

    const raw = value.trim();
    if (!raw) return 0;

    const normalized = raw.replace(/\s+/, 'T');
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    const parsed = Date.parse(hasExplicitTimezone ? normalized : `${normalized}Z`);

    return Number.isFinite(parsed) ? parsed : 0;
}

function parseKandilliMagnitude(md: string, ml: string, mw: string): number {
    for (const rawValue of [ml, mw, md]) {
        const magnitude = Number(rawValue);
        if (Number.isFinite(magnitude) && magnitude > 0) {
            return magnitude;
        }
    }

    return 0;
}

function isValidCoordinatePair(latitude: unknown, longitude: unknown): latitude is number {
    return typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;
}

function isValidEEWEvent(event: EEWEvent): boolean {
    return Boolean(event.id) &&
        Number.isFinite(event.magnitude) &&
        event.magnitude > 0 &&
        event.magnitude <= 10 &&
        isValidCoordinatePair(event.latitude, event.longitude) &&
        Number.isFinite(event.depth) &&
        event.depth >= 0 &&
        event.depth <= 700 &&
        Number.isFinite(event.issuedAt) &&
        event.issuedAt > 0;
}

function isFreshOfficialEvent(event: EEWEvent): boolean {
    if (!isValidEEWEvent(event)) return false;

    const eventAge = Date.now() - event.issuedAt;
    return eventAge <= OFFICIAL_EVENT_MAX_AGE_MS &&
        eventAge >= -OFFICIAL_EVENT_MAX_FUTURE_SKEW_MS;
}

/**
 * görev #18: FCM push data payload'una `warningSeconds` ekle.
 *
 * SORUN: EEW push'unun `data` payload'ı `warningSeconds` içermiyordu;
 * NotificationCenter `Number(warningSeconds) || 0` okuduğu için alınan-EEW
 * geri sayımı her zaman 0sn gösteriyordu (geri sayım anlamsızdı).
 *
 * Gerçek S-dalgası varış süresi alıcının konumuna bağlıdır — sunucu bunu
 * bilemez (her alıcı için ayrı). Bu yüzden büyüklük-bazlı TUTUCU bir tahmin
 * üretiriz: büyük depremler daha uzaktan da hissedilir, dolayısıyla daha geniş
 * uyarı penceresi olur. Bu yalnızca güvenli bir varsayılan; istemci kendi
 * konumuyla daha kesin bir geri sayım hesaplarsa onu kullanır.
 *
 * Tutuculuk: olay yaşı (issuedAt → şimdi) düşülür — tespit + yayın gecikmesi
 * uyarı penceresini zaten tüketmiştir. Negatife düşerse 0 döner.
 */
function estimateWarningSeconds(event: EEWEvent): number {
    // Büyüklük-bazlı tipik uyarı penceresi (yakın-alan kullanıcı için tutucu).
    let baseWindow: number;
    if (event.magnitude >= 7.0) baseWindow = 30;
    else if (event.magnitude >= 6.0) baseWindow = 20;
    else if (event.magnitude >= 5.0) baseWindow = 12;
    else baseWindow = 8;

    // Tespit + yayın gecikmesini düş — bu süre uyarı penceresinden gitmiştir.
    const elapsedSec = Math.max(0, (Date.now() - event.issuedAt) / 1000);
    return Math.max(0, Math.round(baseWindow - elapsedSec));
}

// ============================================================
// HELPER FUNCTIONS - DATA FETCHING
// ============================================================

async function fetchAFADEvents(): Promise<EEWEvent[]> {
    const now = Date.now();
    // RELIABILITY: 15dk pencere — AFAD'ın 3-8 dk yayın gecikmesini karşılar ve
    // isFreshOfficialEvent'in 15dk eşiğiyle tutarlıdır. Önceki 5dk pencere, deprem
    // window sınırına denk geldiğinde olayı tamamen kaçırıyordu.
    const windowStart = now - 15 * 60 * 1000;

    // CRITICAL: AFAD apiv2 start/end parametrelerini UTC bekler. Önceki kod pencereyi
    // Türkiye yerel saatine (+3sa) çeviriyordu → AFAD'a 3 saat GELECEKTEKİ pencere
    // soruluyordu → her zaman boş `[]` → deprem günü AFAD=0 dönmesinin doğrudan sebebi.
    // Canlı test (2026-05-21): UTC pencere M5.6 Malatya'yı döndürdü, yerel pencere boş.
    const start = formatUtcApiDateTimeFromMs(windowStart);
    const end = formatUtcApiDateTimeFromMs(now);

    // AFAD apiv2 ISO 8601 bekler (T ayraçlı, boşluksuz).
    const url = `${AFAD_API}?start=${encodeURIComponent(`${start.date}T${start.time}`)}&end=${encodeURIComponent(`${end.date}T${end.time}`)}&minmag=3&limit=20&orderby=timedesc`;

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'AfetNet-EEW/2.0' },
            signal: AbortSignal.timeout(8000),
        });
        // CRITICAL: HTTP hata durumunda response.json() çöp/boş döndürüp hatayı
        // sessizce yutuyordu — durumu açıkça logla.
        if (!response.ok) {
            functions.logger.error(`AFAD fetch HTTP ${response.status} — url: ${url}`);
            return [];
        }
        const data = await response.json();

        if (!Array.isArray(data)) {
            functions.logger.error(`AFAD beklenmeyen yanıt tipi: ${typeof data}`);
            return [];
        }

        return data.map((item: Record<string, unknown>): EEWEvent => {
            const geojson = item.geojson as { coordinates?: unknown } | undefined;
            const coordinates = Array.isArray(geojson?.coordinates) ? geojson.coordinates : [];
            // AFAD `date` alanı UTC'dir (saat dilimi eki yok) — UTC olarak ayrıştır.
            // parseTurkeyLocalDateTime burada issuedAt'i 3 saat geçmişe kaydırırdı.
            const issuedAt = parseAfadUtcDateTime(item.eventDate || item.date || item.originTime || item.time);

            return {
                id: `afad-${String(item.eventID || item.id || issuedAt || Date.now())}`,
                magnitude: Number(item.magnitude ?? item.mag ?? 0),
                latitude: Number(item.latitude ?? item.lat ?? coordinates[1] ?? 0),
                longitude: Number(item.longitude ?? item.lon ?? item.lng ?? coordinates[0] ?? 0),
                depth: Number(item.depth ?? coordinates[2] ?? 10),
                location: String(item.location || item.region || 'Türkiye'),
                source: 'AFAD',
                timestamp: Date.now(),
                issuedAt,
            };
        }).filter(isFreshOfficialEvent);
    } catch (error) {
        functions.logger.error('AFAD fetch error:', error);
        return [];
    }
}

async function fetchKandilliEvents(): Promise<EEWEvent[]> {
    try {
        // Kandilli publishes raw HTML — we extract earthquakes via regex below.
        // NOTE: Format is fragile. If Kandilli redesigns the page (e.g. moves to
        // a JSON endpoint or changes column layout), this function returns 0 events.
        // AFAD / USGS / EMSC act as redundant sources so EEW continues to work.
        // K6: A successful HTTP fetch that produces 0 events is logged at ERROR
        // level so Cloud Monitoring can alert on sustained parser failure. Set up:
        //   Log Explorer: severity=ERROR AND textPayload:"Kandilli parser produced 0 events"
        //   → Create alerting policy: 60 occurrences in 60 minutes → email/PagerDuty.
        // RELIABILITY: 8sn timeout (HTML sayfası + yavaş akademik CGI servisi),
        // gerçekçi User-Agent (varsayılan fetch UA'sı akademik sunucuda engellenebilir)
        // ve tek retry. Production'da bu kaynak her polling'de 4sn'de timeout
        // veriyordu — redundant kaynaklar (AFAD/USGS/EMSC) birincildir, Kandilli
        // yalnızca ek doğrulama katmanıdır.
        let response: Response | null = null;
        for (let attempt = 0; attempt < 2 && !response; attempt++) {
            try {
                const r = await fetch(KANDILLI_API, {
                    headers: {
                        'Accept': 'text/html,*/*',
                        'User-Agent': 'AfetNet-EEW/2.0 (afet erken uyari; contact@afetnet.app)',
                        'Accept-Encoding': 'gzip, deflate',
                    },
                    signal: AbortSignal.timeout(8000),
                });
                if (r.ok) {
                    response = r;
                    break;
                }
                functions.logger.warn(`Kandilli fetch HTTP ${r.status} (deneme ${attempt + 1})`);
            } catch (attemptErr) {
                functions.logger.warn(`Kandilli fetch denemesi ${attempt + 1} basarisiz: ${attemptErr instanceof Error ? attemptErr.name : String(attemptErr)}`);
            }
            if (attempt === 0 && !response) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
        }
        if (!response) {
            functions.logger.warn('Kandilli erisilemedi — redundant kaynaklar (AFAD/USGS/EMSC) kullaniliyor');
            return [];
        }
        const html = await response.text();

        // Parse HTML to extract earthquake data
        const events: EEWEvent[] = [];
        const lines = html.split('\n');

        for (const line of lines) {
            try {
                const trimmed = line.trim();
                if (!/^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}/.test(trimmed)) continue;

                // Kandilli format: Date Time Lat Lon Depth MD ML Mw Location
                const rowMatch = trimmed.match(
                    /^(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(-?\d{1,2}\.\d{2,5})\s+(-?\d{1,3}\.\d{2,5})\s+(-\.-|\d+(?:\.\d+)?)\s+(-\.-|\d+(?:\.\d+)?)\s+(-\.-|\d+(?:\.\d+)?)\s+(-\.-|\d+(?:\.\d+)?)\s+(.+)$/,
                );
                const parts = trimmed.split(/\s+/);

                const dateStr = rowMatch?.[1] ?? parts[0];
                const timeStr = rowMatch?.[2] ?? parts[1];
                const lat = parseFloat(rowMatch?.[3] ?? parts[2]);
                const lon = parseFloat(rowMatch?.[4] ?? parts[3]);
                const depth = parseFloat(rowMatch?.[5] ?? parts[4]);
                const md = rowMatch?.[6] ?? parts[5];
                const ml = rowMatch?.[7] ?? parts[6];
                const mw = rowMatch?.[8] ?? parts[7];
                const mag = parseKandilliMagnitude(md, ml, mw);
                const location = (rowMatch?.[9] ?? parts.slice(8).join(' '))
                    .replace(/\s+İlksel.*$/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (isNaN(lat) || isNaN(lon) || isNaN(mag)) continue;
                if (mag < 3.0) continue; // Filter small events

                const timestamp = parseTurkeyLocalDateTime(`${dateStr} ${timeStr}`);
                const event: EEWEvent = {
                    id: `kandilli-${timestamp}-${Math.round(lat * 100)}`,
                    magnitude: mag,
                    latitude: lat,
                    longitude: lon,
                    depth: Number.isFinite(depth) ? depth : 10,
                    location: location || 'Türkiye',
                    source: 'KANDILLI',
                    timestamp: Date.now(),
                    issuedAt: timestamp,
                };

                if (!isFreshOfficialEvent(event)) continue;

                events.push(event);
                if (events.length >= 10) break;
            } catch {
                // Skip malformed lines
            }
        }

        // K2/K6: Counter-based monitoring for Kandilli HTML parser health.
        //
        // We maintain a Firestore counter at `monitoring/kandilli_health` so a
        // single quiet hour doesn't trip alerts, but a sustained format change
        // does. The counter is updated transactionally:
        //   - success path (events > 0): reset consecutiveFailures to 0
        //   - failure path (events == 0 with non-empty HTML): increment
        //
        // Alerting rules to create in Cloud Monitoring (one-time setup):
        //   1. Log-based metric "kandilli_parser_failure":
        //        resource.type=cloud_function AND
        //        jsonPayload.event_type="kandilli_parser_failure"
        //   2. Alert policy:
        //        rate > 0 over 30 min → severity=warning (page on-call later)
        //        rate > 0 over 60 min AND consecutiveFailures > 10 → page now
        //
        // Sample gcloud command (run once):
        //   gcloud alpha monitoring policies create \
        //     --notification-channels="$CHANNEL_ID" \
        //     --display-name="Kandilli EEW Parser Failure" \
        //     --condition-display-name="Sustained 0-event parses (>10 in 60min)" \
        //     --condition-filter='metric.type="logging.googleapis.com/user/kandilli_parser_failure" AND resource.type="cloud_function"' \
        //     --condition-threshold-value=10 \
        //     --condition-threshold-duration=3600s \
        //     --aggregation-alignment-period=600s \
        //     --aggregation-per-series-aligner=ALIGN_RATE
        const monitoringRef = db.collection('monitoring').doc('kandilli_health');
        const now = Date.now();
        try {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(monitoringRef);
                const prev = (doc.data() || {}) as {
                    lastSuccess?: number;
                    lastFailure?: number;
                    consecutiveFailures?: number;
                    totalSuccesses?: number;
                    totalFailures?: number;
                };
                if (events.length > 0) {
                    tx.set(monitoringRef, {
                        lastSuccess: now,
                        consecutiveFailures: 0,
                        totalSuccesses: (prev.totalSuccesses ?? 0) + 1,
                        totalFailures: prev.totalFailures ?? 0,
                        lastFailure: prev.lastFailure ?? null,
                    }, { merge: true });
                } else if (html.length > 1000) {
                    const consecutive = (prev.consecutiveFailures ?? 0) + 1;
                    tx.set(monitoringRef, {
                        lastFailure: now,
                        consecutiveFailures: consecutive,
                        totalFailures: (prev.totalFailures ?? 0) + 1,
                        totalSuccesses: prev.totalSuccesses ?? 0,
                        lastSuccess: prev.lastSuccess ?? null,
                    }, { merge: true });

                    // Severity escalates with consecutive failures:
                    //   1..9 failures  → WARNING (transient, single shot)
                    //   10+ failures   → ERROR (likely structural — HTML format change)
                    const severityIsError = consecutive >= 10;
                    if (severityIsError) {
                        functions.logger.error('kandilli_parser_failure', {
                            event_type: 'kandilli_parser_failure',
                            severity: 'ERROR',
                            consecutiveFailures: consecutive,
                            htmlLength: html.length,
                            message: `Sustained Kandilli parser failure — ${consecutive} consecutive 0-event parses. HTML format likely changed.`,
                        });
                    } else {
                        functions.logger.warn('kandilli_parser_failure', {
                            event_type: 'kandilli_parser_failure',
                            severity: 'WARNING',
                            consecutiveFailures: consecutive,
                            htmlLength: html.length,
                        });
                    }
                }
            });
        } catch (monitoringErr) {
            // Monitoring is best-effort — never let a Firestore write failure
            // block EEW event emission. Fall back to structured log only.
            functions.logger.warn('kandilli_health monitoring write failed', {
                event_type: 'kandilli_monitoring_write_failed',
                error: monitoringErr instanceof Error ? monitoringErr.message : String(monitoringErr),
            });
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
            headers: { 'Accept': 'application/json', 'User-Agent': 'AfetNet-EEW/2.0' },
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            functions.logger.error(`USGS fetch HTTP ${response.status}`);
            return [];
        }
        const data = await response.json();

        // Bozuk upstream yanıtına karşı savunma: features bir dizi değilse (null,
        // obje, string) .filter() patlardı — boş liste dön, redundant kaynaklar devreye girer.
        if (!Array.isArray(data?.features)) return [];

        return data.features
            .filter((f: any) => {
                // 2.5_hour feed tüm M2.5+ olayları içerir — yerel anlamlı depremler
                // için M4.0 alt sınırı uygula. Koordinat dizisi de doğrulanır.
                if (typeof f?.properties?.mag !== 'number' || f.properties.mag < 4.0) return false;
                const coords = f?.geometry?.coordinates;
                if (!Array.isArray(coords) || coords.length < 2) return false;
                const lon = coords[0];
                const lat = coords[1];
                return lat >= TURKEY_BOUNDS.minLat && lat <= TURKEY_BOUNDS.maxLat &&
                    lon >= TURKEY_BOUNDS.minLon && lon <= TURKEY_BOUNDS.maxLon;
            })
            .slice(0, 10)
            .map((f: any) => ({
                id: `usgs-${f.id}`,
                magnitude: f.properties.mag,
                latitude: f.geometry.coordinates[1],
                longitude: f.geometry.coordinates[0],
                // depth bozuk gelirse (eksik 3. koordinat) 10km varsayılanına düş.
                depth: typeof f.geometry.coordinates[2] === 'number' ? f.geometry.coordinates[2] : 10,
                location: f.properties.place || 'Turkey Region',
                source: 'USGS' as const,
                timestamp: Date.now(),
                // time eksik/bozuk olabilir — sayı değilse şu anki zamana düş.
                issuedAt: typeof f.properties.time === 'number' ? f.properties.time : Date.now(),
            }));
    } catch (error) {
        functions.logger.error('USGS fetch error:', error);
        return [];
    }
}

async function fetchEMSCEvents(): Promise<EEWEvent[]> {
    try {
        const response = await fetch(EMSC_API, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'AfetNet-EEW/2.0' },
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            functions.logger.error(`EMSC fetch HTTP ${response.status}`);
            return [];
        }
        const data = await response.json();

        // Bozuk upstream yanıtına karşı savunma: features bir dizi değilse (null,
        // obje, string) .filter() patlardı — boş liste dön, redundant kaynaklar devreye girer.
        if (!Array.isArray(data?.features)) return [];

        return data.features
            .filter((f: any) => {
                // properties.mag eksik/sayı değilse olayı ele — aksi halde map
                // adımı magnitude: undefined üretip downstream'de NaN'a yol açardı.
                if (typeof f?.properties?.mag !== 'number') return false;
                const coords = f?.geometry?.coordinates;
                if (!Array.isArray(coords) || coords.length < 2) return false;
                const lon = coords[0];
                const lat = coords[1];
                return lat >= TURKEY_BOUNDS.minLat && lat <= TURKEY_BOUNDS.maxLat &&
                    lon >= TURKEY_BOUNDS.minLon && lon <= TURKEY_BOUNDS.maxLon;
            })
            .slice(0, 10)
            .map((f: any) => {
                // time eksik/bozuk olabilir — geçersiz tarih NaN döner, şu ana düş.
                const parsedTime = new Date(f.properties.time).getTime();
                return {
                    id: `emsc-${f.id}`,
                    magnitude: f.properties.mag,
                    latitude: f.geometry.coordinates[1],
                    longitude: f.geometry.coordinates[0],
                    depth: f.geometry.coordinates[2] || 10,
                    location: f.properties.flynn_region || 'Turkey Region',
                    source: 'EMSC' as const,
                    timestamp: Date.now(),
                    issuedAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
                };
            });
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

    if (!isValidEEWEvent(event)) {
        functions.logger.error('Refusing to send invalid EEW event:', event);
        return { sent: 0, failed: 0 };
    }

    const isCritical = event.magnitude >= MIN_MAGNITUDE_CRITICAL;
    let criticalTopicDelivered = false;

    // ================================================================
    // PHASE 1: FCM TOPIC SEND — reserved for critical national-scale alerts.
    // Non-critical M4.0-M5.4 alerts must stay location-scoped; topic sends would
    // notify every subscriber in Turkey and bypass per-user proximity filtering.
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
            // görev #18: NotificationCenter'ın okuduğu uyarı süresi — bu alan
            // eksik olunca alınan-EEW geri sayımı her zaman 0sn gösteriyordu.
            warningSeconds: String(estimateWarningSeconds(event)),
        };

        if (isCritical) {
            // CRITICAL FIX: Use collapseKey/apns-collapse-id so that if the same user
            // receives this event via BOTH topic subscription AND per-token fan-out,
            // the OS collapses them into a single notification instead of showing two.
            const collapseKey = `eew_${event.id}`;

            const topicMessage: admin.messaging.Message = {
                topic: 'eew-turkey',
                notification: {
                    title: '🚨 ACİL DEPREM UYARISI!',
                    body: `M${event.magnitude.toFixed(1)} - ${event.location}${event.verified ? ' ✓' : ''}`,
                },
                data: eewData,
                android: {
                    priority: 'high',
                    collapseKey,
                    notification: {
                        channelId: 'eew_critical',
                        priority: 'max',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                        tag: collapseKey,
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: EMERGENCY_NOTIFICATION_SOUND,
                            badge: 1,
                            'content-available': 1,
                            'interruption-level': 'time-sensitive',
                            'relevance-score': 1.0,
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
            functions.logger.info(`✅ FCM TOPIC SEND (eew-turkey): ${topicResult}`);

            const generalTopicMessage = { ...topicMessage, topic: 'earthquake-alerts' };
            await messaging.send(generalTopicMessage);
            functions.logger.info('✅ FCM TOPIC SEND (earthquake-alerts) for critical event');
            criticalTopicDelivered = true;
        } else {
            functions.logger.info('Skipping broad EEW topic send for non-critical event; using proximity-scoped fan-out only');
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

    // Critical M5.5+ is a life-safety national alert. Topic send covers native
    // FCM subscribers, but Expo/APNs tokens cannot be assumed to be on FCM topics.
    // Send a per-token safety net to every registered Expo/native token and rely on
    // collapse keys to suppress duplicates for users who also received the topic push.
    const tokens = isCritical
        ? await getAllTokensMerged()
        : await getNearbyTokens(event.latitude, event.longitude, radiusKm, false);

    if (tokens.length === 0) {
        if (isCritical && !criticalTopicDelivered) {
            return sendToAllTokens(event);
        }

        functions.logger.warn(`No nearby push tokens for ${isCritical ? 'critical' : 'non-critical'} EEW event; broad fallback suppressed`);
        return { sent: 0, failed: 0 };
    }

    return sendToTokensWithRetry(event, tokens);
}

// ============================================================
// ELITE F4: Paginated token query — scales to 1M+ users
// ============================================================
//
// Previous code used `.limit(10000)` / `.limit(50000)` which silently
// truncated the token list at 1M users — 950k users would never receive
// the push notification. Firestore has no "fetch all" — large queries MUST
// be paginated with `startAfter()` cursors.
//
// Implementation:
//   - Pages of PAGE_SIZE (1000) documents each
//   - Hard cap of MAX_PAGES (500 = 500k tokens) to prevent runaway
//     scans on degenerate queries (corrupt index, etc.)
//   - Returns once cursor exhausted OR cap reached (with alert log)

const TOKEN_PAGE_SIZE = 1000;
const TOKEN_MAX_PAGES = 500; // 500 × 1000 = 500k tokens max per call
const LOCATION_PAGE_SIZE = 1000;
const LOCATION_MAX_PAGES = 1000; // 1M locations supported

/**
 * Paginate a Firestore query, calling `onPage` for each batch.
 * Returns total docs visited. Stops at MAX_PAGES with a warning.
 */
async function paginateQuery<T extends FirebaseFirestore.DocumentData = FirebaseFirestore.DocumentData>(
    queryRef: FirebaseFirestore.Query<T>,
    pageSize: number,
    maxPages: number,
    onPage: (docs: FirebaseFirestore.QueryDocumentSnapshot<T>[]) => void,
    label: string,
): Promise<number> {
    let totalSeen = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot<T> | null = null;
    let pages = 0;

    while (pages < maxPages) {
        let pageQuery: FirebaseFirestore.Query<T> = queryRef.limit(pageSize);
        if (lastDoc) {
            pageQuery = pageQuery.startAfter(lastDoc);
        }
        const snap = await pageQuery.get();
        if (snap.empty) break;

        onPage(snap.docs);
        totalSeen += snap.docs.length;
        pages++;
        lastDoc = snap.docs[snap.docs.length - 1];

        // Last page (fewer docs than requested) — done.
        if (snap.docs.length < pageSize) break;
    }

    if (pages >= maxPages) {
        functions.logger.error(
            `⚠️ Pagination cap reached for ${label}: hit ${maxPages} pages (~${totalSeen} docs). ` +
            `Either degenerate query or scale issue — investigate.`,
        );
    }

    return totalSeen;
}

async function getNearbyTokens(lat: number, lon: number, radiusKm: number, allowGlobalFallback: boolean): Promise<string[]> {
    const nearbyTokens: string[] = [];
    const seenTokens = new Set<string>();

    // V3: Paginate locations_current → collect nearby UIDs → batch-fetch tokens
    try {
        const nearbyUids: string[] = [];
        await paginateQuery(
            db.collection('locations_current').select('latitude', 'longitude'),
            LOCATION_PAGE_SIZE,
            LOCATION_MAX_PAGES,
            (docs) => {
                for (const locDoc of docs) {
                    const locData = locDoc.data();
                    if (isValidCoordinatePair(locData.latitude, locData.longitude)) {
                        const distance = calculateDistance(lat, lon, locData.latitude, locData.longitude);
                        if (distance <= radiusKm) {
                            nearbyUids.push(locDoc.id);
                        }
                    }
                }
            },
            'locations_current',
        );

        // Batch token retrieval (max 30 concurrent reads per batch)
        const BATCH_SIZE = 30;
        for (let i = 0; i < nearbyUids.length; i += BATCH_SIZE) {
            const batch = nearbyUids.slice(i, i + BATCH_SIZE);
            const tokenPromises = batch.map(uid =>
                db.collection('push_tokens').doc(uid).collection('devices').get(),
            );
            const tokenSnaps = await Promise.all(tokenPromises);
            for (const v3Snap of tokenSnaps) {
                for (const tDoc of v3Snap.docs) {
                    const t = tDoc.data()?.token;
                    if (t && !seenTokens.has(t)) { seenTokens.add(t); nearbyTokens.push(t); }
                }
            }
        }
        functions.logger.info(
            `🎯 V3 nearby lookup: ${nearbyUids.length} UIDs within ${radiusKm}km → ${nearbyTokens.length} tokens`,
        );
    } catch (v3Err) {
        functions.logger.warn('V3 location lookup failed (continuing with legacy):', v3Err);
    }

    // Legacy: Paginate fcm_tokens with location filter
    try {
        const v3Found = nearbyTokens.length;
        await paginateQuery(
            db.collection('fcm_tokens')
                .where('location', '!=', null)
                .select('token', 'location'),
            TOKEN_PAGE_SIZE,
            TOKEN_MAX_PAGES,
            (docs) => {
                for (const doc of docs) {
                    const data = doc.data();
                    const latitude = data.location?.latitude;
                    const longitude = data.location?.longitude;
                    if (
                        typeof data.token === 'string' &&
                        isValidCoordinatePair(latitude, longitude) &&
                        !seenTokens.has(data.token)
                    ) {
                        const distance = calculateDistance(lat, lon, latitude, longitude);
                        if (distance <= radiusKm) {
                            seenTokens.add(data.token);
                            nearbyTokens.push(data.token);
                        }
                    }
                }
            },
            'fcm_tokens (legacy)',
        );
        functions.logger.info(
            `🎯 Legacy nearby lookup added ${nearbyTokens.length - v3Found} tokens (total ${nearbyTokens.length})`,
        );
    } catch (legacyErr) {
        functions.logger.warn('Legacy fcm_tokens lookup failed:', legacyErr);
    }

    // Critical M5.5+ may broaden to ALL tokens if proximity coverage is sparse.
    // Non-critical events must never broaden beyond proximity (false-alarm risk).
    if (allowGlobalFallback && nearbyTokens.length < 10) {
        functions.logger.warn(
            `⚠️ Only ${nearbyTokens.length} nearby tokens for critical event — broadening to ALL tokens`,
        );
        const allTokens = await getAllTokensMerged();
        return allTokens;
    }

    return nearbyTokens;
}

// V3: Merge tokens from both push_tokens and fcm_tokens collections (paginated)
async function getAllTokensMerged(): Promise<string[]> {
    const allTokens: string[] = [];
    const seenTokens = new Set<string>();

    // V3: push_tokens/{uid}/devices — collectionGroup query, paginated
    try {
        await paginateQuery(
            db.collectionGroup('devices').select('token'),
            TOKEN_PAGE_SIZE,
            TOKEN_MAX_PAGES,
            (docs) => {
                for (const tDoc of docs) {
                    // Only include docs under push_tokens (not fcm_tokens/devices)
                    if (tDoc.ref.parent.parent?.parent.id === 'push_tokens') {
                        const t = tDoc.data()?.token;
                        if (t && !seenTokens.has(t)) { seenTokens.add(t); allTokens.push(t); }
                    }
                }
            },
            'push_tokens/{uid}/devices',
        );
    } catch (cgErr) {
        functions.logger.warn('collectionGroup(devices) failed (may need index):', cgErr);
    }

    // Legacy: fcm_tokens (paginated)
    try {
        await paginateQuery(
            db.collection('fcm_tokens').select('token'),
            TOKEN_PAGE_SIZE,
            TOKEN_MAX_PAGES,
            (docs) => {
                for (const d of docs) {
                    const t = d.data()?.token;
                    if (t && !seenTokens.has(t)) { seenTokens.add(t); allTokens.push(t); }
                }
            },
            'fcm_tokens',
        );
    } catch (legacyErr) {
        functions.logger.error('Legacy fcm_tokens fetch failed:', legacyErr);
    }

    functions.logger.info(`🌍 getAllTokensMerged: ${allTokens.length} unique tokens (V3 + legacy)`);
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
            sound: isCritical ? EMERGENCY_NOTIFICATION_SOUND : 'default',
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
        // görev #18: NotificationCenter'ın okuduğu uyarı süresi — bu alan
        // eksik olunca alınan-EEW geri sayımı her zaman 0sn gösteriyordu.
        warningSeconds: String(estimateWarningSeconds(event)),
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
                    sound: isCritical ? EMERGENCY_NOTIFICATION_SOUND : 'default',
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

    // Send push if confidence is high enough.
    // görev #30: İki katmanlı tasarım — CONSENSUS_THRESHOLD (3) konsensüsü TESPİT
    // eder ve eew_events + eew_consensus belgelerini yazar; ancak kullanıcıya push
    // YALNIZCA daha sıkı eşik (5 cihaz + %85 güven) sağlanınca atılır. 3-4 cihazlık
    // konsensüste belge yazılıp push atılmaması SESSİZ bir kısmi durumdu — operatör
    // "belge var ama kimse uyarılmadı" durumunu logdan göremiyordu. Artık push
    // atlanan dal açıkça loglanır (Cloud Monitoring bu olayı izleyebilir).
    if (consensus.avgConfidence >= 85 && consensus.detectionCount >= 5) {
        await sendEEWPushWithRetry(event);
    } else {
        functions.logger.warn('crowdsourced_consensus_no_push', {
            event_type: 'crowdsourced_consensus_no_push',
            reason: 'Konsensüs tespit edildi ve belgeler yazıldı, ancak push eşiği (5 cihaz + %85 güven) karşılanmadı',
            eventId: event.id,
            detectionCount: consensus.detectionCount,
            avgConfidence: Math.round(consensus.avgConfidence),
        });
    }
}

// ============================================================
// 1. FAST EEW MONITOR — Effective ~15s polling via internal stagger
// ============================================================
//
// ELITE F1: Cloud Functions v1 PubSub minimum schedule interval is 1 minute.
// To get sub-minute polling without deploying 4 separate identical functions
// (which would multiply CF count + deploy complexity), we run a SINGLE scheduled
// function every minute and execute 4 polling waves internally at t+0s, t+15s,
// t+30s, t+45s. Each wave does the full AFAD/Kandilli/USGS/EMSC fetch in
// parallel with 4-5s HTTP timeouts (see fetch* helpers), so a wave finishes
// in ~5s and we sleep until the next 15s slot.
//
// This means: effective polling latency ~15s (was 60s).
// Detection-to-push latency before: 14-108s (typical 60s + push delivery).
// Detection-to-push latency now: 4-19s (typical 15s + push delivery).
//
// Why a single CF (not 4 staggered)?
//   - PubSub schedule can't express sub-minute offsets reliably across regions.
//   - 4 CFs = 4x cold-start risk; one CF stays warm during its 1-min execution.
//   - Idempotency (Firestore transaction below) already prevents duplicate FCM.
//
// Failure mode: if a single wave throws, we log and continue with the next.
// Total CF timeout: 300s — well above 4×~10s waves with safety margin.

const POLL_WAVES_PER_MINUTE = 4; // 60s / 15s
const POLL_WAVE_INTERVAL_MS = 15_000;

async function runSinglePollWave(waveIndex: number): Promise<number> {
    let processedCount = 0;
    try {
        // Fetch from ALL sources in parallel (each with 4-5s timeout)
        const [afadEvents, kandilliEvents, usgsEvents, emscEvents] = await Promise.all([
            fetchAFADEvents(),
            fetchKandilliEvents(),
            fetchUSGSEvents(),
            fetchEMSCEvents(),
        ]);

        const allEvents = [...afadEvents, ...kandilliEvents, ...usgsEvents, ...emscEvents];
        const uniqueEvents = deduplicateEvents(allEvents);

        functions.logger.info(
            `📊 Wave ${waveIndex + 1}/${POLL_WAVES_PER_MINUTE}: AFAD=${afadEvents.length}, ` +
            `Kandilli=${kandilliEvents.length}, USGS=${usgsEvents.length}, EMSC=${emscEvents.length}`,
        );

        for (const event of uniqueEvents) {
            const verifiedEvent = verifyEvent(event, allEvents);

            if (!isFreshOfficialEvent(verifiedEvent)) {
                const eventAge = Date.now() - verifiedEvent.issuedAt;
                functions.logger.warn(
                    `⏭️ Wave ${waveIndex + 1}: skipping stale/future event M${verifiedEvent.magnitude} ` +
                    `at ${verifiedEvent.location} (age: ${Math.round(eventAge / 60000)}min)`,
                );
                continue;
            }

            // IDEMPOTENCY: Firestore transaction ensures only ONE wave (this minute or any
            // previous minute) processes a given event. Race-safe across CF instances.
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
                        detectedInWave: waveIndex + 1,
                    });
                });
            } catch (txError) {
                functions.logger.error(
                    `Wave ${waveIndex + 1}: transaction failed for event ${verifiedEvent.id}:`,
                    txError,
                );
                continue;
            }
            if (alreadyProcessed) continue;

            if (verifiedEvent.magnitude >= MIN_MAGNITUDE_ALERT) {
                await sendEEWPushWithRetry(verifiedEvent);
                processedCount++;
            }
        }
    } catch (waveError) {
        // ELITE F1: One wave failing must not block the others. Log + continue.
        functions.logger.error(`❌ Wave ${waveIndex + 1} error:`, waveError);
    }
    return processedCount;
}

// Helper: sleep with cancel safety (resolves even on timeout-near-edge).
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const eewMonitorFast = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .pubsub.schedule('every 1 minutes')
    .onRun(async () => {
        const startMs = Date.now();
        functions.logger.info(
            `🔍 EEW Monitor FAST running (4×15s waves = effective ~15s polling)...`,
        );

        let totalProcessed = 0;
        for (let i = 0; i < POLL_WAVES_PER_MINUTE; i++) {
            const waveStartMs = Date.now();
            const processed = await runSinglePollWave(i);
            totalProcessed += processed;

            // Sleep until next 15s slot — but skip sleep on the last wave (no point waiting).
            if (i < POLL_WAVES_PER_MINUTE - 1) {
                const waveElapsed = Date.now() - waveStartMs;
                const sleepDuration = Math.max(0, POLL_WAVE_INTERVAL_MS - waveElapsed);
                if (sleepDuration > 0) {
                    await sleep(sleepDuration);
                }
            }
        }

        const totalElapsedMs = Date.now() - startMs;
        functions.logger.info(
            `✅ EEW Fast Monitor done: ${totalProcessed} new events processed across ` +
            `${POLL_WAVES_PER_MINUTE} waves in ${totalElapsedMs}ms`,
        );

        return null;
    });

// ============================================================
// 2. BACKUP MONITOR (Every 1 minute) - REDUNDANCY
// görev #18: Yorum "30 saniye" diyordu ama schedule 'every 3 minutes' idi —
// kod ve yorum tutarsızdı. Yedek monitörün gerçek görevi fast monitör
// tamamen başarısız olursa kritik (M5.5+) olayları yakalamaktır; 1 dakikalık
// kadans v1 için makul bir yedek aralığıdır. Yorum + schedule hizalandı.
// ============================================================

export const eewMonitorBackup = functions
    .region(REGION)
    .pubsub.schedule('every 1 minutes')
    .onRun(async () => {
        // Fast monitör ile aynı mantık — yedeklilik: fast monitör çökerse
        // kritik olaylar yine de tespit edilir.
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

                if (!isFreshOfficialEvent(event)) {
                    const backupEventAge = Date.now() - event.issuedAt;
                    functions.logger.warn(`⏭️ Backup: skipping stale/future/invalid event M${event.magnitude} (age: ${Math.round(backupEventAge / 60000)}min)`);
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

        // görev #30: Method kontrolü API-key doğrulamasından ÖNCE yapılır. Önceki
        // sırada yanlış-anahtarlı GET → 403, doğru-anahtarlı GET → 405 dönüyordu;
        // bu fark bir oracle (saldırgan anahtar geçerliliğini method değiştirerek
        // ölçebilirdi). Method önce reddedilince GET her durumda 405 döner.
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'POST only' });
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

        // SECURITY: Hash'lenmiş timing-safe karşılaştırma. SHA-256 digest her zaman
        // 32 byte olduğundan timingSafeEqual sabit zamanda çalışır; sağlanan anahtarın
        // uzunluğu sızdırılmaz (önceki kod uzunluk farkını erken-return ile sızdırıyordu).
        if (typeof apiKey !== 'string' ||
            !crypto.timingSafeEqual(
                crypto.createHash('sha256').update(apiKey).digest(),
                crypto.createHash('sha256').update(validKey).digest())) {
            res.status(403).json({ error: 'Invalid API key' });
            return;
        }

        try {
            // görev #30: Force immediate fetch from ALL FOUR sources (EMSC dahil).
            // Önceki kod EMSC'yi atlıyordu — hızlı monitör 4 kaynağı da kullanır,
            // emergency trigger ise yalnızca 3 kaynak sorgulayıp EMSC-only bir
            // olayı (örn. Türkiye sınırındaki bir deprem) tamamen kaçırabilirdi.
            const [afadEvents, kandilliEvents, usgsEvents, emscEvents] = await Promise.all([
                fetchAFADEvents(),
                fetchKandilliEvents(),
                fetchUSGSEvents(),
                fetchEMSCEvents(),
            ]);

            const allEvents = [...afadEvents, ...kandilliEvents, ...usgsEvents, ...emscEvents];
            let sentCount = 0;

            for (const event of allEvents) {
                if (event.magnitude >= MIN_MAGNITUDE_ALERT) {
                    if (!isFreshOfficialEvent(event)) {
                        const eventAge = Date.now() - event.issuedAt;
                        functions.logger.warn(`Emergency trigger: skipping stale/future/invalid event M${event.magnitude} (age: ${Math.round(eventAge / 60000)}min)`);
                        continue;
                    }

                    // IDEMPOTENCY: Atomic transaction (same pattern as eewMonitorFast/Backup)
                    // A simple read-then-write is NOT race-safe — two concurrent HTTP triggers
                    // can both read "not exists" and both send FCM. Transaction makes it atomic.
                    const eventId = `${event.source}_${event.id || event.timestamp}`;
                    const eventToSend: EEWEvent = { ...event, id: eventId };
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
                                ...eventToSend,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        });
                    } catch (txError) {
                        functions.logger.error(`Emergency trigger transaction failed for ${eventId}:`, txError);
                        continue;
                    }
                    if (alreadyProcessed) continue;

                    await sendEEWPushWithRetry(eventToSend);
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
                    emsc: emscEvents.length,
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
            // Each unique user can only contribute one detection to consensus.
            // görev #30: deviceId fallback KALDIRILDI. userId yoksa `|| d.deviceId`
            // ile cihaz-başına anahtara düşmek Sybil korumasını bozuyordu — tek
            // saldırgan birden çok deviceId üretip konsensüsü şişirebilirdi.
            // userId yoksa tespit konsensüse hiç dahil edilmez (doğrulanmamış kimlik).
            const uniqueUserDetections = new Map<string, typeof detections[0]>();
            for (const d of detections) {
                const userId = typeof d.userId === 'string' && d.userId.length > 0
                    ? d.userId
                    : null;
                if (!userId) continue; // userId yok → konsensüs dışı
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

        // IDEMPOTENCY (görev #14): check-then-set transaction — aynı event.id
        // ikinci kez işlenirse (istemci retry / çift çağrı) tekrar push ATILMAZ.
        // Önceki kod saveEEWEvent (çıplak set) + koşulsuz push yapıyordu →
        // eşzamanlı çağrı her cihaza ÇİFT ulusal alarm. eewMonitorFast deseni.
        const eventRef = db.collection('eew_events').doc(event.id);
        let alreadyProcessed = false;
        await db.runTransaction(async (tx) => {
            const doc = await tx.get(eventRef);
            if (doc.exists) {
                alreadyProcessed = true;
                return;
            }
            tx.set(eventRef, {
                ...event,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        if (alreadyProcessed) {
            functions.logger.warn(`broadcastEEW: event ${event.id} zaten işlenmiş — çift push atlandı`);
            return { success: true, sent: 0, failed: 0, deduped: true };
        }

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

        // SECURITY: Hash'lenmiş timing-safe karşılaştırma. SHA-256 digest her zaman
        // 32 byte olduğundan timingSafeEqual sabit zamanda çalışır; sağlanan anahtarın
        // uzunluğu sızdırılmaz (önceki kod uzunluk farkını erken-return ile sızdırıyordu).
        if (typeof apiKey !== 'string' ||
            !crypto.timingSafeEqual(
                crypto.createHash('sha256').update(apiKey).digest(),
                crypto.createHash('sha256').update(validKey).digest())) {
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

            // IDEMPOTENCY (görev #14): check-then-set transaction — webhook aynı
            // event.id ile tekrar POST edilirse (kaynak retry'ı / çift kaynak)
            // tekrar push ATILMAZ. Önceki kod çıplak set + koşulsuz push yapıyordu
            // → her cihaza çift ulusal alarm riski. eewMonitorFast deseni.
            const eventRef = db.collection('eew_events').doc(event.id);
            let alreadyProcessed = false;
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(eventRef);
                if (doc.exists) {
                    alreadyProcessed = true;
                    return;
                }
                tx.set(eventRef, {
                    ...event,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });

            if (alreadyProcessed) {
                functions.logger.warn(`eewWebhook: event ${event.id} zaten işlenmiş — çift push atlandı`);
                res.json({ success: true, eventId: event.id, deduped: true });
                return;
            }

            if (event.magnitude >= MIN_MAGNITUDE_ALERT) {
                await sendEEWPushWithRetry(event);
            }

            res.json({ success: true, eventId: event.id });
        } catch (error) {
            functions.logger.error('Webhook error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });
