/**
 * Unit Tests for End-to-End Encryption
 * CRITICAL: Privacy and security foundation
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

describe('End-to-End Encryption', () => {
  describe('Key Generation', () => {
    it('should generate valid key pair', () => {
      const keyPair = nacl.box.keyPair();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.secretKey).toBeDefined();
      expect(keyPair.publicKey.length).toBe(32);
      expect(keyPair.secretKey.length).toBe(32);
    });

    it('should generate different keys each time', () => {
      const keyPair1 = nacl.box.keyPair();
      const keyPair2 = nacl.box.keyPair();

      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
      expect(keyPair1.secretKey).not.toEqual(keyPair2.secretKey);
    });
  });

  describe('Message Encryption/Decryption', () => {
    it('should encrypt and decrypt message successfully', () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();
      
      const message = 'Secret emergency message';
      const messageBytes = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(24);

      // Encrypt
      const encrypted = nacl.box(
        messageBytes,
        nonce,
        receiver.publicKey,
        sender.secretKey
      );

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);

      // Decrypt
      const decrypted = nacl.box.open(
        encrypted,
        nonce,
        sender.publicKey,
        receiver.secretKey
      );

      expect(decrypted).toBeDefined();
      
      const decryptedMessage = new TextDecoder().decode(decrypted!);
      expect(decryptedMessage).toBe(message);
    });

    it('should fail decryption with wrong key', () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();
      const wrongPerson = nacl.box.keyPair();
      
      const message = 'Secret';
      const messageBytes = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(24);

      const encrypted = nacl.box(
        messageBytes,
        nonce,
        receiver.publicKey,
        sender.secretKey
      );

      // Try to decrypt with wrong key
      const decrypted = nacl.box.open(
        encrypted,
        nonce,
        sender.publicKey,
        wrongPerson.secretKey
      );

      expect(decrypted).toBeNull();
    });
  });

  describe('Base64 Encoding', () => {
    it('should encode and decode correctly', () => {
      const keyPair = nacl.box.keyPair();
      
      const publicKeyB64 = encodeBase64(keyPair.publicKey);
      const decodedPublicKey = decodeBase64(publicKeyB64);

      expect(publicKeyB64).toBeDefined();
      expect(publicKeyB64.length).toBeGreaterThan(0);
      expect(decodedPublicKey).toEqual(keyPair.publicKey);
    });
  });

  describe('AFN-ID Generation', () => {
    it('should generate valid AFN-ID format', () => {
      const generateAfnId = () => {
        const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let id = 'AFN-';
        for (let i = 0; i < 8; i++) {
          id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
      };

      const afnId = generateAfnId();
      const pattern = /^AFN-[0-9A-Z]{8}$/;

      expect(afnId).toMatch(pattern);
      expect(afnId.length).toBe(12); // 'AFN-' + 8 chars
    });

    it('should generate unique AFN-IDs', () => {
      const generateAfnId = () => {
        const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let id = 'AFN-';
        for (let i = 0; i < 8; i++) {
          id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
      };

      const id1 = generateAfnId();
      const id2 = generateAfnId();

      // Very high probability of being different
      expect(id1).not.toBe(id2);
    });
  });

  describe('Group Encryption', () => {
    it('should generate shared secret', () => {
      const alice = nacl.box.keyPair();
      const bob = nacl.box.keyPair();

      const sharedAlice = nacl.box.before(bob.publicKey, alice.secretKey);
      const sharedBob = nacl.box.before(alice.publicKey, bob.secretKey);

      expect(sharedAlice).toEqual(sharedBob);
      expect(sharedAlice.length).toBe(32);
    });

    it('should encrypt group message with shared secret', () => {
      const alice = nacl.box.keyPair();
      const bob = nacl.box.keyPair();
      
      const sharedSecret = nacl.box.before(bob.publicKey, alice.secretKey);
      const message = 'Group emergency message';
      const messageBytes = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(24);

      const encrypted = nacl.secretbox(messageBytes, nonce, sharedSecret);

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = nacl.secretbox.open(encrypted, nonce, sharedSecret);
      expect(decrypted).toBeDefined();
      
      const decryptedMessage = new TextDecoder().decode(decrypted!);
      expect(decryptedMessage).toBe(message);
    });
  });
});

