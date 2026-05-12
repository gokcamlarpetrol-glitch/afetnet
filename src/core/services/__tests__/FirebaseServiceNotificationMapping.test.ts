describe('FirebaseService notification mapping', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadFirebaseService = () => {
    const notify = jest.fn(async () => ({ delivered: true, reason: 'ok', priority: 'normal' }));

    jest.doMock('../../utils/logger', () => ({
      createLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }));

    jest.doMock('../notifications/NotificationCenter', () => ({
      notificationCenter: { notify },
    }));

    const module = require('../FirebaseService') as typeof import('../FirebaseService');
    return { firebaseService: module.firebaseService as any, notify };
  };

  it('maps family status pushes to family notifications with coordinates', async () => {
    const { firebaseService, notify } = loadFirebaseService();

    await firebaseService.handleFirebaseMessage({
      data: {
        type: 'family_status_update',
        senderUid: 'uid-family-1',
        senderName: 'Ayse',
        status: 'safe',
        latitude: '41.015',
        longitude: '28.979',
      },
      notification: {
        title: 'Aile durumu',
        body: 'Ayse guvende',
      },
    });

    expect(notify).toHaveBeenCalledWith('family', {
      memberName: 'Ayse',
      userId: 'uid-family-1',
      type: 'family_status_update',
      status: 'safe',
      location: {
        latitude: 41.015,
        longitude: 28.979,
      },
    }, 'FirebaseService');
  });

  it('preserves rich news payload fields for tap routing', async () => {
    const { firebaseService, notify } = loadFirebaseService();

    await firebaseService.handleFirebaseMessage({
      data: {
        type: 'news',
        source: 'AFAD',
        title: 'Duyuru',
        summary: 'Detay',
        newsUrl: 'https://example.com/haber',
        articleId: 'news-123',
        imageUrl: 'https://example.com/img.png',
      },
      notification: {
        title: 'Duyuru',
        body: 'Detay',
      },
    });

    expect(notify).toHaveBeenCalledWith('news', {
      title: 'Duyuru',
      summary: 'Detay',
      source: 'AFAD',
      url: undefined,
      newsUrl: 'https://example.com/haber',
      articleId: 'news-123',
      imageUrl: 'https://example.com/img.png',
    }, 'FirebaseService');
  });

  it('maps SOS family/proximity pushes to SOS notifications with sender and location', async () => {
    const { firebaseService, notify } = loadFirebaseService();

    await firebaseService.handleFirebaseMessage({
      data: {
        type: 'sos_family',
        senderUid: 'uid-sos-1',
        senderName: 'Mehmet',
        signalId: 'sig-123',
        message: 'Yardim edin',
        latitude: '38.423',
        longitude: '27.142',
      },
      notification: {
        title: 'SOS',
        body: 'Yardim edin',
      },
    });

    expect(notify).toHaveBeenCalledWith('sos_received', {
      from: 'Mehmet',
      senderName: 'Mehmet',
      senderId: 'uid-sos-1',
      signalId: 'sig-123',
      message: 'Yardim edin',
      timestamp: expect.any(Number),
      location: {
        latitude: 38.423,
        longitude: 27.142,
      },
    }, 'FirebaseService');
  });
});
