/**
 * ERROR BOUNDARY
 * Catch React errors and show fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Always log to console first (DEV mode shows it immediately)
    console.error('❌ ERROR BOUNDARY CAUGHT:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    
    logger.error('Caught error:', error, errorInfo);
    
    // In production, send to crash reporting service
    if (!__DEV__) {
      try {
        // Send to crash reporting service (Firebase Crashlytics, Sentry, etc.)
        // Example: Crashlytics.recordError(error);
        // For now, log to production logger
        console.error('[PRODUCTION ERROR]', {
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        });
      } catch (reportError) {
        // Silently fail if crash reporting fails
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="alert-circle" size={64} color={colors.status.danger} />
            
            <Text style={styles.title}>Bir Hata Oluştu</Text>
            
            <Text style={styles.message}>
              Üzgünüz, beklenmeyen bir hata oluştu. Lütfen uygulamayı yeniden başlatın.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={this.handleReset}
            >
              <Text style={styles.buttonText}>Tekrar Dene</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: 20,
    marginBottom: 12,
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    ...typography.small,
    color: colors.status.danger,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});

