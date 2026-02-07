/**
 * Feature Service
 * Hub data for feature tiles displayed on the home screen.
 */

import { FeatureTile } from '../types/feature';

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
    route: 'RiskScore',
  },
];
