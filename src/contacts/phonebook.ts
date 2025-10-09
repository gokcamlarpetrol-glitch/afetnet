import * as Contacts from 'expo-contacts';

export interface ContactInfo {
  name: string;
  phoneE164: string;
}

export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request contacts permission:', error);
    return false;
  }
}

export async function pickContacts(): Promise<ContactInfo[]> {
  try {
    const hasPermission = await requestContactsPermission();
    if (!hasPermission) {
      throw new Error('Contacts permission not granted');
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });

    const contacts: ContactInfo[] = [];

    for (const contact of data) {
      if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        const name = contact.name || 'İsimsiz';
        
        for (const phone of contact.phoneNumbers) {
          const normalizedPhone = normalizeToE164(phone.number || '');
          if (normalizedPhone) {
            contacts.push({
              name,
              phoneE164: normalizedPhone
            });
          }
        }
      }
    }

    // Remove duplicates based on phone number
    const uniqueContacts = contacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.phoneE164 === contact.phoneE164)
    );

    return uniqueContacts;
  } catch (error) {
    console.error('Failed to pick contacts:', error);
    throw error;
  }
}

function normalizeToE164(phoneNumber: string): string | null {
  if (!phoneNumber) return null;

  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle Turkish phone numbers
  if (cleaned.startsWith('0')) {
    // Remove leading 0 and add +90
    cleaned = '90' + cleaned.slice(1);
  } else if (cleaned.startsWith('90')) {
    // Already has country code
  } else if (cleaned.length === 10) {
    // Assume it's a Turkish number without country code
    cleaned = '90' + cleaned;
  } else {
    // For other countries, try to detect and add appropriate country code
    // This is a basic implementation - in production you'd want more sophisticated detection
    if (cleaned.length >= 10 && !cleaned.startsWith('90')) {
      // Assume it's a valid number without country code, suggest +90 as default
      // But don't automatically add it to avoid misidentification
      return null;
    }
  }

  // Validate the result
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return '+' + cleaned;
  }

  return null;
}

export function formatPhoneForDisplay(phoneE164: string): string {
  if (!phoneE164) return '';
  
  // Remove + prefix for display
  const cleaned = phoneE164.replace(/^\+/, '');
  
  // Format Turkish numbers
  if (cleaned.startsWith('90') && cleaned.length === 12) {
    const local = cleaned.slice(2);
    return `+90 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
  }
  
  // For other formats, just show with spaces every 3 digits
  return '+' + cleaned.replace(/(\d{3})/g, '$1 ').trim();
}

export function getContactDisplayName(contact: ContactInfo): string {
  return contact.name || 'İsimsiz Kişi';
}
