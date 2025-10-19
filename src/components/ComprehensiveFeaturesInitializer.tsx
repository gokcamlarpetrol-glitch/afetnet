import React, { useEffect } from 'react';
import { useComprehensiveFeatures } from '../store/comprehensiveFeatures';

// Initialize comprehensive features on app startup
export default function ComprehensiveFeaturesInitializer() {
  const { initializeSettings } = useComprehensiveFeatures();

  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  return null; // This component doesn't render anything
}

