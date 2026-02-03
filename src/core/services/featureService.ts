import { FeatureTile } from '../types/feature';
import { EmergencyAlert } from '../types/alerts';

const now = new Date();

export const featuredTiles: FeatureTile[] = [
  {
    id: 'map',
    title: 'Harita',
    description: 'Mesh & uydu verisiyle tehlikeli bölgeleri takip et',
    icon: 'map-outline',
    premium: false,
    route: 'Map',
  },
  {
    id: 'wave',
    title: 'P/S Dalga',
    description: 'Sinyal hızı ve ivme değerlerini canlı izle',
    icon: 'pulse-outline',
    premium: true,
    route: 'Wave',
  },
  {
    id: 'messages',
    title: 'Mesajlar',
    description: 'Mesh ve çevrim içi kanallarda toplulukla iletişime geç',
    icon: 'chatbubbles-outline',
    premium: false,
    route: 'Messages',
  },
  {
    id: 'ai',
    title: 'Premium Asistan',
    description: 'Özel yapay zeka tavsiyeleri al',
    icon: 'sparkles-outline',
    premium: true,
    route: 'Risk',
  },
];

const sampleAlerts: EmergencyAlert[] = [
  {
    id: 'alert-1',
    title: 'Şiddetli sarsıntı algılandı',
    type: 'earthquake',
    severity: 'danger',
    location: 'İstanbul, Avcılar',
    message: 'Mesajlaşma kanalları devrede. Lütfen güvenli alanlara yönelin.',
    timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'alert-2',
    title: 'Yönlendirme ve yardım çağrısı',
    type: 'rescue',
    severity: 'warning',
    location: 'İzmir, Bayraklı',
    message: 'Aile üyeleriyle iletişim kurmak için özel güvenli mesajlaşıma geçildi.',
    timestamp: new Date(now.getTime() - 14 * 60 * 1000).toISOString(),
  },
];

export async function fetchEmergencyFeed(): Promise<EmergencyAlert[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(sampleAlerts), 250);
  });
}
