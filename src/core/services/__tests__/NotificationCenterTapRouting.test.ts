describe('NotificationCenter tap routing', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadNotificationCenter = () => {
    const navigateTo = jest.fn();
    const navigationModule = {
      __esModule: true,
      navigateTo,
      getCurrentRouteName: jest.fn(() => 'Home'),
    };

    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
      Alert: { alert: jest.fn() },
      DeviceEventEmitter: { emit: jest.fn() },
    }));

    jest.doMock('../../utils/logger', () => ({
      createLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }));

    jest.doMock('../notifications/NotificationAI', () => ({
      evaluateNotification: jest.fn(() => ({
        deliver: true,
        reason: 'ok',
        priority: 'normal',
        isAftershock: false,
      })),
      resetAIState: jest.fn(),
      getAIStats: jest.fn(() => ({})),
    }));

    jest.doMock('../notifications/NotificationScheduler', () => ({
      scheduleNotification: jest.fn(async () => 'notif-1'),
      cancelAllNotifications: jest.fn(async () => undefined),
    }));

    jest.doMock('../notifications/NotificationChannelManager', () => ({
      initializeChannels: jest.fn(async () => undefined),
      getChannelForType: jest.fn(() => 'message'),
    }));

    jest.doMock('../notifications/NotificationPermissionHandler', () => ({
      getPermissionStatus: jest.fn(async () => ({ status: 'granted' })),
      getExpoPushToken: jest.fn(async () => null),
    }));

    jest.doMock('../notifications/NotificationModuleLoader', () => ({
      getNotificationsAsync: jest.fn(async () => null),
    }));

    jest.doMock('../../utils/haptics', () => ({
      impactLight: jest.fn(),
      impactMedium: jest.fn(),
      impactHeavy: jest.fn(),
      notificationError: jest.fn(),
      notificationSuccess: jest.fn(),
      notificationWarning: jest.fn(),
    }));

    jest.doMock('../../navigation/navigationRef', () => navigationModule);

    const module = require('../notifications/NotificationCenter') as typeof import('../notifications/NotificationCenter');
    return { notificationCenter: module.notificationCenter, navigateTo };
  };

  it('opens the direct conversation when a message notification is tapped', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'Yeni mesaj',
            data: {
              type: 'message',
              senderUid: 'uid-peer-2',
              senderName: 'Ahmet',
              conversationId: 'conv-direct-1',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('Conversation', {
      userId: 'uid-peer-2',
      userName: 'Ahmet',
      conversationId: 'conv-direct-1',
    });
  });

  it('opens the family group chat when a group message notification is tapped', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'Grup mesajı',
            data: {
              type: 'new_message',
              conversationId: 'grp_family_1',
              senderUid: 'uid-peer-2',
              senderName: 'Ayse',
              isGroup: true,
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('FamilyGroupChat', { groupId: 'grp_family_1' });
  });

  it('routes no-type message payloads to the correct conversation instead of dropping to the list', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'Yeni mesaj',
            data: {
              senderUid: 'uid-peer-3',
              senderName: 'Mehmet',
              conversationId: 'conv-direct-2',
              messageId: 'msg-2',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('Conversation', {
      userId: 'uid-peer-3',
      userName: 'Mehmet',
      conversationId: 'conv-direct-2',
    });
  });

  it('opens SOSHelp for SOS-family notifications', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'SOS',
            data: {
              type: 'sos_family',
              signalId: 'sig-1',
              senderUid: 'uid-sos-1',
              senderName: 'Zeynep',
              latitude: '38.423',
              longitude: '27.142',
              trapped: 'true',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('SOSHelp', {
      signalId: 'sig-1',
      senderUid: 'uid-sos-1',
      senderDeviceId: undefined,
      senderName: 'Zeynep',
      latitude: 38.423,
      longitude: 27.142,
      message: undefined,
      trapped: true,
      battery: undefined,
      healthInfo: undefined,
    });
  });

  it('opens the map focused on a family member when family location is included', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'Aile',
            data: {
              type: 'family_status_update',
              memberName: 'Ayse',
              latitude: '41.015',
              longitude: '28.979',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('DisasterMap', {
      focusOnFamily: true,
      familyLatitude: 41.015,
      familyLongitude: 28.979,
      familyMemberName: 'Ayse',
    });
  });

  it('opens earthquake detail for EEW notifications', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'EEW',
            data: {
              type: 'eew',
              eventId: 'eq-1',
              magnitude: '5.4',
              location: 'Istanbul',
              latitude: '41.0',
              longitude: '29.0',
              depth: '12',
              timestamp: '1710000000000',
              source: 'AFAD',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('EarthquakeDetail', {
      earthquake: {
        id: 'eq-1',
        magnitude: 5.4,
        location: 'Istanbul',
        latitude: 41,
        longitude: 29,
        depth: 12,
        time: 1710000000000,
        source: 'AFAD',
      },
    });
  });

  it('opens earthquake detail with id-only payloads when push lacks inline earthquake fields', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'Deprem',
            data: {
              type: 'earthquake',
              eventId: 'afad-123456',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('EarthquakeDetail', { id: 'afad-123456' });
  });

  it('opens news detail when a news notification carries article metadata', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: 'Haber',
            data: {
              type: 'news',
              title: 'Yeni Duyuru',
              source: 'AFAD',
              newsUrl: 'https://example.com/haber',
              imageUrl: 'https://example.com/image.png',
              articleId: 'news-123',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('NewsDetail', {
      article: {
        title: 'Yeni Duyuru',
        url: 'https://example.com/haber',
        source: 'AFAD',
        imageUrl: 'https://example.com/image.png',
        id: 'news-123',
      },
    });
  });
});
