describe('settingsStore EULA persistence hardening', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function createStorage(seed: Record<string, string> = {}) {
    const store = new Map<string, string>(Object.entries(seed));
    return {
      store,
      directStorage: {
        getString: (key: string) => store.get(key),
        setString: (key: string, value: string) => {
          store.set(key, value);
        },
        getBoolean: (key: string) => store.get(key) === 'true',
        setBoolean: (key: string, value: boolean) => {
          store.set(key, value ? 'true' : 'false');
        },
        delete: (key: string) => {
          store.delete(key);
        },
      },
      eliteStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    };
  }

  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('restores EULA acceptance from legacy fallback key', () => {
    const { directStorage, eliteStorage } = createStorage({
      AFETNET_EULA_ACCEPTED: '1',
    });

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');
    expect(useSettingsStore.getState().eulaAccepted).toBe(true);
  });

  it('honors explicit false from persisted settings over auth fallback', () => {
    const { directStorage, eliteStorage } = createStorage({
      'afetnet-settings': JSON.stringify({
        state: { eulaAccepted: false },
        version: 0,
      }),
      AFETNET_EULA_ACCEPTED: '1',
      afetnet_auth_cached: 'true',
    });

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');
    expect(useSettingsStore.getState().eulaAccepted).toBe(false);
  });

  it('mirrors setEulaAccepted to legacy key for crash-safe restores', () => {
    const { store, directStorage, eliteStorage } = createStorage();

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');
    useSettingsStore.getState().setEulaAccepted(true);
    expect(store.get('AFETNET_EULA_ACCEPTED')).toBe('1');

    useSettingsStore.getState().setEulaAccepted(false);
    expect(store.has('AFETNET_EULA_ACCEPTED')).toBe(false);
  });

  it('keeps EULA accepted when resetting settings to defaults', () => {
    const { directStorage, eliteStorage } = createStorage({
      AFETNET_EULA_ACCEPTED: '1',
    });

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');

    expect(useSettingsStore.getState().eulaAccepted).toBe(true);
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().eulaAccepted).toBe(true);
  });

  it('defaults general earthquake notifications to M5.0 and above', () => {
    const { directStorage, eliteStorage } = createStorage();

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');
    expect(useSettingsStore.getState().minMagnitudeForNotification).toBe(5.0);
  });

  it('migrates the legacy M4.0 notification default to M5.0', () => {
    const { directStorage, eliteStorage } = createStorage({
      'afetnet-settings': JSON.stringify({
        state: {
          minMagnitudeForNotification: 4.0,
        },
        version: 0,
      }),
    });

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');
    expect(useSettingsStore.getState().minMagnitudeForNotification).toBe(5.0);
    expect(useSettingsStore.getState().earthquakeNotificationDefaultMigratedToM5).toBe(true);
  });

  it('preserves non-default custom earthquake notification thresholds during migration', () => {
    const { directStorage, eliteStorage } = createStorage({
      'afetnet-settings': JSON.stringify({
        state: {
          minMagnitudeForNotification: 4.5,
        },
        version: 0,
      }),
    });

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');
    expect(useSettingsStore.getState().minMagnitudeForNotification).toBe(4.5);
    expect(useSettingsStore.getState().earthquakeNotificationDefaultMigratedToM5).toBe(true);
  });

  it('rejects invalid quiet-hour time updates', () => {
    const { directStorage, eliteStorage } = createStorage();

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');

    useSettingsStore.getState().setQuietHoursStart('21:30');
    useSettingsStore.getState().setQuietHoursStart('99:99');
    useSettingsStore.getState().setQuietHoursEnd('06:45');
    useSettingsStore.getState().setQuietHoursEnd('bad');

    expect(useSettingsStore.getState().quietHoursStart).toBe('21:30');
    expect(useSettingsStore.getState().quietHoursEnd).toBe('06:45');
  });

  it('drops invalid persisted quiet-hour values during hydration', () => {
    const { directStorage, eliteStorage } = createStorage({
      'afetnet-settings': JSON.stringify({
        state: {
          quietHoursStart: '99:99',
          quietHoursEnd: '06:45',
        },
        version: 0,
      }),
    });

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');
    expect(useSettingsStore.getState().quietHoursStart).toBe('22:00');
    expect(useSettingsStore.getState().quietHoursEnd).toBe('06:45');
  });

  it('reconciles accepted EULA after async storage fallback becomes ready', async () => {
    const seed = new Map<string, string>([
      ['AFETNET_EULA_ACCEPTED', '1'],
    ]);
    let ready = false;
    let resolveReady: (() => void) | null = null;

    const directStorage = {
      getString: (key: string) => (ready ? seed.get(key) : undefined),
      setString: (key: string, value: string) => {
        seed.set(key, value);
      },
      getBoolean: (key: string) => ready && seed.get(key) === 'true',
      setBoolean: (key: string, value: boolean) => {
        seed.set(key, value ? 'true' : 'false');
      },
      delete: (key: string) => {
        seed.delete(key);
      },
    };
    const eliteStorage = {
      getItem: (key: string) => (ready ? seed.get(key) ?? null : null),
      setItem: (key: string, value: string) => {
        seed.set(key, value);
      },
      removeItem: (key: string) => {
        seed.delete(key);
      },
    };

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => ready,
      waitForStorageReady: () => (
        ready
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
            resolveReady = () => {
              ready = true;
              resolve();
            };
          })
      ),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSettingsStore } = require('../settingsStore');

    expect(useSettingsStore.getState().eulaAccepted).toBe(false);

    resolveReady?.();
    await flushMicrotasks();

    expect(useSettingsStore.getState().eulaAccepted).toBe(true);
  });
});
