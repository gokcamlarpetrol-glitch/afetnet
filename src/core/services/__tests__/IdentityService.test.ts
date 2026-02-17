jest.mock('../../../lib/device', () => ({
  getDeviceId: jest.fn().mockResolvedValue('AFN-TEST0001'),
  setDeviceId: jest.fn().mockResolvedValue(undefined),
  clearDeviceId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../lib/installationId', () => ({
  getInstallationId: jest.fn().mockResolvedValue('install-test-1'),
}));

jest.mock('../../../lib/firebase', () => ({
  initializeFirebase: jest.fn(() => null),
  getFirebaseAuth: jest.fn(() => null),
}));

import { identityService } from '../IdentityService';

describe('IdentityService QR payload parsing', () => {
  it('parses JSON payload with valid uid', async () => {
    const payload = JSON.stringify({
      v: 3,
      uid: 'uidTestABC12345678901234',
      name: 'Test Kullanici',
      type: 'CLOUD',
    });

    const parsed = await identityService.parseQRPayload(payload);

    expect(parsed).not.toBeNull();
    expect(parsed?.v).toBe(3);
    expect(parsed?.uid).toBe('uidTestABC12345678901234');
    expect(parsed?.name).toBe('Test Kullanici');
  });

  it('parses URL-encoded JSON payload after decoding', async () => {
    // parseQRPayload does not auto-decode URL encoding.
    // Callers (NewMessageScreen, AddFamilyMemberScreen) decode first, then call parse.
    const encoded = encodeURIComponent(
      JSON.stringify({
        v: 3,
        uid: 'uidEncoded123456789012',
        name: 'Encoded User',
        type: 'CLOUD',
      }),
    );

    // Raw encoded string should not parse
    const rawParsed = await identityService.parseQRPayload(encoded);
    expect(rawParsed).toBeNull();

    // After decoding, it should parse correctly
    const decoded = decodeURIComponent(encoded);
    const parsed = await identityService.parseQRPayload(decoded);
    expect(parsed).not.toBeNull();
    expect(parsed?.uid).toBe('uidEncoded123456789012');
  });

  it('parses deep-link payload parameter', async () => {
    const deepLink = `afetnet://add?payload=${encodeURIComponent(
      JSON.stringify({
        v: 2,
        uid: 'uidDeep12345678901234',
        name: 'Deep Link User',
        type: 'LEGACY',
      }),
    )}`;

    const parsed = await identityService.parseQRPayload(deepLink);

    expect(parsed).not.toBeNull();
    expect(parsed?.uid).toBe('uidDeep12345678901234');
  });

  it('accepts plain UID-like raw QR values', async () => {
    const uid = await identityService.parseQRPayload('AbCdEf1234567890GhIjKlMn');
    expect(uid).not.toBeNull();
    expect(uid?.uid).toBe('AbCdEf1234567890GhIjKlMn');
  });

  it('returns null for AFN code without Firebase', async () => {
    // AFN codes require Firestore resolution; with Firebase mocked as null, returns null
    const afn = await identityService.parseQRPayload('AFN-RAW12345');
    expect(afn).toBeNull();
  });

  it('returns null for unusable payload', async () => {
    expect(await identityService.parseQRPayload('')).toBeNull();
    expect(await identityService.parseQRPayload('***not-a-qr***')).toBeNull();
  });
});
