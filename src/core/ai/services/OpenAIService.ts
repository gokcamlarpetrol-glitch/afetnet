/**
 * OPENAI SERVICE
 * OpenAI GPT API client with secure server-side proxy first strategy.
 *
 * SECURITY MODEL:
 * - Primary: Firebase Function proxy (recommended for production)
 * - Optional fallback: direct API key from secure runtime storage (development only)
 * - Never reads EXPO_PUBLIC_OPENAI_API_KEY from app bundle
 */

import { createLogger } from '../../utils/logger';
import { costTracker, estimateCost } from '../utils/costCalculator';
import { safeIncludes } from '../../utils/safeString';
import { getErrorMessage } from '../../utils/errorUtils';
import { ENV } from '../../config/env';

const logger = createLogger('OpenAIService');

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateTextOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  serviceName?: string;
}

interface GenerateTextResult {
  text: string;
  usedFallback: boolean;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenAIService {
  private apiKey: string | null = null;
  private proxyUrls: string[] = [];
  private activeProxyUrl: string | null = null;
  private isInitialized = false;
  private lastAuthWarningAt = 0;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4o-mini';
  private readonly timeoutMs = 20000;
  private readonly authTokenWaitMs = 8000;
  private readonly authWarningThrottleMs = 10000;

  async initialize(apiKey?: string): Promise<void> {
    if (this.isInitialized) return;

    this.proxyUrls = [];
    this.activeProxyUrl = null;

    const explicitProxy = typeof ENV.OPENAI_PROXY_URL === 'string'
      ? ENV.OPENAI_PROXY_URL.trim()
      : '';
    if (explicitProxy) {
      this.proxyUrls.push(explicitProxy);
    }

    const projectIdCandidates = [
      typeof ENV.FIREBASE_PROJECT_ID === 'string' ? ENV.FIREBASE_PROJECT_ID.trim() : '',
      typeof process.env.FIREBASE_PROJECT_ID === 'string' ? process.env.FIREBASE_PROJECT_ID.trim() : '',
      typeof process.env.EXPO_PUBLIC_PROJECT_ID === 'string' ? process.env.EXPO_PUBLIC_PROJECT_ID.trim() : '',
    ];
    const projectId = projectIdCandidates.find((candidate) => candidate.length > 0) || '';
    if (projectId) {
      // Try both endpoint names for backward compatibility across deployments.
      this.proxyUrls.push(`https://europe-west1-${projectId}.cloudfunctions.net/openAIChatProxy`);
      this.proxyUrls.push(`https://europe-west1-${projectId}.cloudfunctions.net/openaiChatProxy`);
    }

    this.proxyUrls = Array.from(new Set(this.proxyUrls.filter((url) => url.length > 0)));

    if (apiKey && apiKey.trim().length > 0) {
      this.apiKey = apiKey.trim();
    }

    const allowDirectKeyFallback = __DEV__ || process.env.NODE_ENV !== 'production';

    // Optional secure fallback for internal/dev usage. Not bundle-public.
    if (!this.apiKey && allowDirectKeyFallback) {
      try {
        const { getSecureValue } = await import('../../security/SecureKeyManager');
        const secureKey = await getSecureValue('OPENAI_API_KEY');
        if (secureKey && secureKey.trim().startsWith('sk-')) {
          this.apiKey = secureKey.trim();
        }
      } catch {
        // Optional source
      }
    }

    if (!this.apiKey && allowDirectKeyFallback) {
      const privateEnvKey = process.env.OPENAI_API_KEY;
      if (privateEnvKey && privateEnvKey.trim().startsWith('sk-')) {
        this.apiKey = privateEnvKey.trim();
      }
    }

    if (this.proxyUrls.length > 0) {
      logger.info(`✅ OpenAI proxy configured (${this.proxyUrls.length} endpoint): ${this.proxyUrls[0]}`);
    }

    if (this.apiKey) {
      logger.warn('⚠️ Direct OpenAI key fallback is active. Prefer proxy-only in production.');
    }

    if (this.proxyUrls.length === 0 && !this.apiKey) {
      logger.warn('⚠️ OpenAI not configured (no proxy URL and no secure key fallback)');
      this.isInitialized = false;
      return;
    }

    this.isInitialized = true;
  }

  private warnAuthTokenUnavailable() {
    const now = Date.now();
    if (now - this.lastAuthWarningAt < this.authWarningThrottleMs) {
      return;
    }
    this.lastAuthWarningAt = now;
    logger.warn('OpenAI proxy auth token unavailable; user may be signed out or auth not hydrated yet');
  }

  private async waitForAuthStoreHydration(timeoutMs: number): Promise<void> {
    if (timeoutMs <= 0) return;

    try {
      const { useAuthStore } = await import('../../stores/authStore');
      const startedAt = Date.now();

      while (useAuthStore.getState().isLoading && Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch {
      // Optional optimization; proceed with Firebase auth fallback checks.
    }
  }

  private async getFirebaseIdToken(options: { forceRefresh?: boolean; waitForUserMs?: number } = {}): Promise<string | null> {
    const { forceRefresh = false, waitForUserMs = 0 } = options;

    if (process.env.JEST_WORKER_ID) {
      return null;
    }

    try {
      await this.waitForAuthStoreHydration(waitForUserMs);

      const [{ getAuth, onAuthStateChanged }, firebaseLib] = await Promise.all([
        import('firebase/auth'),
        import('../../../lib/firebase'),
      ]);
      const app = firebaseLib.initializeFirebase();
      if (!app) return null;
      const auth = getAuth(app);
      let user = auth.currentUser;

      if (!user && waitForUserMs > 0) {
        user = await new Promise((resolve) => {
          let unsubscribe = () => {};
          const timeout = setTimeout(() => {
            unsubscribe();
            resolve(null);
          }, waitForUserMs);

          unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            if (!nextUser) {
              return;
            }
            clearTimeout(timeout);
            unsubscribe();
            resolve(nextUser);
          });
        });
      }
      if (!user) return null;
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      logger.debug('Failed to resolve Firebase ID token for OpenAI proxy:', error);
      return null;
    }
  }

  private async postJsonWithTimeout(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async executeCompletion(
    messages: OpenAIMessage[],
    maxTokens: number,
    temperature: number,
  ): Promise<OpenAIResponse | null> {
    // ELITE: Cost guardrail — check daily spending threshold before calling API
    try {
      const { shouldSkipAPICall } = await import('../utils/costOptimizer');
      const estCost = estimateCost(
        messages.map(m => m.content).join(' '),
        undefined,
        maxTokens,
      );
      const skip = await shouldSkipAPICall('OpenAIService', estCost);
      if (skip) {
        logger.warn('💰 API call skipped: daily cost threshold exceeded');
        return null;
      }
    } catch {
      // Don't block on cost check failure
    }

    const proxyPayload = {
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    // Primary: secure backend proxy
    if (this.proxyUrls.length > 0) {
      const orderedProxyUrls = this.activeProxyUrl
        ? [this.activeProxyUrl, ...this.proxyUrls.filter((url) => url !== this.activeProxyUrl)]
        : [...this.proxyUrls];

      let idToken = await this.getFirebaseIdToken({ waitForUserMs: this.authTokenWaitMs });
      if (!idToken) {
        this.warnAuthTokenUnavailable();
      } else {
        for (const proxyUrl of orderedProxyUrls) {
          try {
            let proxyResponse = await this.postJsonWithTimeout(
              proxyUrl,
              proxyPayload,
              {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
            );

            if (proxyResponse.status === 401 || proxyResponse.status === 403) {
              const refreshedToken = await this.getFirebaseIdToken({ forceRefresh: true, waitForUserMs: 2500 });
              if (refreshedToken) {
                idToken = refreshedToken;
                proxyResponse = await this.postJsonWithTimeout(
                  proxyUrl,
                  proxyPayload,
                  {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                  },
                );
              }
            }

            if (proxyResponse.ok) {
              this.activeProxyUrl = proxyUrl;
              return await proxyResponse.json() as OpenAIResponse;
            }

            const errText = await proxyResponse.text();
            logger.warn('OpenAI proxy returned non-OK response', {
              proxyUrl,
              status: proxyResponse.status,
              body: errText.slice(0, 300),
            });

            // Try next endpoint for routing/name issues; otherwise fallback to direct key path.
            if (
              proxyResponse.status === 404
              || proxyResponse.status === 405
              || proxyResponse.status >= 500
            ) {
              continue;
            }
            break;
          } catch (error) {
            logger.warn(`OpenAI proxy request failed (${proxyUrl}), trying next endpoint/fallback:`, getErrorMessage(error));
          }
        }
      }
    }

    // Secondary: direct OpenAI call (dev/internal fallback)
    if (this.apiKey) {
      try {
        const response = await this.postJsonWithTimeout(
          this.apiUrl,
          {
            model: this.model,
            messages,
            max_tokens: maxTokens,
            temperature,
          },
          {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          logger.warn('Direct OpenAI request returned non-OK response:', {
            status: response.status,
            body: errText.slice(0, 300),
          });
          return null;
        }

        return await response.json() as OpenAIResponse;
      } catch (error) {
        logger.warn('Direct OpenAI request failed:', getErrorMessage(error));
      }
    }

    return null;
  }

  /**
   * OpenAI GPT ile metin üret
   * Fallback: servis erişilemezse güvenli yerel yanıt döner
   */
  async generateText(
    prompt: string,
    options: GenerateTextOptions = {},
  ): Promise<string> {
    const result = await this.generateTextWithMetadata(prompt, options);
    return result.text;
  }

  async generateTextWithMetadata(
    prompt: string,
    options: GenerateTextOptions = {},
  ): Promise<GenerateTextResult> {
    const { maxTokens = 500, temperature = 0.7, systemPrompt, serviceName } = options;

    if (!this.isInitialized) {
      await this.initialize();
    }

    const estimatedCost = estimateCost(prompt, systemPrompt, maxTokens);
    if (__DEV__ && estimatedCost > 0.01) {
      logger.warn(`💰 Estimated cost: $${estimatedCost.toFixed(4)} for ${serviceName || 'generateText'}`);
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      logger.warn('Invalid prompt provided to generateText');
      return { text: this.getFallbackResponse('invalid-prompt'), usedFallback: true };
    }

    const messages: OpenAIMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    } else {
      messages.push({
        role: 'system',
        content: 'Sen Türkçe konuşan, afet yönetimi odaklı bir asistansın. Yanıtların kısa, net, doğru ve uygulanabilir olsun.',
      });
    }

    messages.push({ role: 'user', content: prompt });

    try {
      const data = await this.executeCompletion(messages, maxTokens, temperature);
      if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
        return { text: this.getFallbackResponse(prompt), usedFallback: true };
      }

      const content = data.choices[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        return { text: this.getFallbackResponse(prompt), usedFallback: true };
      }

      const generatedText = content.trim();

      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const trackingServiceName = serviceName || (systemPrompt ? 'generateText' : 'generateText-default');
      await costTracker.recordCall(
        trackingServiceName,
        usage.prompt_tokens,
        usage.completion_tokens,
        this.model,
      );

      return { text: generatedText, usedFallback: false };
    } catch (error) {
      logger.warn('OpenAI generateText exception (using fallback):', getErrorMessage(error));
      return { text: this.getFallbackResponse(prompt), usedFallback: true };
    }
  }

  /**
   * Chat completion (konuşma geçmişi ile)
   */
  async chat(
    messages: OpenAIMessage[],
    options: {
      maxTokens?: number;
      temperature?: number;
    } = {},
  ): Promise<string> {
    const { maxTokens = 500, temperature = 0.7 } = options;

    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return this.getUnavailableMessage();
    }

    try {
      const data = await this.executeCompletion(messages, maxTokens, temperature);
      if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
        return this.getUnavailableMessage();
      }

      const content = data.choices[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        return this.getUnavailableMessage();
      }

      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      await costTracker.recordCall(
        'chat',
        usage.prompt_tokens,
        usage.completion_tokens,
        this.model,
      );

      return content.trim();
    } catch (error) {
      logger.warn('OpenAI chat exception (returning unavailable message):', getErrorMessage(error));
      return this.getUnavailableMessage();
    }
  }

  /**
   * Fallback response generator
   */
  private getFallbackResponse(prompt: string): string {
    if (safeIncludes(prompt, 'risk')) {
      return 'Risk analizi: Orta seviye risk. Deprem hazırlığı yapmanız önerilir. Acil durum çantası hazırlayın ve toplanma noktanızı belirleyin.';
    }

    if (safeIncludes(prompt, 'hazırlık') || safeIncludes(prompt, 'plan')) {
      return '1. Acil durum çantası hazırlayın\n2. Aile toplanma noktası belirleyin\n3. Deprem tatbikatı yapın\n4. Mobilyaları sabitleyin\n5. Acil durum numaralarını kaydedin';
    }

    if (safeIncludes(prompt, 'deprem') || safeIncludes(prompt, 'sarsıntı')) {
      return 'Deprem anında: ÇÖK-KAPAN-TUTUN. Masanın altına girin, başınızı koruyun. Sarsıntı durduktan sonra sakin bir şekilde binayı terk edin.';
    }

    return this.getUnavailableMessage();
  }

  private getUnavailableMessage(): string {
    return 'AI servisi şu anda kullanılamıyor. Lütfen temel afet yönergelerini uygulayın ve daha sonra tekrar deneyin.';
  }

  /**
   * OpenAI provider status
   */
  isConfigured(): boolean {
    return Boolean(this.proxyUrls.length > 0 || (this.apiKey && this.apiKey.length > 0));
  }
}

export const openAIService = new OpenAIService();
