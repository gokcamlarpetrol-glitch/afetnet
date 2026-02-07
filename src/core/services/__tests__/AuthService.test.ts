/**
 * AUTH SERVICE TESTS - CURRENT API
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthService } from '../AuthService';
import { clearDeviceId } from '../../../lib/device';
import {
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  reload,
  signOut as firebaseSignOut,
} from 'firebase/auth';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      idToken: 'mock-google-id-token',
      data: { idToken: 'mock-google-id-token' },
    }),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: {
    EMAIL: 'email',
    FULL_NAME: 'fullName',
  },
  signInAsync: jest.fn().mockResolvedValue({
    identityToken: 'mock-apple-identity-token',
    fullName: { givenName: 'Test', familyName: 'User' },
  }),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../lib/firebase', () => ({
  initializeFirebase: jest.fn(() => ({})),
}));

jest.mock('../../../lib/device', () => ({
  getDeviceId: jest.fn().mockResolvedValue('afn-test-device-id'),
  setDeviceId: jest.fn().mockResolvedValue(undefined),
  clearDeviceId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../IdentityService', () => ({
  identityService: {
    syncFromFirebase: jest.fn().mockResolvedValue(undefined),
    updateProfile: jest.fn().mockResolvedValue(undefined),
    clearIdentity: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../ContactService', () => ({
  contactService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../PresenceService', () => ({
  presenceService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    stopHeartbeat: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../ContactRequestService', () => ({
  contactRequestService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../AuthSessionCleanupService', () => ({
  authSessionCleanupService: {
    cleanup: jest.fn().mockResolvedValue(undefined),
    clearLocalSessionData: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      idToken: 'mock-google-id-token',
      data: { idToken: 'mock-google-id-token' },
    });

    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'mock-apple-identity-token',
      fullName: { givenName: 'Test', familyName: 'User' },
    });

    (signInWithCredential as jest.Mock).mockResolvedValue({
      user: {
        uid: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      },
    });

    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: {
        uid: 'user-2',
        email: 'email@example.com',
        displayName: 'Email User',
        emailVerified: true,
      },
    });

    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: {
        uid: 'user-3',
        email: 'new@example.com',
        displayName: 'New User',
      },
    });

    (reload as jest.Mock).mockResolvedValue(undefined);
    (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);
  });

  it('exposes expected auth methods', () => {
    expect(typeof AuthService.signInWithGoogle).toBe('function');
    expect(typeof AuthService.signInWithApple).toBe('function');
    expect(typeof AuthService.signInWithEmail).toBe('function');
    expect(typeof AuthService.signUpWithEmail).toBe('function');
    expect(typeof AuthService.signOut).toBe('function');
    expect(typeof AuthService.getCurrentUser).toBe('function');
  });

  it('signInWithGoogle returns user on success', async () => {
    const user = await AuthService.signInWithGoogle();

    expect(user).toBeTruthy();
    expect(signInWithCredential).toHaveBeenCalled();
  });

  it('signInWithGoogle maps cancelled error to Turkish message', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.SIGN_IN_CANCELLED,
      message: 'cancelled',
    });

    await expect(AuthService.signInWithGoogle()).rejects.toThrow('Giriş iptal edildi');
  });

  it('signInWithApple returns user on success', async () => {
    const user = await AuthService.signInWithApple();

    expect(user).toBeTruthy();
    expect(signInWithCredential).toHaveBeenCalled();
  });

  it('signInWithApple rejects when identity token is missing', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: null,
      fullName: null,
    });

    await expect(AuthService.signInWithApple()).rejects.toThrow('kimlik tokeni');
  });

  it('signInWithEmail returns user on success', async () => {
    const user = await AuthService.signInWithEmail('email@example.com', 'Password123!');

    expect(user).toBeTruthy();
    expect(signInWithEmailAndPassword).toHaveBeenCalled();
  });

  it('signUpWithEmail returns user on success', async () => {
    const user = await AuthService.signUpWithEmail('new@example.com', 'Password123!', 'New User');

    expect(user).toBeTruthy();
    expect(createUserWithEmailAndPassword).toHaveBeenCalled();
  });

  it('signOut completes without throwing', async () => {
    await expect(AuthService.signOut()).resolves.toBeUndefined();
    expect(firebaseSignOut).toHaveBeenCalled();
    expect(clearDeviceId).toHaveBeenCalled();
  });
});
