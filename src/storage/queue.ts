import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';
import { postJSON } from '../lib/http';

export type HelpItem = { id: string; createdAt: number; payload: any; attempts?: number };
const KEY = 'helpQueue:v1';

export async function readQueue(): Promise<HelpItem[]> {
  try { 
    const raw = await AsyncStorage.getItem(KEY); 
    return raw ? JSON.parse(raw) : []; 
  } catch { 
    return []; 
  }
}

export async function writeQueue(items: HelpItem[]) {
  try { 
    await AsyncStorage.setItem(KEY, JSON.stringify(items)); 
  } catch (error) {
    logger.error('AfetNet: Queue yazılamadı:', error);
  }
}

export async function enqueue(payload: any) {
  const q = await readQueue();
  q.unshift({ 
    id: String(Date.now()) + '-' + Math.random().toString(36).slice(2), 
    createdAt: Date.now(), 
    payload,
    attempts: 0,
  });
  await writeQueue(q);
  logger.debug(`AfetNet: Queue'ya eklendi (${q.length} item)`);
  return q.length;
}

/**
 * Backend'e queue'yu flush et
 * Gerçek API entegrasyonu ile
 */
export async function flush(): Promise<number> {
  const q = await readQueue();
  if (q.length === 0) {
    return 0;
  }

  let sent = 0;
  const failed: HelpItem[] = [];

  for (const item of q) {
    try {
      // Backend'e gönder
      await postJSON('/ingest', {
        id: item.id,
        timestamp: item.createdAt,
        data: item.payload,
      });
      
      sent++;
      logger.debug(`AfetNet: Queue item gönderildi (${item.id})`);
    } catch (error: Error | unknown) {
      // Retry logic: 3 denemeden sonra sil
      const attempts = (item.attempts || 0) + 1;
      if (attempts < 3) {
        failed.push({ ...item, attempts });
        logger.warn(`AfetNet: Queue item başarısız (deneme ${attempts}/3)`, { error: (error as any)?.message });
      } else {
        logger.error(`AfetNet: Queue item kalıcı hata, siliniyor (${item.id})`, { error: (error as any)?.message });
      }
    }
  }

  // Başarısız olanları tekrar yaz
  await writeQueue(failed);
  
  logger.debug(`AfetNet: Queue flush: ${sent} gönderildi, ${failed.length} tekrar deneniyor`);
  return sent;
}



