import { useIce } from '../store/ice';
import { usePDRFuse } from '../hooks/usePDRFuse';

export function integrateSOSWithICE() {
  const { templates, contacts, enqueue } = useIce.getState();
  const { currentPos } = usePDRFuse();

  // Get the highest priority template (first one by default)
  const primaryTemplate = templates.find(t => t.id === 'short_sos') || templates[0];
  
  if (!primaryTemplate || contacts.length === 0) {
    console.warn('No ICE template or contacts available for SOS integration');
    return;
  }

  // Prepare template variables
  const location = currentPos ? `${currentPos.lat.toFixed(6)}, ${currentPos.lon.toFixed(6)}` : 'bilinmiyor';
  const status = 'SOS Aktif';
  const peopleCount = '1'; // Default, could be parsed from statuses

  // Generate SMS body
  const smsBody = primaryTemplate.text
    .replace(/{Konum}/g, location)
    .replace(/{Durum}/g, status)
    .replace(/{KişiSayısı}/g, peopleCount);

  // Enqueue SMS for each ICE contact (prioritized)
  const sortedContacts = [...contacts].sort((a, b) => a.priority - b.priority);
  
  for (const contact of sortedContacts) {
    enqueue(contact.phone, smsBody);
  }

  console.log(`SOS integration: ${sortedContacts.length} ICE contacts queued for SMS`);
}

export function updateSOSStatus(statuses: string[]) {
  const { templates, contacts, enqueue } = useIce.getState();
  const { currentPos } = usePDRFuse();

  // Find people count from statuses
  const peopleCountMatch = statuses.find(s => s.includes('Kişi'));
  const peopleCount = peopleCountMatch ? peopleCountMatch.match(/\d+/)?.[0] || '1' : '1';

  // Get the detailed template for status updates
  const detailedTemplate = templates.find(t => t.id === 'detailed_sos') || templates[1] || templates[0];
  
  if (!detailedTemplate || contacts.length === 0) {
    return;
  }

  // Prepare template variables
  const location = currentPos ? `${currentPos.lat.toFixed(6)}, ${currentPos.lon.toFixed(6)}` : 'bilinmiyor';
  const status = statuses.join(', ');

  // Generate SMS body
  const smsBody = detailedTemplate.text
    .replace(/{Konum}/g, location)
    .replace(/{Durum}/g, status)
    .replace(/{KişiSayısı}/g, peopleCount);

  // Enqueue SMS for top 3 priority contacts only (to avoid spam)
  const sortedContacts = [...contacts].sort((a, b) => a.priority - b.priority).slice(0, 3);
  
  for (const contact of sortedContacts) {
    enqueue(contact.phone, smsBody);
  }

  console.log(`SOS status update: ${sortedContacts.length} ICE contacts queued for SMS`);
}
