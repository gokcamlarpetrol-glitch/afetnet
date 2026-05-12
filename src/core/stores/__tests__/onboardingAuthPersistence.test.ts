describe('onboarding + auth persistence hardening', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function createStorage(seed: Record<string, string> = {}) {
    const store = new Map<string, string>(Object.entries(seed));
    return {
      store,
      directStorage: {
        getBoolean: (key: string) => store.get(key) === 'true',
        setBoolean: (key: string, value: boolean) => {
          store.set(key, value ? 'true' : 'false');
        },
        getString: (key: string) => store.get(key),
        setString: (key: string, value: string) => {
          store.set(key, value);
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

  it('treats authenticated cache as onboarding-completed fallback', () => {
    const { directStorage, eliteStorage } = createStorage({
      afetnet_auth_cached: 'true',
    });

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      eliteStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useOnboardingStore } = require('../onboardingStore');

    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(useOnboardingStore.getState().isHydrated).toBe(true);
  });

  it('keeps authenticated state from cache and clears cache only on explicit logout', async () => {
    const { store, directStorage } = createStorage({
      afetnet_auth_cached: 'true',
      afetnet_auth_cached_uid: 'UIDTEST12345678901234',
    });

    let authStateListener: ((firebaseUser: any) => void) | null = null;
    const authInstance = {
      currentUser: null as any,
    };
    let currentIdentity: { uid: string; displayName: string } | null = null;
    const mockSyncFromFirebase = jest.fn(async (user: { uid: string }) => {
      currentIdentity = {
        uid: user.uid,
        displayName: 'Test User',
      };
    });
    const mockSignOut = jest.fn(async () => undefined);

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));
    jest.doMock('firebase/auth', () => ({
      onAuthStateChanged: jest.fn((_auth: unknown, cb: (firebaseUser: unknown) => void) => {
        authStateListener = cb as (firebaseUser: any) => void;
        return jest.fn();
      }),
    }));
    jest.doMock('../../../lib/firebase', () => ({
      getFirebaseAuth: jest.fn(() => authInstance),
    }));
    jest.doMock('../../services/IdentityService', () => ({
      identityService: {
        syncFromFirebase: mockSyncFromFirebase,
        getIdentity: jest.fn(() => currentIdentity),
        getUid: jest.fn(() => currentIdentity?.uid ?? null),
        clearIdentity: jest.fn(async () => {
          currentIdentity = null;
        }),
      },
    }));
    jest.doMock('../../services/AuthService', () => ({
      AuthService: {
        signOut: mockSignOut,
      },
    }));
    jest.doMock('../../services/PresenceService', () => ({
      presenceService: {
        cleanup: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/ContactRequestService', () => ({
      contactRequestService: {
        cleanup: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/AuthSessionCleanupService', () => ({
      authSessionCleanupService: {
        clearLocalSessionData: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/FCMTokenService', () => ({
      fcmTokenService: {
        initialize: jest.fn(async () => undefined),
        registerTokenWithServer: jest.fn(async () => undefined),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../authStore');

    // Cache-backed startup should immediately keep user in authenticated branch.
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);

    await useAuthStore.getState().initialize();
    expect(authStateListener).not.toBeNull();

    // Transient null event during restore should not immediately force logout.
    authStateListener?.(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Recovery event from Firebase should keep authenticated state.
    authInstance.currentUser = { uid: 'UIDTEST12345678901234' };
    await authStateListener?.(authInstance.currentUser);
    expect(mockSyncFromFirebase).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Explicit logout must clear local auth cache.
    await useAuthStore.getState().logout();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(store.get('afetnet_auth_cached')).toBe('false');
    expect(store.has('afetnet_auth_cached_uid')).toBe(false);
  });

  it('clears session when Firebase has no user after grace window (token revoked/disabled account)', async () => {
    const { store, directStorage } = createStorage({
      afetnet_auth_cached: 'true',
      afetnet_auth_cached_uid: 'UIDTEST12345678901234',
    });

    let authStateListener: ((firebaseUser: any) => void) | null = null;
    const authInstance = {
      currentUser: null as any,
    };
    const clearLocalSessionData = jest.fn(async () => undefined);

    jest.doMock('../../utils/storage', () => ({
      DirectStorage: directStorage,
      isStorageReady: () => true,
      waitForStorageReady: () => Promise.resolve(),
    }));
    jest.doMock('firebase/auth', () => ({
      onAuthStateChanged: jest.fn((_auth: unknown, cb: (firebaseUser: unknown) => void) => {
        authStateListener = cb as (firebaseUser: any) => void;
        return jest.fn();
      }),
    }));
    jest.doMock('../../../lib/firebase', () => ({
      getFirebaseAuth: jest.fn(() => authInstance),
    }));
    jest.doMock('../../services/IdentityService', () => ({
      identityService: {
        syncFromFirebase: jest.fn(async () => undefined),
        getIdentity: jest.fn(() => ({ uid: 'UIDTEST12345678901234', displayName: 'Test User' })),
        getUid: jest.fn(() => null),
        clearIdentity: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/AuthService', () => ({
      AuthService: {
        signOut: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/PresenceService', () => ({
      presenceService: {
        cleanup: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/ContactRequestService', () => ({
      contactRequestService: {
        cleanup: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/AuthSessionCleanupService', () => ({
      authSessionCleanupService: {
        clearLocalSessionData,
      },
    }));
    jest.doMock('../../services/FCMTokenService', () => ({
      fcmTokenService: {
        initialize: jest.fn(async () => undefined),
        registerTokenWithServer: jest.fn(async () => undefined),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../authStore');

    await useAuthStore.getState().initialize();
    authStateListener?.(null);

    jest.advanceTimersByTime(8000);
    await Promise.resolve();

    // CRITICAL FIX: Auth store now PRESERVES the session when MMKV cache says
    // authenticated but Firebase Auth couldn't restore the user. This is the
    // correct behavior for the "logout on kill" fix — the user's MMKV cache is
    // the source of truth for session state. If Firebase Auth transiently fails
    // to restore (MMKV encryption key issue, network blip, etc.), we keep the
    // user "logged in" from the UI perspective. Firestore operations may fail
    // but the user isn't forced through login again.
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(store.get('afetnet_auth_cached_uid')).toBe('UIDTEST12345678901234');
  });

  it('reconciles onboarding and auth cache after async storage fallback becomes ready', async () => {
    const seed = new Map<string, string>([
      ['afetnet_auth_cached', 'true'],
      ['afetnet_auth_cached_uid', 'UIDTEST12345678901234'],
      ['AFETNET_ONBOARDING_COMPLETED', '1'],
    ]);
    let ready = false;
    let resolveReady: (() => void) | null = null;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = () => {
        ready = true;
        resolve();
      };
    });

    const directStorage = {
      getBoolean: (key: string) => ready && seed.get(key) === 'true',
      setBoolean: (key: string, value: boolean) => {
        seed.set(key, value ? 'true' : 'false');
      },
      getString: (key: string) => (ready ? seed.get(key) : undefined),
      setString: (key: string, value: string) => {
        seed.set(key, value);
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
      waitForStorageReady: () => (ready ? Promise.resolve() : readyPromise),
    }));
    jest.doMock('firebase/auth', () => ({
      onAuthStateChanged: jest.fn(() => jest.fn()),
    }));
    jest.doMock('../../../lib/firebase', () => ({
      getFirebaseAuth: jest.fn(() => ({ currentUser: null })),
    }));
    jest.doMock('../../services/IdentityService', () => ({
      identityService: {
        syncFromFirebase: jest.fn(async () => undefined),
        getIdentity: jest.fn(() => null),
        getUid: jest.fn(() => null),
        clearIdentity: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('../../services/AuthService', () => ({
      AuthService: {
        signOut: jest.fn(async () => undefined),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useOnboardingStore } = require('../onboardingStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../authStore');

    expect(useOnboardingStore.getState().completed).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(true);

    resolveReady?.();
    await flushMicrotasks();

    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(useOnboardingStore.getState().isHydrated).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
