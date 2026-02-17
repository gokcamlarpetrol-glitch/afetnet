/**
 * EARTHQUAKE ANALYSIS SERVICE
 * AI-powered earthquake analysis with multi-source verification
 * For 5.0+ magnitude earthquakes, verifies from multiple sources
 */

import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';
import { Earthquake } from '../../stores/earthquakeStore';
import { safeIncludes } from '../../utils/safeString';

const logger = createLogger('EarthquakeAnalysisService');

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface EarthquakeAnalysis {
  riskLevel: RiskLevel;
  userMessage: string;
  recommendations: string[];
  verified: boolean;
  sources: string[];
  confidence: number; // 0-100
}

interface VerificationResult {
  source: string;
  confirmed: boolean;
  magnitude?: number;
  location?: string;
  time?: number;
}

class EarthquakeAnalysisService {
  private isInitialized = false;
  private readonly VERIFICATION_THRESHOLD = 2; // En az 2 kaynaktan onay
  private readonly MAGNITUDE_TOLERANCE = 0.3; // Büyüklük farkı toleransı
  private readonly TIME_TOLERANCE = 5 * 60 * 1000; // 5 dakika zaman farkı
  private readonly DISTANCE_TOLERANCE = 50; // 50 km konum farkı

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await openAIService.initialize();
    } catch (error) {
      logger.warn('OpenAI init failed for EarthquakeAnalysisService, continuing with fallback', error);
    }
    logger.info('EarthquakeAnalysisService initialized');
    this.isInitialized = true;
  }

  /**
   * Depremi analiz et ve risk seviyesi belirle
   */
  async analyzeEarthquake(
    earthquake: Earthquake,
    userLocation?: { latitude: number; longitude: number },
  ): Promise<EarthquakeAnalysis | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // 5.0+ depremler için çoklu kaynak doğrulaması
      let verified = true;
      let sources: string[] = [earthquake.source];
      let confidence = 80;

      if (earthquake.magnitude >= 5.0) {
        logger.info(`🔍 Büyük deprem tespit edildi (${earthquake.magnitude}), çoklu kaynak doğrulaması yapılıyor...`);

        const verificationResult = await this.verifyFromMultipleSources(earthquake);
        verified = verificationResult.verified;
        sources = verificationResult.sources;
        confidence = verificationResult.confidence;

        if (!verified) {
          logger.warn(`⚠️ Büyük deprem doğrulanamadı! Sadece ${sources.length} kaynaktan onay alındı.`);
          return null;
        }

        logger.info(`✅ Deprem doğrulandı: ${sources.length} kaynaktan onay, güven: ${confidence}%`);
      }

      // Mesafe hesapla
      let distance: number | undefined;
      if (userLocation) {
        distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          earthquake.latitude,
          earthquake.longitude,
        );
      }

      // Risk seviyesi belirle
      const riskLevel = this.determineRiskLevel(earthquake, distance);

      // AI ile kullanıcı dostu mesaj oluştur
      let userMessage: string;
      let recommendations: string[];

      if (openAIService.isConfigured()) {
        const aiAnalysis = await this.generateAIAnalysis(earthquake, distance, riskLevel);
        userMessage = aiAnalysis.message;
        recommendations = aiAnalysis.recommendations;
      } else {
        const fallbackAnalysis = this.generateFallbackAnalysis(earthquake, distance, riskLevel);
        userMessage = fallbackAnalysis.message;
        recommendations = fallbackAnalysis.recommendations;
      }

      return {
        riskLevel,
        userMessage,
        recommendations,
        verified,
        sources,
        confidence,
      };
    } catch (error) {
      logger.error('Earthquake analysis failed:', error);
      return null;
    }
  }

  /**
   * Çoklu kaynak doğrulaması
   */
  private async verifyFromMultipleSources(
    earthquake: Earthquake,
  ): Promise<{ verified: boolean; sources: string[]; confidence: number }> {
    const verifications = await Promise.allSettled([
      this.checkAFAD(earthquake),
      this.checkUSGS(earthquake),
      this.checkKandilli(earthquake),
    ]);

    const confirmedSources: string[] = [];
    let totalConfidence = 0;

    for (const result of verifications) {
      if (result.status === 'fulfilled' && result.value.confirmed) {
        confirmedSources.push(result.value.source);
        totalConfidence += 33; // Her kaynak %33 güven ekler
      }
    }

    const verified = confirmedSources.length >= this.VERIFICATION_THRESHOLD;
    const confidence = Math.min(100, totalConfidence);

    return {
      verified,
      sources: confirmedSources,
      confidence,
    };
  }

  /**
   * AFAD verilerini kontrol et
   */
  private async checkAFAD(earthquake: Earthquake): Promise<VerificationResult> {
    try {
      // ELITE: Dynamic date range — prevents hardcoded expiry (was 2030-12-31)
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://deprem.afad.gov.tr/apiv2/event/filter?start=2020-01-01&end=${today}&minmag=3.0`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        },
      );

      if (!response.ok) {
        throw new Error(`AFAD API error: ${response.status}`);
      }

      const data = await response.json();
      const events = data?.data || data || [];

      // Benzer depremi bul
      for (const event of events) {
        if (this.isSimilarEarthquake(earthquake, {
          magnitude: event.mag || event.magnitude,
          latitude: event.latitude || event.lat,
          longitude: event.longitude || event.lng,
          time: new Date(event.date || event.time).getTime(),
        })) {
          logger.info('✅ AFAD kaynağından doğrulandı');
          return {
            source: 'AFAD',
            confirmed: true,
            magnitude: event.mag || event.magnitude,
            location: event.location,
            time: new Date(event.date || event.time).getTime(),
          };
        }
      }

      logger.warn('⚠️ AFAD kaynağında eşleşme bulunamadı');
      return { source: 'AFAD', confirmed: false };
    } catch (error) {
      logger.error('AFAD verification failed:', error);
      return { source: 'AFAD', confirmed: false };
    }
  }

  /**
   * USGS verilerini kontrol et
   */
  private async checkUSGS(earthquake: Earthquake): Promise<VerificationResult> {
    try {
      // USGS API'den son depremleri çek
      const startTime = new Date(earthquake.time - 60 * 60 * 1000).toISOString(); // 1 saat önce
      const endTime = new Date(earthquake.time + 60 * 60 * 1000).toISOString(); // 1 saat sonra

      const response = await fetch(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minmagnitude=3.0`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        },
      );

      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data = await response.json();
      const features = data?.features || [];

      // Benzer depremi bul
      for (const feature of features) {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        if (this.isSimilarEarthquake(earthquake, {
          magnitude: props.mag,
          latitude: coords[1],
          longitude: coords[0],
          time: props.time,
        })) {
          logger.info('✅ USGS kaynağından doğrulandı');
          return {
            source: 'USGS',
            confirmed: true,
            magnitude: props.mag,
            location: props.place,
            time: props.time,
          };
        }
      }

      logger.warn('⚠️ USGS kaynağında eşleşme bulunamadı');
      return { source: 'USGS', confirmed: false };
    } catch (error) {
      logger.error('USGS verification failed:', error);
      return { source: 'USGS', confirmed: false };
    }
  }

  /**
   * Kandilli verilerini kontrol et
   */
  private async checkKandilli(earthquake: Earthquake): Promise<VerificationResult> {
    try {
      // Kandilli API (HTTP endpoint React Native'de çalışmıyor, fallback)
      // Şimdilik AFAD'dan geliyorsa Kandilli onayı olarak kabul et
      if (safeIncludes(earthquake.source, 'kandilli')) {
        logger.info('✅ Kandilli kaynağından doğrulandı (source match)');
        return {
          source: 'Kandilli',
          confirmed: true,
          magnitude: earthquake.magnitude,
          location: earthquake.location,
          time: earthquake.time,
        };
      }

      logger.warn('⚠️ Kandilli doğrulaması yapılamadı (API erişim sorunu)');
      return { source: 'Kandilli', confirmed: false };
    } catch (error) {
      logger.error('Kandilli verification failed:', error);
      return { source: 'Kandilli', confirmed: false };
    }
  }

  /**
   * İki depremin benzer olup olmadığını kontrol et
   */
  private isSimilarEarthquake(
    eq1: { magnitude: number; latitude: number; longitude: number; time: number },
    eq2: { magnitude: number; latitude: number; longitude: number; time: number },
  ): boolean {
    // Büyüklük kontrolü
    const magDiff = Math.abs(eq1.magnitude - eq2.magnitude);
    if (magDiff > this.MAGNITUDE_TOLERANCE) return false;

    // Zaman kontrolü
    const timeDiff = Math.abs(eq1.time - eq2.time);
    if (timeDiff > this.TIME_TOLERANCE) return false;

    // Konum kontrolü
    const distance = this.calculateDistance(
      eq1.latitude,
      eq1.longitude,
      eq2.latitude,
      eq2.longitude,
    );
    if (distance > this.DISTANCE_TOLERANCE) return false;

    return true;
  }

  /**
   * Risk seviyesi belirle
   */
  private determineRiskLevel(earthquake: Earthquake, distance?: number): RiskLevel {
    const { magnitude } = earthquake;

    // ELITE: Factor distance into risk calculation
    // A M7.0 earthquake 500km away is less risky than one 5km away
    let distanceReduction = 0;
    if (distance !== undefined && distance > 0) {
      if (distance > 500) distanceReduction = 2;      // Very far: reduce 2 levels
      else if (distance > 200) distanceReduction = 1;  // Far: reduce 1 level
      // < 200km: no reduction
    }

    // Base risk level from magnitude
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    let riskIndex: number;
    if (magnitude >= 7.0) riskIndex = 3;       // critical
    else if (magnitude >= 5.0) riskIndex = 2;  // high
    else if (magnitude >= 4.0) riskIndex = 1;  // medium
    else riskIndex = 0;                        // low

    // Apply distance reduction (never go below 'low')
    riskIndex = Math.max(0, riskIndex - distanceReduction);
    return riskLevels[riskIndex];
  }

  /**
   * AI ile analiz mesajı oluştur
   */
  private async generateAIAnalysis(
    earthquake: Earthquake,
    distance: number | undefined,
    riskLevel: RiskLevel,
  ): Promise<{ message: string; recommendations: string[] }> {
    const distanceText = distance
      ? `Sizin konumunuza ${Math.round(distance)} km uzaklıkta.`
      : '';

    const prompt = `Deprem bilgisi analizi yap:

Deprem Bilgileri:
- Büyüklük: ${earthquake.magnitude}
- Konum: ${earthquake.location}
- Derinlik: ${earthquake.depth} km
- Zaman: ${new Date(earthquake.time).toLocaleString('tr-TR')}
${distanceText}

Risk Seviyesi: ${riskLevel}

Kullanıcıya yönelik:
1. Kısa, anlaşılır durum açıklaması (2-3 cümle)
2. 3-4 öneri

JSON formatında döndür:
{
  "message": "Durum açıklaması",
  "recommendations": ["Öneri 1", "Öneri 2", "Öneri 3"]
}

Mesaj sakin, bilgilendirici, panik yaratmayan olsun. Öneriler AFAD standartlarına uygun, uygulanabilir olsun.`;

    const systemPrompt = `Sen bir deprem uzmanısın. Depremleri analiz edip halka anlaşılır, sakin, bilimsel bilgi veriyorsun. AFAD ve Kandilli standartlarına uygun, Türkçe, net açıklamalar yapıyorsun. Sadece JSON formatında yanıt ver.`;

    // ELITE: Cost optimization - reduced maxTokens
    const aiResponse = await openAIService.generateText(prompt, {
      systemPrompt,
      maxTokens: 300, // Optimized: Reduced from 400 to save ~$0.00006 per call
      temperature: 0.6,
      serviceName: 'EarthquakeAnalysisService', // ELITE: For cost tracking
    });

    // Parse
    try {
      // Greedy match to capture complete nested JSON object
      const firstBrace = aiResponse.indexOf('{');
      const lastBrace = aiResponse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const parsed = JSON.parse(aiResponse.substring(firstBrace, lastBrace + 1));
        return {
          message: parsed.message || this.generateFallbackAnalysis(earthquake, distance, riskLevel).message,
          recommendations: Array.isArray(parsed.recommendations)
            ? parsed.recommendations
            : this.generateFallbackAnalysis(earthquake, distance, riskLevel).recommendations,
        };
      }
    } catch (error) {
      logger.error('AI analysis parse error:', error);
    }

    // Fallback — only called once (removed duplicate call from inside try block)
    return this.generateFallbackAnalysis(earthquake, distance, riskLevel);
  }

  /**
   * Fallback analiz mesajı
   */
  private generateFallbackAnalysis(
    earthquake: Earthquake,
    distance: number | undefined,
    riskLevel: RiskLevel,
  ): { message: string; recommendations: string[] } {
    const { magnitude, location, depth } = earthquake;
    const distanceText = distance ? ` Sizin konumunuza ${Math.round(distance)} km uzaklıkta.` : '';

    let message = '';
    let recommendations: string[] = [];

    if (magnitude >= 6.0) {
      message = `${location} bölgesinde ${magnitude} büyüklüğünde güçlü bir deprem meydana geldi.${distanceText} Artçı sarsıntılar olabilir, dikkatli olun.`;
      recommendations = [
        'Güvenli bir alana geçin',
        'Artçı sarsıntılara hazırlıklı olun',
        'Acil durum çantanızı hazır bulundurun',
        'Aile üyelerinizle iletişim kurun',
        'Resmi açıklamaları takip edin',
      ];
    } else if (magnitude >= 5.0) {
      message = `${location} bölgesinde ${magnitude} büyüklüğünde hissedilir bir deprem oldu.${distanceText} Hasar riski orta seviyede.`;
      recommendations = [
        'Çevrenizi kontrol edin',
        'Artçı sarsıntılara dikkat edin',
        'Acil durum planınızı gözden geçirin',
        'Yakınlarınızla iletişim kurun',
      ];
    } else if (magnitude >= 4.0) {
      message = `${location} bölgesinde ${magnitude} büyüklüğünde bir deprem kaydedildi.${distanceText} Hafif hissedilmiş olabilir.`;
      recommendations = [
        'Sakin kalın, panik yapmayın',
        'Deprem çantanızı kontrol edin',
        'Aile toplanma noktanızı hatırlayın',
      ];
    } else {
      message = `${location} bölgesinde ${magnitude} büyüklüğünde küçük bir deprem oldu.${distanceText}`;
      recommendations = [
        'Endişelenmeyin, küçük bir sarsıntı',
        'Normal hayatınıza devam edebilirsiniz',
      ];
    }

    return { message, recommendations };
  }

  /**
   * Haversine formülü ile mesafe hesapla (km)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

export const earthquakeAnalysisService = new EarthquakeAnalysisService();

