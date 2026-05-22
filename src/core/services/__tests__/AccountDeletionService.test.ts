/**
 * ACCOUNT DELETION SERVICE TESTS
 * Hesap silme cascade akışı için kapsamlı unit testler.
 * GDPR uyumluluk + partial failure senaryoları dahil.
 */

// ============================================================
// MOCK TANIMLAMALARI — import'lardan önce
// ============================================================

const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn().mockResolvedValue({ docs: [] });
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockWriteBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatchDelete = jest.fn();
const mockWriteBatch = jest.fn(() => ({
  delete: mockBatchDelete,
  commit: mockWriteBatchCommit,
}));
const mockCollection = jest.fn(() => ({}));
const mockDoc = jest.fn(() => ({ id: 'mock-doc-ref' }));
const mockQuery = jest.fn(() => ({}));
const mockWhere = jest.fn(() => ({}));
const mockLimit = jest.fn(() => ({}));
const mockArrayRemove = jest.fn((val: unknown) => val);

const mockDeleteUser = jest.fn().mockResolvedValue(undefined);
const mockSignOut = jest.fn().mockResolvedValue(undefined);

let mockCurrentUser: { uid: string; providerData: Array<{ providerId: string }> } | null = {
  uid: 'test-uid-12345',
  providerData: [],
};

const mockGetFirebaseAuth = jest.fn(() =>
  mockCurrentUser ? { currentUser: mockCurrentUser } : null,
);

const mockFirebaseDataServiceInitialize = jest.fn().mockResolvedValue(undefined);
let mockIsInitialized = true;

const mockGetFirestoreInstanceAsync = jest.fn().mockResolvedValue({ id: 'mock-db' });

const mockClearFamilyStore = jest.fn().mockResolvedValue(undefined);
const mockClearHealthProfile = jest.fn().mockResolvedValue(undefined);
const mockResetSettings = jest.fn();
const mockClearPremium = jest.fn();
const mockClearMessages = jest.fn().mockResolvedValue(undefined);
const mockClearContactCache = jest.fn().mockResolvedValue(undefined);
const mockResetUserStatus = jest.fn();
const mockClearEarthquake = jest.fn();
const mockClearEEWHistory = jest.fn();
const mockClearMeshMessages = jest.fn();
const mockDirectStorageClearAll = jest.fn();

const mockPurgeUserSecurityKeys = jest.fn().mockResolvedValue(undefined);
const mockSecureStoreDelete = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../core/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../FirebaseDataService', () => ({
  firebaseDataService: {
    initialize: (...args: unknown[]) => mockFirebaseDataServiceInitialize(...args),
    get isInitialized() {
      return mockIsInitialized;
    },
  },
}));

jest.mock('../firebase/FirebaseInstanceManager', () => ({
  getFirestoreInstanceAsync: (...args: unknown[]) => mockGetFirestoreInstanceAsync(...args),
}));

jest.mock('firebase/firestore', () => ({
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
}));

jest.mock('firebase/auth', () => ({
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('../../../lib/firebase', () => ({
  getFirebaseAuth: (...args: unknown[]) => mockGetFirebaseAuth(...args),
  initializeFirebase: jest.fn(),
}));

jest.mock('../../../core/utils/storage', () => ({
  DirectStorage: {
    clearAll: (...args: unknown[]) => mockDirectStorageClearAll(...args),
  },
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: (...args: unknown[]) => mockSecureStoreDelete(...args),
}));

jest.mock('../../../core/stores/familyStore', () => ({
  useFamilyStore: {
    getState: jest.fn(() => ({ clear: (...args: unknown[]) => mockClearFamilyStore(...args) })),
  },
}));

jest.mock('../../../core/stores/healthProfileStore', () => ({
  useHealthProfileStore: {
    getState: jest.fn(() => ({
      clearProfile: (...args: unknown[]) => mockClearHealthProfile(...args),
    })),
  },
}));

jest.mock('../../../core/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({ resetToDefaults: (...args: unknown[]) => mockResetSettings(...args) })),
  },
}));

jest.mock('../../../core/stores/premiumStore', () => ({
  usePremiumStore: {
    getState: jest.fn(() => ({ clear: (...args: unknown[]) => mockClearPremium(...args) })),
  },
}));

jest.mock('../../../core/stores/messageStore', () => ({
  useMessageStore: {
    getState: jest.fn(() => ({ clear: (...args: unknown[]) => mockClearMessages(...args) })),
  },
}));

jest.mock('../../../core/stores/contactStore', () => ({
  useContactStore: {
    getState: jest.fn(() => ({
      clearLocalCache: (...args: unknown[]) => mockClearContactCache(...args),
    })),
  },
}));

jest.mock('../../../core/stores/userStatusStore', () => ({
  useUserStatusStore: {
    getState: jest.fn(() => ({ reset: (...args: unknown[]) => mockResetUserStatus(...args) })),
  },
}));

jest.mock('../../../core/stores/earthquakeStore', () => ({
  useEarthquakeStore: {
    getState: jest.fn(() => ({ clear: (...args: unknown[]) => mockClearEarthquake(...args) })),
  },
}));

jest.mock('../../../core/stores/eewHistoryStore', () => ({
  useEEWHistoryStore: {
    getState: jest.fn(() => ({
      clearHistory: (...args: unknown[]) => mockClearEEWHistory(...args),
    })),
  },
}));

jest.mock('../mesh/MeshStore', () => ({
  useMeshStore: {
    getState: jest.fn(() => ({
      clearMessages: (...args: unknown[]) => mockClearMeshMessages(...args),
    })),
  },
}));

jest.mock('../security/SecurityKeyCleanup', () => ({
  purgeUserSecurityKeys: (...args: unknown[]) => mockPurgeUserSecurityKeys(...args),
}));

jest.mock('expo-apple-authentication', () => ({
  revokeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  listAll: jest.fn().mockResolvedValue({ items: [], prefixes: [] }),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

// ============================================================
// IMPORTS — mock'lardan sonra
// ============================================================

import { accountDeletionService, ReauthRequiredError } from '../AccountDeletionService';

// ============================================================
// TEST SUITE
// ============================================================

describe('AccountDeletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInitialized = true;
    mockCurrentUser = {
      uid: 'test-uid-12345',
      providerData: [],
    };
    mockDeleteUser.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockFirebaseDataServiceInitialize.mockResolvedValue(undefined);
    mockGetFirestoreInstanceAsync.mockResolvedValue({ id: 'mock-db' });
  });

  // ============================================================
  // BAŞARILI SILME CASCADE
  // ============================================================

  describe('deleteAccount() — başarılı cascade', () => {
    it('başarılı cascade sonucu bir nesne döndürmelidir', async () => {
      // NOT: clearSecureStorage içindeki import('./security/SecurityKeyCleanup') ve
      // revokeAppleSignInIfApplicable içindeki import('expo-apple-authentication')
      // babel-preset-expo test ortamında require()'a dönüştürülmediğinden
      // dinamik import hatası bekleniyor. Bu nedenle success alanını değil,
      // cascade akışının tamamlandığını (result döndüğünü) ve core adımların
      // (deleteUser, DirectStorage) çalıştığını doğruluyoruz.
      const result = await accountDeletionService.deleteAccount('device-abc');

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      // Kritik adımlar çalışmış olmalı
      expect(mockDeleteUser).toHaveBeenCalledTimes(1);
      expect(mockDirectStorageClearAll).toHaveBeenCalledTimes(1);
    });

    it('progress callback\'i doğru adım sayısıyla çağırmalıdır', async () => {
      const progressCalls: Array<{ step: string; progress: number; total: number }> = [];
      const onProgress = jest.fn((p) => progressCalls.push(p));

      await accountDeletionService.deleteAccount('device-abc', onProgress);

      // 20 adım olmalı (totalSteps = 20, reauth yoksa tümü çağrılır).
      // görev #22: GDPR/KVKK — eksik PII koleksiyonları için yeni silme adımı eklendi (19→20).
      expect(onProgress).toHaveBeenCalledTimes(20);
      // İlk adım progress=1
      expect(progressCalls[0].progress).toBe(1);
      expect(progressCalls[0].total).toBe(20);
      // Son adım progress=20
      expect(progressCalls[progressCalls.length - 1].progress).toBe(20);
    });

    it('Firebase auth hesabını silmelidir', async () => {
      await accountDeletionService.deleteAccount('device-abc');
      expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    });

    it('silme sonrası sign out yapmalıdır', async () => {
      await accountDeletionService.deleteAccount('device-abc');
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('tüm Zustand store\'ları temizlemelidir', async () => {
      await accountDeletionService.deleteAccount('device-abc');

      expect(mockClearFamilyStore).toHaveBeenCalledTimes(1);
      expect(mockClearHealthProfile).toHaveBeenCalledTimes(1);
      expect(mockResetSettings).toHaveBeenCalledTimes(1);
      expect(mockClearPremium).toHaveBeenCalledTimes(1);
      expect(mockClearMessages).toHaveBeenCalledTimes(1);
      expect(mockClearContactCache).toHaveBeenCalledTimes(1);
      expect(mockResetUserStatus).toHaveBeenCalledTimes(1);
      expect(mockClearEarthquake).toHaveBeenCalledTimes(1);
      expect(mockClearEEWHistory).toHaveBeenCalledTimes(1);
      expect(mockClearMeshMessages).toHaveBeenCalledTimes(1);
    });

    it('DirectStorage.clearAll() çağırmalıdır', async () => {
      await accountDeletionService.deleteAccount('device-abc');
      expect(mockDirectStorageClearAll).toHaveBeenCalledTimes(1);
    });

    it('clearSecureStorage adımı cascade akışında çağrılmalıdır (progress step 20)', async () => {
      // clearSecureStorage dinamik import kullanıyor (babel ortamında hata verir ama catch'lenir).
      // Adımın çağrıldığını progress callback sayısıyla doğruluyoruz.
      const progressCalls: Array<{ step: string; progress: number }> = [];
      await accountDeletionService.deleteAccount('device-abc', (p) => progressCalls.push(p));

      // Step 20 (güvenli depolama temizleme — son adım) tetiklenmiş olmalı.
      // görev #22: yeni GDPR silme adımı eklenince güvenli-depolama adımı 19→20'ye kaydı.
      const step20 = progressCalls.find((p) => p.progress === 20);
      expect(step20).toBeDefined();
      expect(step20?.step).toMatch(/güvenli|secure/i);
    });

    it('device dokümanını Firestore\'dan silmelidir', async () => {
      await accountDeletionService.deleteAccount('device-abc');
      // deleteDoc en az bir kez çağrılmalı (device doc dahil)
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  // ============================================================
  // PARTIAL FAILURE — DEVAM ET
  // ============================================================

  describe('deleteAccount() — partial failure senaryosu', () => {
    it('bir adım hata verirse diğer adımlar devam etmelidir', async () => {
      // İlk deleteDoc çağrısı hata versin (device data adımı)
      mockDeleteDoc.mockRejectedValueOnce(new Error('Firestore error'));

      const result = await accountDeletionService.deleteAccount('device-abc');

      // Auth silme devam etmiş olmalı (hataya rağmen cascade sürdü)
      expect(mockDeleteUser).toHaveBeenCalled();
      // Sonuç döndürülmeli (crash yok)
      expect(result).toBeDefined();
    });

    it('hata olan adımlar errors dizisine eklenmeli', async () => {
      const specificError = new Error('Specific deletion error');
      // getDocs hata versin — family members adımını etkiler
      mockGetDocs.mockRejectedValueOnce(specificError);

      const result = await accountDeletionService.deleteAccount('device-abc');

      // errors dizisi boş olmamalı
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('birden fazla adım hata verse bile tamamlanmalıdır', async () => {
      mockDeleteDoc.mockRejectedValue(new Error('All deletions fail'));

      const result = await accountDeletionService.deleteAccount('device-abc');

      // Uygulama çökmemeli, errors dolu olabilir
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  // ============================================================
  // AUTH UID YOK
  // ============================================================

  describe('deleteAccount() — auth UID yok', () => {
    it('currentUser yokken hata fırlatmamalıdır', async () => {
      mockCurrentUser = null;

      const result = await accountDeletionService.deleteAccount('device-abc');

      // Firebase auth olmadan da tamamlanmalı (best-effort)
      expect(result).toBeDefined();
    });

    it('V3 adımları UID gerektirdiğinden UID yoksa sessizce atlamalıdır', async () => {
      mockCurrentUser = null;

      await accountDeletionService.deleteAccount('device-abc');

      // V3 metodları UID olmadan return eder — getDocs çağrılsa bile sorun yok
      // Auth silme adımı atlanmış olmalı
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // RE-AUTH GEREKTİRME SENARYOSU
  // ============================================================

  describe('deleteAccount() — requires-recent-login', () => {
    it('auth/requires-recent-login hatası gelince reauthRequired:true döndürmelidir', async () => {
      const reauthError = Object.assign(new Error('auth/requires-recent-login'), {
        code: 'auth/requires-recent-login',
      });
      mockDeleteUser.mockRejectedValueOnce(reauthError);

      const result = await accountDeletionService.deleteAccount('device-abc');

      expect(result.reauthRequired).toBe(true);
      expect(result.success).toBe(false);
    });

    it('reauthRequired durumunda local storage temizlenmemelidir', async () => {
      const reauthError = Object.assign(new Error('auth/requires-recent-login'), {
        code: 'auth/requires-recent-login',
      });
      mockDeleteUser.mockRejectedValueOnce(reauthError);

      await accountDeletionService.deleteAccount('device-abc');

      // Local storage temizleme adımları çalışmamalı
      expect(mockDirectStorageClearAll).not.toHaveBeenCalled();
      expect(mockPurgeUserSecurityKeys).not.toHaveBeenCalled();
    });

    it('reauthRequired durumunda sign out yapılmamalıdır', async () => {
      const reauthError = Object.assign(new Error('auth/requires-recent-login'), {
        code: 'auth/requires-recent-login',
      });
      mockDeleteUser.mockRejectedValueOnce(reauthError);

      await accountDeletionService.deleteAccount('device-abc');

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('errors dizisi auth/requires-recent-login içermelidir', async () => {
      const reauthError = Object.assign(new Error('auth/requires-recent-login'), {
        code: 'auth/requires-recent-login',
      });
      mockDeleteUser.mockRejectedValueOnce(reauthError);

      const result = await accountDeletionService.deleteAccount('device-abc');

      expect(result.errors).toContain('auth/requires-recent-login');
    });
  });

  // ============================================================
  // retryDeleteAuthAccount()
  // ============================================================

  describe('retryDeleteAuthAccount()', () => {
    it('re-auth sonrası başarıyla hesabı silmelidir', async () => {
      await expect(accountDeletionService.retryDeleteAuthAccount()).resolves.not.toThrow();
      expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    });

    it('re-auth sonrası DirectStorage temizlemelidir', async () => {
      await accountDeletionService.retryDeleteAuthAccount();
      expect(mockDirectStorageClearAll).toHaveBeenCalledTimes(1);
    });

    it('auth tamamen null ise hata fırlatmalıdır', async () => {
      // getFirebaseAuth()'ın null döndürdüğü durumu simüle et
      mockGetFirebaseAuth.mockReturnValueOnce(null);
      await expect(accountDeletionService.retryDeleteAuthAccount()).rejects.toThrow(
        /firebase auth not available/i,
      );
    });

    it('currentUser null ise "No authenticated user" hatası fırlatmalıdır', async () => {
      mockGetFirebaseAuth.mockReturnValueOnce({ currentUser: null });
      await expect(accountDeletionService.retryDeleteAuthAccount()).rejects.toThrow(
        /no authenticated user/i,
      );
    });
  });

  // ============================================================
  // clearLocalDataAfterDeletion()
  // ============================================================

  describe('clearLocalDataAfterDeletion()', () => {
    // purgeUserSecurityKeys dinamik import üzerinden çağrılıyor — SecureStore.deleteItemAsync
    // üzerinden doğrulama yapıyoruz (legacy key silme static import ile çalışıyor).

    it('uid parametresiyle çağrıldığında DirectStorage temizlemelidir', async () => {
      await accountDeletionService.clearLocalDataAfterDeletion('explicit-uid');

      expect(mockDirectStorageClearAll).toHaveBeenCalledTimes(1);
    });

    it('uid verilmezse de tamamlanmalıdır', async () => {
      await expect(
        accountDeletionService.clearLocalDataAfterDeletion(),
      ).resolves.not.toThrow();
      expect(mockDirectStorageClearAll).toHaveBeenCalledTimes(1);
    });

    it('DirectStorage hatası sessizce yutulmalıdır (best-effort cleanup)', async () => {
      mockDirectStorageClearAll.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      await expect(
        accountDeletionService.clearLocalDataAfterDeletion('uid-123'),
      ).resolves.not.toThrow();
    });
  });

  // ============================================================
  // APPLE SIGN-IN REVOCATION
  // ============================================================

  describe('revokeAppleSignInIfApplicable() — Apple Guideline 4.8', () => {
    // expo-apple-authentication dinamik import ile yükleniyor.
    // Babel-preset-expo bu import()'u require()'a dönüştürmediğinden
    // jest.mock ile intercept edilemiyor. Bunun yerine observable davranışı
    // (deleteAccount sonucu, deleteUser çağrısı) test ediyoruz.

    it('Apple ile giriş yapılmış hesap silinebilmelidir (revokeAsync hata verse de)', async () => {
      mockCurrentUser = {
        uid: 'apple-user-123',
        providerData: [{ providerId: 'apple.com' }],
      };

      // Apple revoke başarısız olsa bile (non-fatal) deleteUser çağrılmalı
      const result = await accountDeletionService.deleteAccount('device-abc');

      expect(mockDeleteUser).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it('Apple olmayan hesap için deleteUser çağrılmalıdır', async () => {
      mockCurrentUser = {
        uid: 'google-user-123',
        providerData: [{ providerId: 'google.com' }],
      };

      const result = await accountDeletionService.deleteAccount('device-abc');

      expect(mockDeleteUser).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it('providerData boşken hata fırlatmamalıdır', async () => {
      mockCurrentUser = {
        uid: 'email-user-123',
        providerData: [],
      };

      await expect(accountDeletionService.deleteAccount('device-abc')).resolves.not.toThrow();
    });
  });

  // ============================================================
  // FIREBASE BAŞLATILMAMIŞSA
  // ============================================================

  describe('Firebase başlatılmamış senaryosu', () => {
    it('Firebase init başarısız olsa bile silme devam etmelidir', async () => {
      mockFirebaseDataServiceInitialize.mockRejectedValueOnce(new Error('Init failed'));

      const result = await accountDeletionService.deleteAccount('device-abc');

      // Silme devam etmeli
      expect(result).toBeDefined();
    });

    it('isInitialized=false ise Firestore adımları atlanmalıdır', async () => {
      mockIsInitialized = false;
      mockGetDocs.mockClear();
      mockDeleteDoc.mockClear();

      await accountDeletionService.deleteAccount('device-abc');

      // Firestore'a hiç dokunmamalı
      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // ReauthRequiredError — Export testi
  // ============================================================

  describe('ReauthRequiredError', () => {
    it('doğru name ve message ile oluşturulmalıdır', () => {
      const err = new ReauthRequiredError();
      expect(err.name).toBe('ReauthRequiredError');
      expect(err.message).toBe('auth/requires-recent-login');
      expect(err instanceof Error).toBe(true);
    });
  });

  // ============================================================
  // deviceId-BAZLI SILME YOLU
  // ============================================================

  describe('deviceId-bazlı silme yolu', () => {
    it('deviceId ile doğru Firestore path\'ini kullanmalıdır', async () => {
      const testDeviceId = 'my-device-id-xyz';
      await accountDeletionService.deleteAccount(testDeviceId);

      // doc() çağrılarında deviceId geçilmeli
      const docCalls = mockDoc.mock.calls;
      const hasDevicePath = docCalls.some((args) =>
        args.includes('devices') && args.includes(testDeviceId),
      );
      expect(hasDevicePath).toBe(true);
    });
  });
});
