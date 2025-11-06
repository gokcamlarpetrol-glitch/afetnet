/**
 * OPENAI SERVICE
 * OpenAI GPT-4 API client
 * GÜVENLIK: API key asla kod içinde saklanmaz, sadece .env dosyasından okunur
 */

import { createLogger } from '../../utils/logger';

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

    // GÜVENLIK: API key sadece .env dosyasından okunur
    // ASLA kod içine yazılmaz veya GitHub'a yüklenmez
    this.apiKey = apiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY || null;

    if (!this.apiKey) {
      logger.warn('⚠️ OpenAI API key not found - running in fallback mode');
      if (__DEV__) {
        logger.warn('💡 .env dosyasına EXPO_PUBLIC_OPENAI_API_KEY ekleyin');
      }
    } else {
      // Key'in ilk ve son 4 karakterini göster (güvenlik için)
      const maskedKey = this.apiKey.substring(0, 7) + '...' + this.apiKey.substring(this.apiKey.length - 4);
      logger.info(`✅ OpenAI API initialized with key: ${maskedKey}`);
    }

    this.isInitialized = true;
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
    } = {}
  ): Promise<string> {
    const { maxTokens = 500, temperature = 0.7, systemPrompt } = options;

    // Mock mode: API key yoksa
    if (!this.apiKey) {
      logger.warn('🤖 OpenAI dev fallback aktif');
      return this.getFallbackResponse(prompt);
    }

    try {
      const messages: OpenAIMessage[] = [];
      
      // System prompt varsa ekle
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
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

      const response = await fetch(this.apiUrl, {
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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ OpenAI API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        
        // Hata durumunda fallback döndür
        logger.warn('⚠️ Falling back to safe response');
        return this.getFallbackResponse(prompt);
      }

      const data: OpenAIResponse = await response.json();
      const generatedText = data.choices[0]?.message?.content || '';

      logger.info('✅ OpenAI API response:', {
        tokens: data.usage?.total_tokens,
        length: generatedText.length,
      });

      return generatedText;
    } catch (error) {
      logger.error('❌ OpenAI API exception:', error);
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
    } = {}
  ): Promise<string> {
    const { maxTokens = 500, temperature = 0.7 } = options;

    if (!this.apiKey) {
      logger.warn('🤖 OpenAI dev fallback aktif (chat)');
      return this.getUnavailableMessage();
    }

    try {
      const response = await fetch(this.apiUrl, {
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
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data: OpenAIResponse = await response.json();
      return data.choices[0]?.message?.content || '';
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
    if (prompt.toLowerCase().includes('risk')) {
      return 'Risk analizi: Orta seviye risk. Deprem hazırlığı yapmanız önerilir. Acil durum çantası hazırlayın ve toplanma noktanızı belirleyin.';
    }
    
    if (prompt.toLowerCase().includes('hazırlık') || prompt.toLowerCase().includes('plan')) {
      return '1. Acil durum çantası hazırlayın\n2. Aile toplanma noktası belirleyin\n3. Deprem tatbikatı yapın\n4. Mobilyaları sabitleyin\n5. Acil durum numaralarını kaydedin';
    }
    
    if (prompt.toLowerCase().includes('deprem') || prompt.toLowerCase().includes('sarsıntı')) {
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

