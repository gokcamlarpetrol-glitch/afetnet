import * as SMS from 'expo-sms';
import { logger } from '../utils/productionLogger';

export async function composeInvite(phoneE164: string, myAfnId: string): Promise<boolean> {
  try {
    // Check if SMS is available
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('SMS gönderimi bu cihazda desteklenmiyor');
    }

    // Create the invite message
    const message = createInviteMessage(myAfnId);

    // Open SMS composer
    await SMS.sendSMSAsync([phoneE164], message);
    
    return true;
  } catch (error) {
    logger.error('Failed to compose SMS invite:', error);
    throw error;
  }
}

export function createInviteMessage(myAfnId: string): string {
  return `AfetNet — Beni ekle: AFN-ID ${myAfnId}. Uygulamada 'ID ile Ekle' deyip bu kodu yaz. Şebeke yoksa yakınken QR ile eşleşebiliriz.`;
}

export function createDetailedInviteMessage(myAfnId: string, senderName?: string): string {
  const greeting = senderName ? `${senderName} ` : '';
  return `AfetNet — ${greeting}beni ekle: AFN-ID ${myAfnId}

Acil durumlarda şebekesiz iletişim için AfetNet uygulamasında:
1. "Kişiler" → "ID ile Ekle" 
2. Bu kodu yaz: ${myAfnId}
3. Eşleşmeyi onayla

Yakınken QR ile de eşleşebiliriz.`;
}

export async function sendInviteToMultipleContacts(
  contacts: Array<{ phoneE164: string; name?: string }>, 
  myAfnId: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    try {
      await composeInvite(contact.phoneE164, myAfnId);
      sent++;
    } catch (error) {
      logger.error(`Failed to send invite to ${contact.phoneE164}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}

export function formatInviteForSharing(myAfnId: string): string {
  return `AfetNet ile acil durumlarda şebekesiz iletişim kurun!

Benim AFN-ID: ${myAfnId}

Nasıl eşleşirsiniz:
• QR kod ile (yakınken)
• ID ile: ${myAfnId}
• Rehberden davet

AfetNet uygulamasını indirin ve beni ekleyin.`;
}
