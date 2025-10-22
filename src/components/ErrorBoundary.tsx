import { logger } from '../utils/productionLogger';import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { palette, spacing } from '../ui/theme';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { logEvent } from '../store/devlog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { errorId } = this.state;
    
    // Log the error
    logEvent('ERROR_BOUNDARY_CAUGHT', {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
    });

    this.setState({
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
    });
  };

  handleReport = () => {
    const { error, errorInfo, errorId } = this.state;
    
    logEvent('ERROR_BOUNDARY_USER_REPORT', {
      errorId,
      userAction: 'report_requested',
      timestamp: Date.now(),
    });
    
    // This would typically open an email composer or feedback form
    logger.info('Error report requested:', {
      errorId,
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Card style={styles.errorCard}>
              <View style={styles.header}>
                <Ionicons name="warning" size={48} color={palette.error.main} />
                <Text style={styles.title}>Beklenmeyen Sorun</Text>
                <Text style={styles.subtitle}>
                  Uygulamada bir hata oluştu, ancak kritik işlevler aktif
                </Text>
              </View>

              <View style={styles.errorInfo}>
                <Text style={styles.errorId}>
                  Hata ID: {this.state.errorId}
                </Text>
                
                {(globalThis as any).__DEV__ && this.state.error && (
                  <View style={styles.debugInfo}>
                    <Text style={styles.debugTitle}>Geliştirici Bilgileri:</Text>
                    <Text style={styles.debugText}>
                      {this.state.error.message}
                    </Text>
                    {this.state.error.stack && (
                      <Text style={styles.debugText}>
                        {this.state.error.stack}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.actions}>
                <Button
                  label="Tekrar Dene"
                  onPress={this.handleRetry}
                  variant="primary"
                  style={styles.actionButton}
                />
                <Button
                  label="Sorun Bildir"
                  onPress={this.handleReport}
                  variant="ghost"
                  style={styles.actionButton}
                />
              </View>
            </Card>

            <Card title="Kritik İşlevler Aktif">
              <Text style={styles.functionText}>
                • SOS sinyali gönderme
              </Text>
              <Text style={styles.functionText}>
                • Acil durum iletişimi
              </Text>
              <Text style={styles.functionText}>
                • Konum belirleme
              </Text>
              <Text style={styles.functionText}>
                • Harita görüntüleme
              </Text>
              <Text style={styles.functionText}>
                • Temel ayarlar
              </Text>
            </Card>

            <Card title="Ne Yapabilirsiniz?">
              <Text style={styles.helpText}>
                • "Tekrar Dene" butonuna basarak uygulamayı yeniden yükleyin
              </Text>
              <Text style={styles.helpText}>
                • "Sorun Bildir" ile geliştirici ekibine bilgi verin
              </Text>
              <Text style={styles.helpText}>
                • Uygulamayı kapatıp yeniden açın
              </Text>
              <Text style={styles.helpText}>
                • Cihazınızı yeniden başlatın (gerekirse)
              </Text>
            </Card>
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
    backgroundColor: palette.background.primary,
  },
  content: {
    padding: spacing.lg,
  },
  errorCard: {
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: palette.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorInfo: {
    marginBottom: spacing.lg,
  },
  errorId: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: palette.text.secondary,
    backgroundColor: palette.background.secondary,
    padding: spacing.sm,
    borderRadius: 4,
    marginBottom: spacing.md,
  },
  debugInfo: {
    backgroundColor: palette.background.secondary,
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.sm,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: palette.text.secondary,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  functionText: {
    fontSize: 14,
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
  helpText: {
    fontSize: 14,
    color: palette.text.primary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
