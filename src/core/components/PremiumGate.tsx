/**
 * PREMIUM GATE - AfetNet Free Model
 * Tüm özellikler ücretsiz ve sınırsız!
 * Her zaman içeriği göster, paywall asla gösterme.
 */

import React from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('PremiumGate');

interface PremiumGateProps {
  featureName: string;
  onUpgradePress?: () => void;
  children?: React.ReactNode;
}

export default function PremiumGate({ featureName, children }: PremiumGateProps) {
  // AFETNET: Tüm özellikler ücretsiz - her zaman erişim ver
  logger.info(`Access granted to ${featureName} - all features are free!`);

  // Her zaman içeriği göster
  return <>{children}</>;
}
