import { useEffect } from 'react';
import { useComprehensiveFeatures } from '../store/comprehensiveFeatures';
import { startLiveFeed } from '../services/quake/realtime';
import { useSettings } from '../store/settings';
import { logger } from '../utils/productionLogger';

// Initialize comprehensive features on app startup
export default function ComprehensiveFeaturesInitializer() {
  const { initializeSettings } = useComprehensiveFeatures();
  const settings = useSettings();

  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  // Start global live feed for quakes once at startup
  useEffect(() => {
    const live = startLiveFeed(
      {
        quakeProvider: settings.quakeProvider,
        magThreshold: settings.magThreshold,
        liveMode: true,
        pollFastMs: settings.pollFastMs,
        pollSlowMs: settings.pollSlowMs,
        region: settings.region,
        experimentalPWave: settings.experimentalPWave,
        selectedProvinces: settings.selectedProvinces,
      },
      {
        onEvents: () => {
          // No-op: screens using useQuakes will reflect cache updates
        },
        onError: (err) => logger.warn('Live feed error (global):', err),
      },
    );

    return () => live.stop();
  }, []);

  return null; // This component doesn't render anything
}

