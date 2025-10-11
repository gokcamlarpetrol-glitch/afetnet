import * as Crypto from 'expo-crypto';
import { logger } from '../utils/productionLogger';
import * as FileSystem from 'expo-file-system';
import { encodeBase64 } from 'tweetnacl-util';
import { LogEvent } from '../store/devlog';

export interface EncryptedLogExport {
  sessionKey: string;
  fileName: string;
  filePath: string;
}

export async function encryptAndExportLogs(events: LogEvent[]): Promise<EncryptedLogExport> {
  try {
    // Generate random session key
    const sessionKey = await Crypto.getRandomBytesAsync(32);
    const sessionKeyB64 = encodeBase64(sessionKey);

    // Create JSONL content
    const jsonlContent = events
      .map(event => JSON.stringify(event))
      .join('\n');

    // Simple XOR encryption (for demo purposes)
    // In production, use proper AES encryption
    const encryptedContent = xorEncrypt(jsonlContent, sessionKeyB64);

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `afn_blackbox_${timestamp}.jsonl.gz.enc`;
    
    // Ensure directory exists
    const blackboxDir = `${FileSystem.documentDirectory || ''}afn_blackbox/`;
    const dirInfo = await FileSystem.getInfoAsync(blackboxDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(blackboxDir, { intermediates: true });
    }

    const filePath = `${blackboxDir}${fileName}`;

    // Write encrypted file
    await FileSystem.writeAsStringAsync(filePath, encryptedContent, {
      encoding: 'utf8'
    });

    return {
      sessionKey: sessionKeyB64,
      fileName,
      filePath
    };

  } catch (error) {
    logger.error('Failed to encrypt and export logs:', error);
    throw error;
  }
}

export async function decryptLogs(encryptedContent: string, sessionKey: string): Promise<LogEvent[]> {
  try {
    const decryptedContent = xorDecrypt(encryptedContent, sessionKey);
    const lines = decryptedContent.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      try {
        return JSON.parse(line) as LogEvent;
      } catch (error) {
        logger.warn('Failed to parse log line:', line);
        return null;
      }
    }).filter((event): event is LogEvent => event !== null);

  } catch (error) {
    logger.error('Failed to decrypt logs:', error);
    throw error;
  }
}

function xorEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const textChar = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(textChar ^ keyChar);
  }
  return encodeBase64(new TextEncoder().encode(result));
}

function xorDecrypt(encryptedB64: string, key: string): string {
  try {
    const encrypted = new TextDecoder().decode(
      new Uint8Array(Array.from(atob(encryptedB64)).map(c => c.charCodeAt(0)))
    );
    
    let result = '';
    for (let i = 0; i < encrypted.length; i++) {
      const encryptedChar = encrypted.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(encryptedChar ^ keyChar);
    }
    return result;
  } catch (error) {
    logger.error('Decryption failed:', error);
    return '';
  }
}

export async function getExportableLogs(): Promise<LogEvent[]> {
  try {
    const blackboxDir = `${FileSystem.documentDirectory || ''}afn_blackbox/`;
    const dirInfo = await FileSystem.getInfoAsync(blackboxDir);
    
    if (!dirInfo.exists) {
      return [];
    }

    const files = await FileSystem.readDirectoryAsync(blackboxDir);
    const exportableFiles = files.filter(file => file.endsWith('.jsonl.gz.enc'));
    
    if (exportableFiles.length === 0) {
      return [];
    }

    // Return info about available exports
    const fileInfos = await Promise.all(
      exportableFiles.map(async (file) => {
        const filePath = `${blackboxDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        return {
          fileName: file,
          filePath,
          size: fileInfo.exists ? fileInfo.size : 0,
          uri: filePath
        };
      })
    );

    return fileInfos as any;

  } catch (error) {
    logger.error('Failed to get exportable logs:', error);
    return [];
  }
}
