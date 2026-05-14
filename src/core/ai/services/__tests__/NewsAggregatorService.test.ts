const makeResponse = (
  status: number,
  body: string,
  headers: Record<string, string> = {},
) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (key: string) => headers[key.toLowerCase()] ?? null,
  },
  text: jest.fn(async () => body),
});

describe('NewsAggregatorService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('../OpenAIService', () => ({
      openAIService: {
        isConfigured: jest.fn(() => false),
        initialize: jest.fn(async () => undefined),
        generateTextWithMetadata: jest.fn(),
      },
    }));

    jest.doMock('../../../stores/earthquakeStore', () => ({
      useEarthquakeStore: {
        getState: () => ({ items: [] }),
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses Atom news feeds such as NTV son dakika', async () => {
    const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Son dakika deprem mi oldu?</title>
          <link href="https://www.ntv.com.tr/turkiye/son-dakika-deprem-mi-oldu"/>
          <updated>2026-05-14T02:28:02+03:00</updated>
          <summary>AFAD son deprem verilerini açıkladı.</summary>
        </entry>
      </feed>`;

    global.fetch = jest.fn(async (url: unknown) => {
      const urlText = String(url);
      if (urlText === 'https://www.ntv.com.tr/son-dakika.rss') {
        return makeResponse(200, atomFeed) as any;
      }
      return makeResponse(200, '<rss><channel></channel></rss>') as any;
    }) as jest.Mock;

    const { newsAggregatorService } = require('../NewsAggregatorService') as typeof import('../NewsAggregatorService');
    const articles = await newsAggregatorService.fetchLatestNews();

    expect(articles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Son dakika deprem mi oldu?',
          source: 'NTV',
          url: 'https://www.ntv.com.tr/turkiye/son-dakika-deprem-mi-oldu',
          category: 'earthquake',
        }),
      ]),
    );
  });

  it('resolves relative redirects before parsing RSS content', async () => {
    const redirectedRss = `<?xml version="1.0" encoding="utf-8"?>
      <rss><channel>
        <item>
          <title>AFAD deprem açıklaması</title>
          <link>https://www.cnnturk.com/turkiye/afad-deprem-aciklamasi</link>
          <pubDate>Thu, 14 May 2026 12:00:00 +0300</pubDate>
          <description>AFAD, son deprem hakkında bilgi paylaştı.</description>
        </item>
      </channel></rss>`;

    global.fetch = jest.fn(async (url: unknown) => {
      const urlText = String(url);
      if (urlText === 'https://www.cnnturk.com/feed/rss/turkiye/news') {
        return makeResponse(301, '', { location: '/redirected.xml' }) as any;
      }
      if (urlText === 'https://www.cnnturk.com/redirected.xml') {
        return makeResponse(200, redirectedRss) as any;
      }
      return makeResponse(200, '<rss><channel></channel></rss>') as any;
    }) as jest.Mock;

    const { newsAggregatorService } = require('../NewsAggregatorService') as typeof import('../NewsAggregatorService');
    const articles = await newsAggregatorService.fetchLatestNews();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.cnnturk.com/redirected.xml',
      expect.any(Object),
    );
    expect(articles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'AFAD deprem açıklaması',
          source: 'CNN Türk',
          url: 'https://www.cnnturk.com/turkiye/afad-deprem-aciklamasi',
        }),
      ]),
    );
  });
});
