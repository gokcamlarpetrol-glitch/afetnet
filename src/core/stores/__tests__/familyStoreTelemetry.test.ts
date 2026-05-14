describe('familyStore telemetry freshness', () => {
  const MEMBER_UID = 'ABCDEFGHIJKLMNOPQRST';
  const ME_UID = 'ZYXWVUTSRQPONMLKJIHG';
  const FRESH_TS = 1_780_000_000_000;
  const OLD_TS = FRESH_TS - 60_000;

  const createStorage = () => {
    const store = new Map<string, string>();
    return {
      getString: (key: string) => store.get(key) ?? null,
      setString: (key: string, value: string) => {
        store.set(key, value);
      },
      delete: (key: string) => {
        store.delete(key);
      },
    };
  };

  const loadStore = () => {
    jest.resetModules();
    const directStorage = createStorage();

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
    }));
    jest.doMock('../../../lib/firebase', () => ({
      getFirebaseAuth: jest.fn(() => ({ currentUser: { uid: ME_UID } })),
    }));
    jest.doMock('../../services/IdentityService', () => ({
      identityService: {
        getUid: jest.fn(() => ME_UID),
        initialize: jest.fn(async () => undefined),
        getDisplayName: jest.fn(() => 'Test User'),
      },
    }));
    jest.doMock('../../utils/authSessionCache', () => ({
      readCachedAuthUid: jest.fn(() => ME_UID),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../familyStore').useFamilyStore;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects stale remote coordinates and battery telemetry', async () => {
    const useFamilyStore = loadStore();
    useFamilyStore.setState({
      members: [{
        uid: MEMBER_UID,
        name: 'Ayse',
        status: 'unknown',
        approvalState: 'mutual',
        lastSeen: FRESH_TS,
        latitude: 41.0082,
        longitude: 28.9784,
        location: {
          latitude: 41.0082,
          longitude: 28.9784,
          timestamp: FRESH_TS,
        },
        lastKnownLocation: {
          latitude: 41.0082,
          longitude: 28.9784,
          timestamp: FRESH_TS,
          batteryLevelAtCapture: 82,
          source: 'cloud',
        },
        batteryLevel: 82,
        batteryUpdatedAt: FRESH_TS,
      }],
      firebaseUnsubscribe: null,
      isInitialized: true,
    });

    await useFamilyStore.getState().updateMemberLocation(
      MEMBER_UID,
      40.992,
      29.124,
      'remote',
      OLD_TS,
      { batteryLevel: 12 },
    );

    const member = useFamilyStore.getState().members[0];
    expect(member.latitude).toBe(41.0082);
    expect(member.longitude).toBe(28.9784);
    expect(member.batteryLevel).toBe(82);
    expect(member.batteryUpdatedAt).toBe(FRESH_TS);
  });

  it('accepts newer remote telemetry as one atomic location snapshot', async () => {
    const useFamilyStore = loadStore();
    useFamilyStore.setState({
      members: [{
        uid: MEMBER_UID,
        name: 'Ayse',
        status: 'unknown',
        approvalState: 'mutual',
        lastSeen: OLD_TS,
        latitude: 41.0082,
        longitude: 28.9784,
        location: {
          latitude: 41.0082,
          longitude: 28.9784,
          timestamp: OLD_TS,
        },
        batteryLevel: 82,
        batteryUpdatedAt: OLD_TS,
      }],
      firebaseUnsubscribe: null,
      isInitialized: true,
    });

    await useFamilyStore.getState().updateMemberLocation(
      MEMBER_UID,
      41.01,
      28.98,
      'remote',
      FRESH_TS,
      { batteryLevel: 47 },
    );

    const member = useFamilyStore.getState().members[0];
    expect(member.latitude).toBe(41.01);
    expect(member.longitude).toBe(28.98);
    expect(member.location?.timestamp).toBe(FRESH_TS);
    expect(member.batteryLevel).toBe(47);
    expect(member.batteryUpdatedAt).toBe(FRESH_TS);
  });
});
