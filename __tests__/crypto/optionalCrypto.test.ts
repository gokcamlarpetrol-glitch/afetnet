import { aesGcmEncrypt, aesGcmDecrypt } from '../../src/crypto/optional';

describe('optional AES-GCM helpers', () => {
  beforeAll(() => {
    const globalCrypto = (globalThis as any).crypto;
    if (!globalCrypto || !globalCrypto.subtle) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { webcrypto } = require('crypto');
      (globalThis as any).crypto = webcrypto;
    }
  });

  it('encrypts with random IV and decrypts successfully', async () => {
    const secret = 'family-shared-secret-key-1234567890';
    const payload = 'Emergency contact details';

    const ciphertext = await aesGcmEncrypt(secret, payload);
    const ciphertextB = await aesGcmEncrypt(secret, payload);

    expect(ciphertext).not.toBeNull();
    expect(ciphertextB).not.toBeNull();
    expect(ciphertext).not.toEqual(ciphertextB);

    const decrypted = await aesGcmDecrypt(secret, ciphertext as string);
    expect(decrypted).toBe(payload);
  });

  it('decrypts legacy payloads without IV metadata', async () => {
    const secret = 'legacy-shared-secret-key-1234567890';
    const payload = 'Legacy message payload';

    const encoder = new (globalThis as any).TextEncoder();
    const subtle = (globalThis as any).crypto.subtle;
    const key = await subtle.importKey(
      'raw',
      encoder.encode(secret).slice(0, 32),
      'AES-GCM',
      false,
      ['encrypt'],
    );
    const iv = encoder.encode(secret).slice(0, 12);
    const raw = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(payload));
    const legacyCiphertext = (globalThis as any).Buffer.from(new Uint8Array(raw)).toString('base64');

    const decrypted = await aesGcmDecrypt(secret, legacyCiphertext);
    expect(decrypted).toBe(payload);
  });
});
