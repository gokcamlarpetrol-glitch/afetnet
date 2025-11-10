# Haber Kaynakları Karşılaştırma Tablosu

## AfetNet AI Entegrasyonu - Haber Sistemi

| Özellik | Google News RSS | NewsAPI.org | AFAD Deprem Verileri |
|---------|----------------|-------------|---------------------|
| **Maliyet** | Ücretsiz | Ücretsiz (100 req/day) | Ücretsiz |
| **API Key** | Gerekli değil | Gerekli | Gerekli değil |
| **Format** | XML (RSS) | JSON | JSON |
| **Dil** | Türkçe | Türkçe | Türkçe |
| **Güncellik** | Dakikalar | Dakikalar | Gerçek zamanlı |
| **Rate Limit** | Belirsiz | 100/day (free) | Yok |
| **Resmi API** | Hayır | Evet | Evet |
| **Kullanım** | ✅ Önerilen | ⚠️ Alternatif | ✅ Mevcut |

## Önerilen Hibrit Yaklaşım

### 1. Google News RSS (Ana Kaynak)
```typescript
URL: https://news.google.com/rss/search?q=deprem+türkiye&hl=tr&gl=TR&ceid=TR:tr

Avantajlar:
- Ücretsiz ve API key gerektirmez
- Basit XML parsing
- Türkçe içerik
- Güncel haberler

Parsing:
- <item> tag'lerini regex ile bul
- <title>, <link>, <pubDate>, <description> extract et
- NewsArticle formatına dönüştür
```

### 2. AFAD Deprem Verileri (Yedek Kaynak)
```typescript
Kaynak: EarthquakeService.ts (zaten mevcut)

Kullanım:
- Son 24 saatteki büyük depremleri (>= 4.0) al
- NewsArticle formatına dönüştür
- Magnitude badge ekle

Avantajlar:
- Resmi kaynak
- Gerçek zamanlı
- Zaten entegre
```

### 3. NewsAPI.org (Gelecek İçin)
```typescript
URL: https://newsapi.org/v2/everything?q=deprem&language=tr&apiKey=XXX

Not:
- Şimdilik kullanılmayacak
- Ücretsiz plan sınırlı
- İleride premium özellik olarak eklenebilir
```

## Implementasyon Detayları

### NewsAggregatorService.ts
```typescript
class NewsAggregatorService {
  // 1. Google News RSS'ten haber çek
  async fetchLatestNews(): Promise<NewsArticle[]> {
    const response = await fetch(GOOGLE_NEWS_RSS_URL);
    const xmlText = await response.text();
    return this.parseRSSFeed(xmlText);
  }

  // 2. AFAD depremlerini habere dönüştür
  async convertEarthquakesToNews(): Promise<NewsArticle[]> {
    const earthquakes = useEarthquakeStore.getState().items;
    const recentSignificant = earthquakes.filter(
      (eq) => eq.magnitude >= 4.0 && Date.now() - eq.time < 24 * 60 * 60 * 1000
    );
    return recentSignificant.map(eq => ({
      id: `eq_news_${eq.id}`,
      title: `${eq.magnitude} büyüklüğünde deprem - ${eq.location}`,
      source: eq.source,
      publishedAt: eq.time,
      magnitude: eq.magnitude,
      // ...
    }));
  }

  // 3. Her ikisini birleştir
  async getAllNews(): Promise<NewsArticle[]> {
    const [newsArticles, earthquakeNews] = await Promise.all([
      this.fetchLatestNews(),
      this.convertEarthquakesToNews(),
    ]);
    return [...earthquakeNews, ...newsArticles]
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 5); // En son 5 haber
  }
}
```

### RSS Parser (Basit)
```typescript
private parseRSSFeed(xmlText: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const matches = xmlText.matchAll(itemRegex);
  
  for (const match of matches) {
    const itemXml = match[1];
    const title = this.extractTag(itemXml, 'title');
    const link = this.extractTag(itemXml, 'link');
    const pubDate = this.extractTag(itemXml, 'pubDate');
    
    if (title && link) {
      articles.push({
        id: `news_${Date.now()}_${Math.random()}`,
        title,
        url: link,
        source: 'Google News',
        publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
        category: 'earthquake',
      });
    }
  }
  
  return articles;
}

private extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}
```

## Caching Stratejisi

### Memory Cache (10 dakika)
```typescript
private newsCache: {
  articles: NewsArticle[];
  timestamp: number;
} | null = null;

async fetchLatestNews(): Promise<NewsArticle[]> {
  // Cache kontrolü
  if (this.newsCache && Date.now() - this.newsCache.timestamp < 10 * 60 * 1000) {
    return this.newsCache.articles;
  }
  
  // Yeni veri çek
  const articles = await this.fetchFromSource();
  
  // Cache'e kaydet
  this.newsCache = {
    articles,
    timestamp: Date.now(),
  };
  
  return articles;
}
```

## Error Handling

### Fallback Stratejisi
```typescript
async fetchLatestNews(): Promise<NewsArticle[]> {
  try {
    // 1. Google News RSS dene
    return await this.fetchFromGoogleNews();
  } catch (error) {
    logger.warn('Google News failed, falling back to AFAD:', error);
    
    try {
      // 2. AFAD depremlerini kullan
      return await this.convertEarthquakesToNews();
    } catch (error2) {
      logger.error('All news sources failed:', error2);
      
      // 3. Boş liste döndür
      return [];
    }
  }
}
```

## Sonuç

**Seçilen Yaklaşım:** Google News RSS (ana) + AFAD Depremleri (yedek)

**Gerekçe:**
- ✅ Ücretsiz
- ✅ API key gerektirmez
- ✅ Basit implementasyon
- ✅ Güvenilir
- ✅ Türkçe içerik
- ✅ Fallback mekanizması var

**Gelecek İyileştirmeler:**
- NewsAPI.org premium özellik olarak eklenebilir
- AFAD resmi haber RSS'i bulunursa eklenebilir
- Kullanıcı tercihine göre kaynak seçimi

