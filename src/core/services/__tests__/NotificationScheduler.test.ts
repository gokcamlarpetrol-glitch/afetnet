describe('NotificationScheduler', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadScheduler = () => {
    const scheduleNotificationAsync = jest.fn(async ({ content }: { content: { data?: Record<string, unknown> } }) => {
      const messageId = typeof content?.data?.messageId === 'string' ? content.data.messageId : 'generic';
      return `notif-${messageId}-${scheduleNotificationAsync.mock.calls.length}`;
    });

    jest.doMock('../notifications/NotificationModuleLoader', () => ({
      getNotificationsAsync: jest.fn(async () => ({
        scheduleNotificationAsync,
      })),
    }));

    jest.doMock('../notifications/NotificationChannelManager', () => ({
      initializeChannels: jest.fn(async () => {}),
      getChannelForType: jest.fn((type: string) => `${type}-channel`),
    }));

    const scheduler = require('../notifications/NotificationScheduler') as typeof import('../notifications/NotificationScheduler');
    return { ...scheduler, scheduleNotificationAsync };
  };

  it('delivers unique message notifications without global rate limiting', async () => {
    const { scheduleNotification, scheduleNotificationAsync } = loadScheduler();

    for (let i = 1; i <= 5; i++) {
      await scheduleNotification(
        {
          title: 'Yeni mesaj',
          body: `Mesaj ${i}`,
          data: { type: 'message', messageId: `msg-${i}` },
        },
        { channelType: 'message' },
      );
    }

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(5);
  });

  it('keeps generic notifications under the global rate cap', async () => {
    const { scheduleNotification, scheduleNotificationAsync } = loadScheduler();

    for (let i = 1; i <= 4; i++) {
      await scheduleNotification(
        {
          title: `Genel bildirim ${i}`,
          body: 'Aynı zaman penceresi',
          data: { type: 'system', id: `generic-${i}` },
        },
        { channelType: 'general' },
      );
    }

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(3);
  });
});
