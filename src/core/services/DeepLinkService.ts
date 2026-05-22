/**
 * DEEP LINK SERVICE
 *
 * AfetNet deep link şeması: `afetnet://`
 *
 * Desteklenen rotalar:
 *   - afetnet://add?uid=X&name=Y         → Aile üyesi ekle (viral loop)
 *   - afetnet://sos?id=X                  → SOS detayı
 *   - afetnet://earthquake?id=X           → Deprem detayı
 *   - afetnet://family/group?id=X         → Aile grup sohbeti
 *   - afetnet://conversation?id=X         → Bire bir mesajlaşma
 *   - afetnet://settings/notifications    → Bildirim ayarları
 *
 * Universal Links (https://afetnet.app/...) Apple Universal Links + Android App Links
 * gerektirir; o config app.config.ts associatedDomains ile yapılır. Bu servis
 * şimdilik sadece custom scheme'i dinler — Universal Links eklendiğinde aynı
 * URL parser'ı kullanabilir.
 *
 * Lifecycle:
 *   - start(): app açılışında — getInitialURL + addEventListener
 *   - stop(): logout/shutdown'da
 */

import { Linking } from 'react-native';
import { navigateTo } from '../navigation/navigationRef';
import { createLogger } from '../utils/logger';
import { getFirebaseAuth } from '../../lib/firebase';

const logger = createLogger('DeepLinkService');

const SCHEME = 'afetnet://';

interface ParsedLink {
  action: string;
  params: Record<string, string>;
}

class DeepLinkService {
  private isStarted = false;
  private subscription: { remove: () => void } | null = null;
  /** URL'ler auth gerekli olabileceğinden işlem yapılırken kuyrukta tutulur. */
  private pendingUrl: string | null = null;
  /** Ardışık aynı URL işlemeyi engelle */
  private lastProcessedUrl: string | null = null;
  private lastProcessedAt: number = 0;
  private static readonly DUPLICATE_WINDOW_MS = 2000;

  async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;
    logger.info('Deep link service starting');

    // 1) Cold start URL (app was launched by tapping a link)
    try {
      const initial = await Linking.getInitialURL();
      if (initial) {
        logger.info('Initial deep link detected', { url: initial });
        // Defer handling until navigation tree mounts (handleUrl uses navigateTo with retry)
        setTimeout(() => this.handleUrl(initial), 1500);
      }
    } catch (e) {
      logger.warn('getInitialURL failed:', e);
    }

    // 2) Foreground listener (app is open and gets a link)
    this.subscription = Linking.addEventListener('url', ({ url }) => {
      this.handleUrl(url);
    });
  }

  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;
    this.pendingUrl = null;
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    logger.info('Deep link service stopped');
  }

  /**
   * Manual trigger — useful after a deferred-action authentication.
   */
  processPending(): void {
    if (this.pendingUrl) {
      const url = this.pendingUrl;
      this.pendingUrl = null;
      this.handleUrl(url);
    }
  }

  private handleUrl(url: string): void {
    if (!url || typeof url !== 'string') return;

    // Dedup rapid duplicate firings (some OSs deliver twice)
    if (this.lastProcessedUrl === url && Date.now() - this.lastProcessedAt < DeepLinkService.DUPLICATE_WINDOW_MS) {
      logger.debug('Skipping duplicate deep link');
      return;
    }
    this.lastProcessedUrl = url;
    this.lastProcessedAt = Date.now();

    const parsed = this.parse(url);
    if (!parsed) {
      logger.warn('Unknown deep link format', { url });
      return;
    }

    logger.info('Deep link received', { action: parsed.action, paramKeys: Object.keys(parsed.params) });

    // Some actions require authentication
    const authRequired = new Set(['add', 'family/group', 'conversation', 'sos']);
    if (authRequired.has(parsed.action)) {
      const uid = getFirebaseAuth()?.currentUser?.uid;
      if (!uid) {
        logger.info('Deep link queued — auth required', { action: parsed.action });
        this.pendingUrl = url;
        return;
      }
    }

    this.dispatch(parsed);
  }

  private parse(url: string): ParsedLink | null {
    try {
      // Strip scheme
      let rest: string;
      if (url.startsWith(SCHEME)) {
        rest = url.substring(SCHEME.length);
      } else if (url.startsWith('https://afetnet.app/')) {
        rest = url.substring('https://afetnet.app/'.length);
      } else {
        return null;
      }

      // Split path + query
      const [pathRaw, queryRaw = ''] = rest.split('?');
      const action = pathRaw.replace(/\/+$/, '').toLowerCase();
      if (!action) return null;

      const params: Record<string, string> = {};
      if (queryRaw) {
        queryRaw.split('&').forEach((pair) => {
          const [k, v = ''] = pair.split('=');
          if (k) {
            try {
              params[decodeURIComponent(k)] = decodeURIComponent(v);
            } catch {
              params[k] = v;
            }
          }
        });
      }

      return { action, params };
    } catch (error) {
      logger.error('Deep link parse failed:', error);
      return null;
    }
  }

  private dispatch(parsed: ParsedLink): void {
    const { action, params } = parsed;
    switch (action) {
      case 'add':
        // Aile üyesi ekleme (viral loop)
        if (!params.uid || params.uid.length < 8) {
          logger.warn('add deep link missing uid');
          return;
        }
        navigateTo('AddFamilyMember', {
          prefilledUid: params.uid,
          prefilledName: params.name || '',
          source: 'deep_link',
        });
        break;

      case 'family/group':
        if (params.id) {
          // görev #25 madde 2: FamilyGroupChatScreen route.params.groupId okur —
          // önceki familyGroupId anahtarı eşleşmediğinden grup açılmıyordu.
          navigateTo('FamilyGroupChat', { groupId: params.id });
        } else {
          navigateTo('Family');
        }
        break;

      case 'conversation':
        if (params.id) {
          navigateTo('Conversation', { conversationId: params.id });
        }
        break;

      case 'sos':
        if (params.id) {
          navigateTo('SOSHistory', { sosId: params.id });
        } else {
          navigateTo('SOSHelp');
        }
        break;

      case 'earthquake':
        if (params.id) {
          // görev #25 madde 2: EarthquakeDetailScreen route.params.id okur —
          // önceki earthquakeId anahtarı eşleşmediğinden deprem detayı yüklenmiyordu.
          navigateTo('EarthquakeDetail', { id: params.id });
        } else {
          navigateTo('AllEarthquakes');
        }
        break;

      case 'settings/notifications':
        navigateTo('NotificationSettings');
        break;

      case 'settings/eew':
        navigateTo('EEWSettings');
        break;

      case 'assemblypoints':
      case 'assembly-points':
        navigateTo('AssemblyPoints');
        break;

      default:
        logger.warn('Unhandled deep link action', { action });
    }
  }
}

export const deepLinkService = new DeepLinkService();

/**
 * Generate a shareable deep link for inviting a family member.
 * Pattern: `afetnet://add?uid=<UID>&name=<NAME>`
 */
export function buildFamilyInviteLink(uid: string, displayName?: string): string {
  const params: string[] = [`uid=${encodeURIComponent(uid)}`];
  if (displayName) {
    params.push(`name=${encodeURIComponent(displayName)}`);
  }
  return `${SCHEME}add?${params.join('&')}`;
}

/**
 * Generate a Universal Link (https) version — preferred for SMS/WhatsApp
 * since most messengers don't open custom schemes from links.
 * Pattern: `https://afetnet.app/add?uid=X&name=Y`
 * (Requires app.config.ts associatedDomains + apple-app-site-association + assetlinks.json
 *  to be deployed at afetnet.app — without those it falls back to opening the website,
 *  which can show a "open in app" prompt.)
 */
export function buildFamilyInviteUniversalLink(uid: string, displayName?: string): string {
  const params: string[] = [`uid=${encodeURIComponent(uid)}`];
  if (displayName) {
    params.push(`name=${encodeURIComponent(displayName)}`);
  }
  return `https://afetnet.app/add?${params.join('&')}`;
}
