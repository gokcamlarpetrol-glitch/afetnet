import { useEffect } from 'react';
import { useAppSettings } from '../store/appSettings';

// Initialize app settings on app startup
export default function SettingsInitializer() {
  const { initializeSettings } = useAppSettings();

  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  return null; // This component doesn't render anything
}

