describe('NotificationCenter tap routing', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadNotificationCenter = (
    settingsOverrides: Record<string, unknown> = {},
    aiDecisionOverrides: Record<string, unknown> = {},
  ) => {
    const navigateTo = jest.fn();
    const scheduleNotification = jest.fn(async () => 'notif-1');
    const hybridInitialize = jest.fn(async () => undefined);
    const hybridSendMessage = jest.fn(async () => ({ id: 'reply-1' }));
    const groupSendMessage = jest.fn(async () => ({ id: 'group-reply-1' }));
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
        ...aiDecisionOverrides,
      })),
      resetAIState: jest.fn(),
      getAIStats: jest.fn(() => ({})),
    }));

    jest.doMock('../notifications/NotificationScheduler', () => ({
      scheduleNotification,
      cancelAllNotifications: jest.fn(async () => undefined),
    }));

    jest.doMock('../../stores/settingsStore', () => ({
      __esModule: true,
      useSettingsStore: {
        getState: jest.fn(() => ({
          notificationsEnabled: true,
          notificationPush: true,
          notificationSound: true,
          notificationVibration: true,
          alarmSoundEnabled: true,
          vibrationEnabled: true,
          notificationMode: 'sound+vibrate',
          notificationSoundVolume: 80,
          notificationSoundRepeat: 3,
          notificationShowPreview: true,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          quietHoursCriticalOnly: true,
          ...settingsOverrides,
        })),
      },
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
    jest.doMock('../HybridMessageService', () => ({
      hybridMessageService: {
        initialize: hybridInitialize,
        sendMessage: hybridSendMessage,
      },
    }));
    jest.doMock('../GroupChatService', () => ({
      groupChatService: {
        sendMessage: groupSendMessage,
      },
    }));

    const module = require('../notifications/NotificationCenter') as typeof import('../notifications/NotificationCenter');
    return { notificationCenter: module.notificationCenter, navigateTo, scheduleNotification, hybridInitialize, hybridSendMessage, groupSendMessage };
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

  it('hides local message notification body when preview setting is disabled', async () => {
    const { notificationCenter, scheduleNotification } = loadNotificationCenter({
      notificationShowPreview: false,
    });

    await notificationCenter.notify('message', {
      senderName: 'Ahmet',
      message: 'Gizli operasyon mesajı',
      messageId: 'msg-private-1',
      senderUid: 'uid-peer-2',
      conversationId: 'conv-direct-1',
    }, 'test');

    expect(scheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Yeni mesajı açmak için dokunun.',
        data: expect.objectContaining({
          showPreview: false,
          conversationId: 'conv-direct-1',
        }),
      }),
      expect.anything(),
    );
  });

  it('blocks non-critical notifications during quiet hours', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-14T12:00:00+03:00'));
    try {
      const { notificationCenter, scheduleNotification } = loadNotificationCenter({
        quietHoursEnabled: true,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
        quietHoursCriticalOnly: true,
      });

      const result = await notificationCenter.notify('message', {
        senderName: 'Ahmet',
        message: 'Sonra bakılabilir',
      }, 'test');

      expect(result.delivered).toBe(false);
      expect(result.reason).toBe('Quiet hours active');
      expect(scheduleNotification).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('critical-only mode blocks high-priority non-critical notifications', async () => {
    const { notificationCenter, scheduleNotification } = loadNotificationCenter(
      { notificationMode: 'critical-only' },
      { priority: 'high' },
    );

    const result = await notificationCenter.notify('message', {
      senderName: 'Ahmet',
      message: 'Yüksek ama kritik değil',
    }, 'test');

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('Critical-only mode active');
    expect(scheduleNotification).not.toHaveBeenCalled();
  });

  it('sends iOS quick replies directly instead of only opening the conversation', async () => {
    const { notificationCenter, navigateTo, hybridInitialize, hybridSendMessage } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      actionIdentifier: 'reply',
      userText: 'Tamam, yoldayım.',
      notification: {
        request: {
          content: {
            title: 'Yeni mesaj',
            data: {
              type: 'message',
              senderUid: 'uid-peer-2',
              conversationId: 'conv-direct-1',
            },
          },
        },
      },
    });

    expect(hybridInitialize).toHaveBeenCalledTimes(1);
    expect(hybridSendMessage).toHaveBeenCalledWith('Tamam, yoldayım.', 'uid-peer-2', {
      priority: 'normal',
      type: 'CHAT',
      conversationId: 'conv-direct-1',
    });
    expect(navigateTo).not.toHaveBeenCalled();
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
              summary: 'AFAD deprem duyurusu yayınlandı.',
              source: 'AFAD',
              newsUrl: 'https://example.com/haber',
              imageUrl: 'https://example.com/image.png',
              articleId: 'news-123',
              publishedAt: 1778749200000,
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('NewsDetail', {
      article: {
        title: 'Yeni Duyuru',
        summary: 'AFAD deprem duyurusu yayınlandı.',
        url: 'https://example.com/haber',
        source: 'AFAD',
        imageUrl: 'https://example.com/image.png',
        id: 'news-123',
        publishedAt: 1778749200000,
        category: 'earthquake',
      },
    });
  });

  it('opens all news instead of a blank detail screen when news tap has only an id', async () => {
    const { notificationCenter, navigateTo } = loadNotificationCenter();

    await notificationCenter.handleNotificationTap({
      notification: {
        request: {
          content: {
            title: '',
            body: '',
            data: {
              type: 'news',
              articleId: 'news-id-only',
            },
          },
        },
      },
    });

    expect(navigateTo).toHaveBeenCalledWith('AllNews');
  });
});
