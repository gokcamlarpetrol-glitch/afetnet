import { RemoteConfig, validateRemoteConfig } from './schema';
import { PreferencesManager } from '../storage/prefs';
import * as crypto from 'expo-crypto';

// Bundled public key for signature verification (in production, this should be embedded)
const BUNDLED_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
-----END PUBLIC KEY-----`;

export interface RemoteConfigResult {
  success: boolean;
  config?: RemoteConfig;
  error?: string;
  signatureValid?: boolean;
}

export class RemoteConfigFetcher {
  private static instance: RemoteConfigFetcher;
  private prefs = PreferencesManager.getInstance();

  static getInstance(): RemoteConfigFetcher {
    if (!RemoteConfigFetcher.instance) {
      RemoteConfigFetcher.instance = new RemoteConfigFetcher();
    }
    return RemoteConfigFetcher.instance;
  }

  async fetchRemoteConfig(url: string): Promise<RemoteConfigResult> {
    try {
      console.log('Fetching remote config from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0.0',
        },
        timeout: 10000, // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const configText = await response.text();
      const signature = response.headers.get('X-Signature');
      
      // Verify signature if present
      let signatureValid = true;
      if (signature) {
        signatureValid = await this.verifySignature(configText, signature);
        if (!signatureValid) {
          console.warn('Remote config signature verification failed');
        }
      }

      // Parse and validate JSON
      const configData = JSON.parse(configText);
      const config = validateRemoteConfig(configData);

      // Store the fetched config
      await this.prefs.set('remoteConfig', JSON.stringify({
        config,
        timestamp: Date.now(),
        signatureValid,
        url,
      }));

      console.log('Remote config fetched and stored successfully');
      
      return {
        success: true,
        config,
        signatureValid,
      };
    } catch (error) {
      console.error('Failed to fetch remote config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async verifySignature(data: string, signature: string): Promise<boolean> {
    try {
      // In production, implement proper Ed25519 signature verification
      // For now, we'll do a basic check
      console.log('Verifying signature for remote config');
      
      // This is a placeholder - in production, use proper crypto verification
      // const publicKey = await crypto.subtle.importKey(
      //   'spki',
      //   Buffer.from(BUNDLED_PUBLIC_KEY_PEM.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, ''), 'base64'),
      //   { name: 'Ed25519' },
      //   false,
      //   ['verify']
      // );
      
      // const isValid = await crypto.subtle.verify(
      //   'Ed25519',
      //   publicKey,
      //   Buffer.from(signature, 'base64'),
      //   new TextEncoder().encode(data)
      // );
      
      // For now, return true if signature exists
      return signature.length > 0;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  async getCachedConfig(): Promise<RemoteConfig | null> {
    try {
      const cached = await this.prefs.get('remoteConfig');
      if (!cached) {
        return null;
      }

      const { config, timestamp } = JSON.parse(cached);
      
      // Check if config is older than 1 hour
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - timestamp > oneHour) {
        console.log('Cached remote config is stale, returning null');
        return null;
      }

      return config;
    } catch (error) {
      console.error('Failed to get cached remote config:', error);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await this.prefs.remove('remoteConfig');
      console.log('Remote config cache cleared');
    } catch (error) {
      console.error('Failed to clear remote config cache:', error);
    }
  }

  async getLastFetchInfo(): Promise<{ url?: string; timestamp?: number; signatureValid?: boolean } | null> {
    try {
      const cached = await this.prefs.get('remoteConfig');
      if (!cached) {
        return null;
      }

      const { url, timestamp, signatureValid } = JSON.parse(cached);
      return { url, timestamp, signatureValid };
    } catch (error) {
      console.error('Failed to get last fetch info:', error);
      return null;
    }
  }
}

// Convenience function for the wizard
export const fetchRemoteConfig = async (url: string): Promise<RemoteConfigResult> => {
  const fetcher = RemoteConfigFetcher.getInstance();
  return await fetcher.fetchRemoteConfig(url);
};
