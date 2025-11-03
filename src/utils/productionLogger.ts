type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogContext {
  component?: string;
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

class ProductionLogger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = __DEV__;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const component = context?.component || 'Unknown';
    return `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
  }

  debug(message: string, data?: any, context?: LogContext): void {
    if (!this.isDevelopment) return;
    
    const formatted = this.formatMessage('debug', message, context);
    console.log(formatted, data || '');
  }

  info(message: string, data?: any, context?: LogContext): void {
    if (!this.isDevelopment) return;
    
    const formatted = this.formatMessage('info', message, context);
    console.log(formatted, data || '');
  }

  warn(message: string, data?: any, context?: LogContext): void {
    if (!this.isDevelopment) return;
    
    const formatted = this.formatMessage('warn', message, context);
    console.warn(formatted, data || '');
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const formatted = this.formatMessage('error', message, context);
    console.error(formatted, error || '');
  }

  critical(message: string, error?: Error | any, context?: LogContext): void {
    const formatted = this.formatMessage('critical', message, context);
    console.error('🚨 CRITICAL:', formatted, error || '');
  }
}

export const logger = new ProductionLogger();
