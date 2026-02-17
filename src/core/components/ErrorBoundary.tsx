/**
 * ELITE: ERROR BOUNDARY
 * Comprehensive error handling with recovery options and crash reporting
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { createLogger } from '../utils/logger';
import { firebaseCrashlyticsService } from '../services/FirebaseCrashlyticsService';
import { getCurrentRouteName } from '../navigation/navigationRef';

const logger = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode; // Custom fallback UI
  onError?: (error: Error, errorInfo: ErrorInfo) => void; // Custom error handler
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  sourceComponent: string | null;
  routeName: string | null;
}

const extractSourceComponent = (componentStack?: string): string | null => {
  if (!componentStack) return null;
  const lines = componentStack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^in\s+([A-Za-z0-9_]+)/);
    if (match?.[1] && match[1] !== 'Unknown') {
      return match[1];
    }
  }
  return null;
};

const createErrorFingerprint = (error: Error, componentStack?: string): string => {
  const topStackLine = error.stack?.split('\n')[1]?.trim() || '';
  const seed = `${error.name}|${error.message}|${topStackLine}|${componentStack || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
};

export default class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      sourceComponent: null,
      routeName: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const sourceComponent = extractSourceComponent(errorInfo.componentStack);
    const fingerprint = createErrorFingerprint(error, errorInfo.componentStack);
    const enrichedErrorId = `err_${Date.now()}_${fingerprint}`;
    const routeName = getCurrentRouteName();

    // ELITE: Unicorn-level error handling - comprehensive logging without console
    // Log to production logger (automatically handles DEV vs PROD)
    logger.error('Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: enrichedErrorId,
      sourceComponent: sourceComponent || 'unknown',
      routeName,
      fingerprint,
    });

    // Update state with error info
    this.setState({
      errorInfo,
      errorId: enrichedErrorId,
      sourceComponent,
      routeName,
    });

    // ELITE: Send to crash reporting service
    try {
      firebaseCrashlyticsService.recordError(error, {
        componentStack: errorInfo.componentStack || 'unknown',
        errorId: enrichedErrorId,
        sourceComponent: sourceComponent || 'unknown',
        routeName: routeName || 'unknown',
        fingerprint,
        errorBoundary: 'true',
        retryCount: String(this.retryCount),
      });
    } catch (reportError) {
      logger.error('Failed to report error to Crashlytics:', reportError);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        logger.error('Custom error handler failed:', handlerError);
      }
    }
  }

  handleReset = () => {
    if (this.retryCount >= this.MAX_RETRIES) {
      // Too many retries - show permanent error
      logger.error('Max retries reached, showing permanent error');
      return;
    }

    this.retryCount++;
    logger.info(`ErrorBoundary reset attempt ${this.retryCount}/${this.MAX_RETRIES}`);

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      sourceComponent: null,
      routeName: null,
    });
  };

  handleReload = async () => {
    // Reload app (for web) or restart (for native)
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
      return;
    }

    try {
      const updatesModule = require('expo-updates') as { reloadAsync?: () => Promise<void> };
      if (typeof updatesModule.reloadAsync === 'function') {
        await updatesModule.reloadAsync();
        return;
      }
    } catch {
      // expo-updates may not be available in all runtime environments
    }

    try {
      const { DevSettings } = require('react-native');
      if (DevSettings && typeof DevSettings.reload === 'function') {
        DevSettings.reload();
        return;
      }
    } catch {
      // DevSettings unavailable in production runtime
    }

    // Last resort: clear boundary state so user is not permanently blocked.
    this.handleReset();
  };

  handleReportError = async () => {
    // Copy error details to clipboard or open support email
    const errorDetails = `
Error ID: ${this.state.errorId}
Source: ${this.state.sourceComponent || 'Unknown'}
Route: ${this.state.routeName || 'Unknown'}
Error: ${this.state.error?.message || 'Unknown'}
Stack: ${this.state.error?.stack || 'No stack trace'}
Component Stack: ${this.state.errorInfo?.componentStack || 'No component stack'}
Timestamp: ${new Date().toISOString()}
    `.trim();

    try {
      // Try to copy to clipboard
      const ClipboardModule = require('expo-clipboard');
      await (ClipboardModule.setStringAsync || ClipboardModule.default?.setStringAsync)?.(errorDetails);

      // Open email client with error details
      const emailSubject = encodeURIComponent(`AfetNet Error Report - ${this.state.errorId}`);
      const emailBody = encodeURIComponent(errorDetails);
      const emailUrl = `mailto:support@afetnet.app?subject=${emailSubject}&body=${emailBody}`;

      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        // Fallback: just copy to clipboard
        logger.info('Error details copied to clipboard');
      }
    } catch (error) {
      logger.error('Failed to report error:', error);
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorId, sourceComponent, routeName } = this.state;
      const isMaxRetries = this.retryCount >= this.MAX_RETRIES;

      return (
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <Ionicons
                name={isMaxRetries ? "warning" : "alert-circle"}
                size={64}
                color={colors.status.danger}
              />

              <Text style={styles.title}>
                {isMaxRetries ? 'Kritik Hata' : 'Bir Hata Oluştu'}
              </Text>

              <Text style={styles.message}>
                {isMaxRetries
                  ? 'Üzgünüz, uygulama beklenmeyen bir hatayla karşılaştı. Lütfen uygulamayı kapatıp yeniden açın veya destek ekibimizle iletişime geçin.'
                  : 'Üzgünüz, beklenmeyen bir hata oluştu. Lütfen tekrar deneyin veya uygulamayı yeniden başlatın.'}
              </Text>

              {errorId && (
                <View style={styles.errorIdBox}>
                  <Text style={styles.errorIdLabel}>Hata ID:</Text>
                  <Text style={styles.errorIdText}>{errorId}</Text>
                  {sourceComponent && (
                    <Text style={styles.errorSourceText}>Kaynak: {sourceComponent}</Text>
                  )}
                  {routeName && (
                    <Text style={styles.errorSourceText}>Ekran: {routeName}</Text>
                  )}
                </View>
              )}

              {__DEV__ && error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorLabel}>Hata Detayları (Geliştirici Modu):</Text>
                  <Text style={styles.errorText}>
                    {error.toString()}
                  </Text>
                  {error.stack && (
                    <Text style={styles.errorStack}>
                      {error.stack}
                    </Text>
                  )}
                  {errorInfo?.componentStack && (
                    <Text style={styles.errorStack}>
                      Component Stack:{'\n'}
                      {errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.buttonContainer}>
                {!isMaxRetries && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.button,
                      styles.buttonPrimary,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={this.handleReset}
                  >
                    <Ionicons name="refresh" size={20} color={colors.text.primary} />
                    <Text style={styles.buttonText}>Tekrar Dene</Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.buttonSecondary,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={this.handleReload}
                >
                  <Ionicons name="reload" size={20} color={colors.text.primary} />
                  <Text style={styles.buttonText}>Yeniden Başlat</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.buttonTertiary,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={this.handleReportError}
                >
                  <Ionicons name="mail" size={20} color={colors.text.primary} />
                  <Text style={styles.buttonText}>Hata Bildir</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[16],
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing[16],
    marginBottom: spacing[12],
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[16],
    lineHeight: 22,
  },
  errorIdBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[12],
    marginBottom: spacing[16],
    width: '100%',
    alignItems: 'center',
  },
  errorIdLabel: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  errorIdText: {
    ...typography.body,
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  errorSourceText: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing[8],
  },
  errorBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[12],
    marginBottom: spacing[16],
    width: '100%',
    maxHeight: 300,
  },
  errorLabel: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing[4],
    fontWeight: '600',
  },
  errorText: {
    ...typography.small,
    color: colors.status.danger,
    fontFamily: 'monospace',
    marginBottom: spacing[8],
  },
  errorStack: {
    ...typography.small,
    color: colors.text.secondary,
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: spacing[4],
  },
  buttonContainer: {
    width: '100%',
    gap: spacing[12],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderRadius: borderRadius.lg,
    gap: spacing[8],
  },
  buttonPrimary: {
    backgroundColor: colors.brand.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  buttonTertiary: {
    backgroundColor: colors.background.tertiary,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});
