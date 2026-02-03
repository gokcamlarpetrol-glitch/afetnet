/**
 * OFFLINE RESPONSE ENGINE - ELITE EDITION
 * Simulates a generative AI by constructing dynamic responses based on context and templates.
 */

import { KnowledgeArticle } from '../KnowledgeBase';
import { UserContext } from '../ContextBuilder';

export class OfflineResponseEngine {

  /**
     * Constructs a human-like response wrapping the article content.
     */
  generateResponse(article: KnowledgeArticle, context: UserContext): string {
    const header = this.generateHeader(article, context);
    const footer = this.generateFooter(article);

    return `${header}\n\n${article.content}\n\n${footer}`;
  }

  private generateHeader(article: KnowledgeArticle, context: UserContext): string {
    const timeOfDay = context.time.isNight ? 'gece' : 'gündüz';
    const isEmergency = article.category === 'first_aid' || article.category === 'earthquake';

    if (isEmergency) {
      return `⚠️ **KRİTİK BİLGİ:**\nBu durum aciliyet gerektirir. Lütfen aşağıdaki adımları sakin ama hızlı bir şekilde uygulayın.`;
    }

    // ELITE CONTEXT AWARENESS V2
    const batteryStatus = context.device.batteryLow
      ? `⚠️ Piliniz kritik seviyede (%${Math.round(context.device.batteryLevel * 100)}). Ekran parlaklığını kısın ve bu bilgiyi not alın.`
      : `🔋 Pil durumunuz iyi (%${Math.round(context.device.batteryLevel * 100)}).`;

    const lightingAdvice = context.time.isNight
      ? `🌑 Şu an gece vakti. El fenerini sadece gerekli olduğunda kullanarak pil tasarrufu yapın.`
      : `☀️ Gündüz vakti. Görünürlüğünüz yüksek, güvenli bir alana geçmek için iyi bir zaman olabilir.`;

    const templates = [
      `Sizin için çevrimdışı arşivimden **"${article.title}"** konusunu buldum.\n\n${batteryStatus}\n${lightingAdvice}\n\nİşte yapmanız gerekenler:`,
      `İnternet olmasa da bu bilgiye erişebiliriz. **${article.title}** hakkında raporda şunlar yer alıyor:\n\n💡 **Ortam Analizi:** ${timeOfDay} şartlarındasınız. Dikkatli olun.`,
      `Şu anki şartlarda (**${Math.round(context.device.batteryLevel * 100)}% pil, ${timeOfDay} vakti**) bu bilgi hayati önem taşıyor:`,
    ];

    // Pick random template
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateFooter(article: KnowledgeArticle): string {
    if (article.category === 'first_aid') {
      return `🚨 **ÖNEMLİ:** Müdahale sonrası mutlaka 112'yi aramayı deneyin veya profesyonel yardım arayın.`;
    }
    if (article.category === 'survival') {
      return `💡 **İPUCU:** Enerjinizi korumayı unutmayın. Gereksiz efor sarf etmeyin.`;
    }
    return `*AfetNet Elite Offline Modu • Sensör Destekli*`;
  }
}

export const offlineResponseEngine = new OfflineResponseEngine();
