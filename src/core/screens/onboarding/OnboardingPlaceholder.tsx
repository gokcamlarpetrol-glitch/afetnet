import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useOnboardingStore } from '../../stores/onboardingStore';

/**
 * Temporary Placeholder for Onboarding
 * This will be replaced by the Cinematic Onboarding in Phase 4.
 */
export default function OnboardingPlaceholder() {
  const { setCompleted } = useOnboardingStore();

  useEffect(() => {
    // Auto-complete for now since we are in dev/refactor mode
    // setCompleted(true); 
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={styles.text}>Preparing Elite Experience...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Deep Slate
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 20,
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'System',
  },
});
