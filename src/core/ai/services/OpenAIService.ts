/**
 * OPENAI SERVICE
 * OpenAI GPT-4 API client
 * GÜVENLIK: API key asla kod içinde saklanmaz, sadece .env dosyasından okunur
 */

import { createLogger } from '../../utils/logger';
import { costTracker, estimateCost } from '../utils/costCalculator';
import { safeIncludes } from '../../utils/safeString';
import { getErrorMessage } from '../../utils/errorUtils';

const logger = createLogger('OpenAIService');

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  private isInitialized = false;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4o-mini'; // Daha ekonomik model

  async initialize(apiKey?: string): Promise<void> {
    if (this.isInitialized) return;

    // ELITE SECURITY: API key from multiple sources with validation
    // Priority: Parameter > ENV config > EAS secrets > process.env
    // NEVER hardcode API keys in source code

    logger.info('🔧 OpenAI initialization starting...');

    const validateAndSetKey = (source: string, key: unknown): boolean => {
      if (!key) {
        logger.debug(`🔍 ${source}: undefined/null`);
        return false;
      }

      const keyStr = String(key).trim();
      const len = keyStr.length;

      logger.info(`🔍 ${source}: found (${len} chars)`);

      if (len === 0) return false;

      // ELITE VALIDATION:
      // We warn but DO NOT BLOCK keys even if they look suspicious.
      // The ultimate source of truth is the API response (401 Unauthorized).
      const looksLikeKey = keyStr.startsWith('sk-');
      const containsPlaceholder = keyStr.toLowerCase().includes('placeholder');

      if (containsPlaceholder) {
        logger.warn(`⚠️ ${source} potential issue: Key contains 'placeholder'. Attempting to use it anyway...`);
      }

      if (!looksLikeKey) {
        logger.warn(`⚠️ ${source} potential issue: Key does not start with 'sk-'. Attempting to use it anyway...`);
      }

      this.apiKey = keyStr;
      logger.info(`✅ OpenAI key accepted from ${source} (Validation relaxed)`);
      return true;
    };

    // 1. Check Parameter
    if (validateAndSetKey('Parameter', apiKey)) return this.finishInit();

    // 2. Check ENV config
    try {
      const { ENV } = await import('../../config/env');
      if (validateAndSetKey('ENV.OPENAI_API_KEY', ENV?.OPENAI_API_KEY)) return this.finishInit();
    } catch (envError) {
      logger.debug('Could not load ENV config:', envError);
    }

    // 3. Fallback: EAS secrets
    try {
      const Constants = await import('expo-constants');
      const keyFromExtra = Constants.default?.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY;
      if (validateAndSetKey('EAS Secrets', keyFromExtra)) return this.finishInit();
    } catch (error) {
      logger.debug('Could not load Expo Constants');
    }

    // 4. Final fallback: process.env
    const keyFromProcess = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (validateAndSetKey('process.env', keyFromProcess)) return this.finishInit();

    // IF WE ARE HERE, NO KEY FOUND
    this.finishInit();
  }

  private finishInit() {
    // ELITE: Validate and log status
    if (!this.apiKey || this.apiKey.trim() === '') {
      logger.warn('⚠️ OpenAI API key not found - AI features will use fallback responses');
      logger.warn('💡 Add to .env: EXPO_PUBLIC_OPENAI_API_KEY=sk-your-real-key');
      this.apiKey = null;
      this.isInitialized = false; // Allow retry later
    } else {
      const isValidFormat = this.apiKey.startsWith('sk-');
      if (!isValidFormat) {
        logger.warn('⚠️ OpenAI API key format may be invalid (expected sk- prefix)');
      }

      const maskedKey = this.apiKey.length > 11
        ? this.apiKey.substring(0, 7) + '...' + this.apiKey.substring(this.apiKey.length - 4)
        : 'sk-****';

      logger.info(`✅ OpenAI API initialized with key: ${maskedKey}`);
      this.isInitialized = true;
    }
  }

  /**
   * OpenAI GPT-4 ile metin üret
   * Fallback: API key yoksa mock response döner
   */
  async generateText(
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      serviceName?: string; // ELITE: Service name for cost tracking
    } = {},
  ): Promise<string> {
    const { maxTokens = 500, temperature = 0.7, systemPrompt, serviceName } = options;

    // ELITE: Cost estimation before API call (for optimization)
    const estimatedCost = estimateCost(prompt, systemPrompt, maxTokens);
    if (__DEV__ && estimatedCost > 0.01) { // Warn if estimated cost > $0.01
      logger.warn(`💰 Estimated cost: $${estimatedCost.toFixed(4)} for ${serviceName || 'generateText'}`);
    }

    // Mock mode: API key yoksa
    if (!this.apiKey) {
      // ELITE ROBUSTNESS: Try to auto-initialize one last time
      // This protects against race conditions or missing initialization
      if (!this.isInitialized) {
        logger.warn('⚠️ OpenAI not initialized, attempting lazy initialization...');
        await this.initialize();

        // If still no key after lazy init, then use fallback
        if (!this.apiKey) {
          logger.warn('🤖 OpenAI dev fallback aktif (Key not found after lazy init)');
          return this.getFallbackResponse(prompt);
        }
      } else {
        logger.warn('🤖 OpenAI dev fallback aktif (No API Key configured)');
        return this.getFallbackResponse(prompt);
      }
    }

    try {
      const messages: OpenAIMessage[] = [];

      // System prompt varsa ekle
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      } else {
        // ELITE: Default Turkish system prompt for AI assistant
        messages.push({
          role: 'system',
          content: 'Sen Türkçe konuşan, Gemini seviyesinde gelişmiş bir afet yönetimi asistanısın. Tüm yanıtlarını Türkçe ver. Kullanıcılara deprem hazırlığı, acil durum yönetimi ve güvenlik konularında en üst düzeyde, profesyonel ve hayat kurtarıcı tavsiyelerle yardımcı ol.',
        });
      }

      // User prompt
      messages.push({
        role: 'user',
        content: prompt,
      });

      logger.info('🚀 OpenAI API request:', {
        model: this.model,
        messagesCount: messages.length,
        maxTokens,
      });

      // CRITICAL: Validate prompt before sending
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        logger.error('❌ Invalid prompt provided to generateText');
        return this.getFallbackResponse('Invalid prompt');
      }

      // CRITICAL: Validate messages array
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        logger.error('❌ Invalid messages array');
        return this.getFallbackResponse(prompt);
      }

      // CRITICAL: Add timeout to fetch request with retry mechanism
      // ELITE: Reduced to 20s for better user experience - fallback is better than waiting
      const controller = new AbortController();
      const timeoutDuration = 20000; // 20 seconds timeout (reduced from 45s for UX)
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutDuration);

      let response: Response;
      try {
        response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`, // GÜVENLIK: Header'da gönderilir
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens: maxTokens,
            temperature,
            // ELITE: Language is controlled via system prompt, not API parameter
            // OpenAI API doesn't support 'language' parameter - removed to fix 400 error
          }),
          signal: controller.signal,
        });

        // CRITICAL: Clear timeout on success
        clearTimeout(timeoutId);
      } catch (fetchError: unknown) {
        // CRITICAL: Clear timeout on error
        clearTimeout(timeoutId);

        const errorMessage = getErrorMessage(fetchError);
        const errorName = fetchError instanceof Error ? fetchError.name : 'UnknownError';
        const isTimeout =
          errorName === 'AbortError' ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('network request failed');

        if (isTimeout) {
          // ELITE: Log timeout as warning, not error (expected in some scenarios)
          // Don't show error popup to user - gracefully fallback
          if (__DEV__) {
            logger.warn(`⚠️ OpenAI API request timeout after ${timeoutDuration}ms - using fallback response`);
          } else {
            logger.debug('OpenAI API request timeout - using fallback');
          }
          return this.getFallbackResponse(prompt);
        }

        // Network/other fetch error - log once and fallback gracefully
        if (__DEV__) {
          logger.warn('⚠️ OpenAI API network error - using fallback response', {
            error: errorMessage,
            name: errorName,
          });
        } else {
          logger.debug('OpenAI API network error - using fallback response');
        }
        return this.getFallbackResponse(prompt);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('⚠️ OpenAI API responded with non-OK status (fallbacking):', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        // Hata durumunda fallback döndür
        logger.warn('⚠️ Falling back to safe response');
        return this.getFallbackResponse(prompt);
      }

      const data: OpenAIResponse = await response.json();

      // CRITICAL: Validate API response structure
      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        logger.warn('⚠️ Invalid OpenAI API response structure, using fallback:', data);
        return this.getFallbackResponse(prompt);
      }

      const firstChoice = data.choices[0];
      if (!firstChoice || !firstChoice.message || typeof firstChoice.message.content !== 'string') {
        logger.warn('⚠️ Invalid OpenAI API response content, using fallback:', firstChoice);
        return this.getFallbackResponse(prompt);
      }

      const generatedText = firstChoice.message.content.trim();

      // CRITICAL: Validate generated text is not empty
      if (!generatedText || generatedText.length === 0) {
        logger.warn('⚠️ OpenAI returned empty text, using fallback');
        return this.getFallbackResponse(prompt);
      }

      // ELITE: Track cost for this API call
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const trackingServiceName = serviceName || (systemPrompt ? 'generateText' : 'generateText-default');
      await costTracker.recordCall(
        trackingServiceName,
        usage.prompt_tokens,
        usage.completion_tokens,
        this.model,
      );

      logger.info('✅ OpenAI API response:', {
        tokens: usage.total_tokens,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        length: generatedText.length,
      });

      return generatedText;
    } catch (error) {
      logger.warn('⚠️ OpenAI API exception (fallback response will be used):', {
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'UnknownError',
      });
      // Hata durumunda fallback döndür
      return this.getFallbackResponse(prompt);
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

    if (!this.apiKey) {
      logger.warn('🤖 OpenAI dev fallback aktif (chat)');
      return this.getUnavailableMessage();
    }

    try {
      // CRITICAL: Add timeout to chat request as well
      // ELITE: Reduced to 20s for better user experience
      const controller = new AbortController();
      const timeoutDuration = 20000; // 20 seconds timeout (reduced from 45s for UX)
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutDuration);

      let response: Response;
      try {
        response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens: maxTokens,
            temperature,
            // ELITE: Language is controlled via system prompt, not API parameter
            // OpenAI API doesn't support 'language' parameter - removed to fix 400 error
          }),
          signal: controller.signal,
        });

        // CRITICAL: Clear timeout on success
        clearTimeout(timeoutId);
      } catch (fetchError: unknown) {
        // CRITICAL: Clear timeout on error
        clearTimeout(timeoutId);

        const errorName = fetchError instanceof Error ? fetchError.name : 'UnknownError';
        const errorMessage = getErrorMessage(fetchError);
        if (errorName === 'AbortError' || errorMessage.includes('timeout')) {
          if (__DEV__) {
            logger.warn(`⚠️ OpenAI API chat timeout after ${timeoutDuration}ms`);
          }
          throw new Error('OpenAI API request timeout');
        }
        throw fetchError;
      }

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data: OpenAIResponse = await response.json();

      // CRITICAL: Validate API response structure
      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        logger.error('❌ Invalid OpenAI API response structure (chat):', data);
        throw new Error('Invalid API response structure');
      }

      const firstChoice = data.choices[0];
      if (!firstChoice || !firstChoice.message || typeof firstChoice.message.content !== 'string') {
        logger.error('❌ Invalid OpenAI API response content (chat):', firstChoice);
        throw new Error('Invalid API response content');
      }

      // ELITE: Track cost for chat API call
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      await costTracker.recordCall(
        'chat',
        usage.prompt_tokens,
        usage.completion_tokens,
        this.model,
      );

      const generatedText = firstChoice.message.content.trim();

      // CRITICAL: Validate generated text is not empty
      if (!generatedText || generatedText.length === 0) {
        logger.warn('⚠️ OpenAI returned empty text (chat), throwing error');
        throw new Error('Empty response from API');
      }

      return generatedText;
    } catch (error) {
      logger.error('OpenAI chat error:', error);
      throw error;
    }
  }

  /**
   * Mock response generator (API key olmadığında)
   */
  private getFallbackResponse(prompt: string): string {
    // Prompt'a göre bilgilendirici fallback yanıtları
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
   * API key durumunu kontrol et
   */
  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }
}

export const openAIService = new OpenAIService();

