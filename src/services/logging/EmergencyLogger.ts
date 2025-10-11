import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { Platform } from 'react-native';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'system' | 'emergency' | 'mesh' | 'sos' | 'location' | 'sensor' | 'voice' | 'security';
  message: string;
  details?: any;
  userId?: string;
  sessionId?: string;
  deviceInfo?: {
    platform: string;
    version: string;
    model?: string;
  };
  location?: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  stackTrace?: string;
  correlationId?: string;
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByCategory: Record<string, number>;
  errorsLast24h: number;
  criticalErrorsLast24h: number;
  oldestLog: number;
  newestLog: number;
}

export interface LogFilter {
  level?: string[];
  category?: string[];
  startTime?: number;
  endTime?: number;
  searchText?: string;
  limit?: number;
}

class EmergencyLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 10000; // Maximum logs to keep in memory
  private maxStorageSize = 50 * 1024 * 1024; // 50MB max storage
  private isInitialized = false;
  private sessionId: string;
  private userId: string = 'anonymous';
  private deviceInfo: any = {};
  private logLevel: string = 'info';
  private isDebugMode = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeLogger();
  }

  private async initializeLogger() {
    try {
      logger.debug('📝 Initializing Emergency Logger...');
      
      // Load device info
      this.deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        // model: Device.model, // Would need device info library
      };

      // Load stored logs
      await this.loadStoredLogs();
      
      // Set up automatic log rotation
      this.setupLogRotation();
      
      this.isInitialized = true;
      logger.debug('✅ Emergency Logger initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Emergency Logger:', error);
    }
  }

  // CRITICAL: Log Emergency Events
  logEmergency(level: LogEntry['level'], message: string, details?: any, location?: any): void {
    this.log('emergency', level, message, details, location);
  }

  // CRITICAL: Log SOS Events
  logSOS(level: LogEntry['level'], message: string, details?: any, location?: any): void {
    this.log('sos', level, message, details, location);
  }

  // CRITICAL: Log Mesh Network Events
  logMesh(level: LogEntry['level'], message: string, details?: any): void {
    this.log('mesh', level, message, details);
  }

  // CRITICAL: Log System Events
  logSystem(level: LogEntry['level'], message: string, details?: any): void {
    this.log('system', level, message, details);
  }

  // CRITICAL: Log Security Events
  logSecurity(level: LogEntry['level'], message: string, details?: any): void {
    this.log('security', level, message, details);
  }

  // CRITICAL: Log Location Events
  logLocation(level: LogEntry['level'], message: string, details?: any, location?: any): void {
    this.log('location', level, message, details, location);
  }

  // CRITICAL: Log Sensor Events
  logSensor(level: LogEntry['level'], message: string, details?: any): void {
    this.log('sensor', level, message, details);
  }

  // CRITICAL: Log Voice Command Events
  logVoice(level: LogEntry['level'], message: string, details?: any): void {
    this.log('voice', level, message, details);
  }

  // Main logging method
  private log(category: LogEntry['category'], level: LogEntry['level'], message: string, details?: any, location?: any): void {
    try {
      // Skip logs below current level
      if (!this.shouldLog(level)) return;

      const logEntry: LogEntry = {
        id: this.generateLogId(),
        timestamp: Date.now(),
        level,
        category,
        message: message.substring(0, 1000), // Limit message length
        details: this.sanitizeDetails(details),
        userId: this.userId,
        sessionId: this.sessionId,
        deviceInfo: this.deviceInfo,
        location: location ? {
          lat: Math.round(location.lat * 1000000) / 1000000,
          lon: Math.round(location.lon * 1000000) / 1000000,
          accuracy: location.accuracy || 0,
        } : undefined,
        correlationId: this.generateCorrelationId(),
      };

      // Add stack trace for errors
      if (level === 'error' || level === 'critical') {
        logEntry.stackTrace = this.getStackTrace();
      }

      // Add to memory
      this.logs.push(logEntry);

      // Console output for development
      if (this.isDebugMode || level === 'error' || level === 'critical') {
        this.outputToConsole(logEntry);
      }

      // Immediate storage for critical logs
      if (level === 'critical') {
        this.storeLogImmediately(logEntry);
      }

      // Automatic storage (batched)
      this.scheduleStorage();

      // Rotate logs if needed
      this.rotateLogsIfNeeded();

    } catch (error) {
      logger.error('❌ Logging error:', error);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'critical'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex >= currentLevelIndex;
  }

  private sanitizeDetails(details: any): any {
    if (!details) return undefined;

    try {
      // Remove sensitive information
      const sanitized = JSON.parse(JSON.stringify(details, (key, value) => {
        // Remove sensitive keys
        const sensitiveKeys = ['password', 'token', 'key', 'secret', 'private'];
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          return '[REDACTED]';
        }
        return value;
      }));

      // Limit size
      const serialized = JSON.stringify(sanitized);
      if (serialized.length > 5000) {
        return { error: 'Details too large', size: serialized.length };
      }

      return sanitized;

    } catch (error) {
      return { error: 'Failed to sanitize details', original: String(details) };
    }
  }

  private outputToConsole(logEntry: LogEntry): void {
    const timestamp = new Date(logEntry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${logEntry.level.toUpperCase()}] [${logEntry.category}]`;
    const message = `${prefix} ${logEntry.message}`;

    switch (logEntry.level) {
      case 'debug':
        console.debug(message, logEntry.details);
        break;
      case 'info':
        logger.info(message, logEntry.details);
        break;
      case 'warn':
        logger.warn(message, logEntry.details);
        break;
      case 'error':
        logger.error(message, logEntry.details);
        break;
      case 'critical':
        logger.error(`🚨 CRITICAL: ${message}`, logEntry.details);
        break;
    }
  }

  private async storeLogImmediately(logEntry: LogEntry): Promise<void> {
    try {
      await AsyncStorage.setItem(`critical_log_${logEntry.id}`, JSON.stringify(logEntry));
    } catch (error) {
      logger.error('❌ Failed to store critical log:', error);
    }
  }

  private scheduleStorage(): void {
    // Debounced storage to avoid too frequent writes
    if (!this.storageTimeout) {
      this.storageTimeout = setTimeout(() => {
        this.storeLogs();
        this.storageTimeout = null;
      }, 5000); // Store every 5 seconds
    }
  }

  private storageTimeout: NodeJS.Timeout | null = null;

  private async storeLogs(): Promise<void> {
    try {
      const logsToStore = this.logs.slice(-1000); // Store last 1000 logs
      await AsyncStorage.setItem('emergency_logs', JSON.stringify(logsToStore));
      
      // Store log stats
      const stats = this.getLogStats();
      await AsyncStorage.setItem('log_stats', JSON.stringify(stats));
      
    } catch (error) {
      logger.error('❌ Failed to store logs:', error);
    }
  }

  private async loadStoredLogs(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('emergency_logs');
      if (stored) {
        const parsedLogs = JSON.parse(stored);
        this.logs = Array.isArray(parsedLogs) ? parsedLogs : [];
      }
    } catch (error) {
      logger.error('❌ Failed to load stored logs:', error);
    }
  }

  private rotateLogsIfNeeded(): void {
    if (this.logs.length > this.maxLogs) {
      // Keep only the most recent logs
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private setupLogRotation(): void {
    // Clean up old logs every hour
    setInterval(() => {
      this.cleanupOldLogs();
    }, 60 * 60 * 1000);
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      // Remove logs older than 24 hours (except critical logs)
      this.logs = this.logs.filter(log => 
        log.timestamp > oneDayAgo || log.level === 'critical'
      );

      // Clean up stored critical logs older than 7 days
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const keys = await AsyncStorage.getAllKeys();
      const criticalLogKeys = keys.filter(key => key.startsWith('critical_log_'));
      
      for (const key of criticalLogKeys) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const log = JSON.parse(stored);
            if (log.timestamp < sevenDaysAgo) {
              await AsyncStorage.removeItem(key);
            }
          }
        } catch (error) {
          logger.error(`❌ Failed to cleanup log ${key}:`, error);
        }
      }

    } catch (error) {
      logger.error('❌ Failed to cleanup old logs:', error);
    }
  }

  // Query logs
  async queryLogs(filter: LogFilter = {}): Promise<LogEntry[]> {
    try {
      let filteredLogs = [...this.logs];

      // Apply filters
      if (filter.level && filter.level.length > 0) {
        filteredLogs = filteredLogs.filter(log => filter.level!.includes(log.level));
      }

      if (filter.category && filter.category.length > 0) {
        filteredLogs = filteredLogs.filter(log => filter.category!.includes(log.category));
      }

      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime!);
      }

      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        filteredLogs = filteredLogs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
        );
      }

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(0, filter.limit);
      }

      return filteredLogs;

    } catch (error) {
      logger.error('❌ Failed to query logs:', error);
      return [];
    }
  }

  // Export logs for debugging
  async exportLogs(filter: LogFilter = {}): Promise<string> {
    try {
      const logs = await this.queryLogs(filter);
      const exportData = {
        exportTimestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        deviceInfo: this.deviceInfo,
        filter,
        logs,
        stats: this.getLogStats(),
      };

      return JSON.stringify(exportData, null, 2);

    } catch (error) {
      logger.error('❌ Failed to export logs:', error);
      return JSON.stringify({ error: 'Export failed', message: String(error) });
    }
  }

  // Get log statistics
  getLogStats(): LogStats {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    const logsLast24h = this.logs.filter(log => log.timestamp > oneDayAgo);
    
    const logsByLevel: Record<string, number> = {};
    const logsByCategory: Record<string, number> = {};
    
    logsLast24h.forEach(log => {
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
    });

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByCategory,
      errorsLast24h: logsLast24h.filter(log => log.level === 'error').length,
      criticalErrorsLast24h: logsLast24h.filter(log => log.level === 'critical').length,
      oldestLog: this.logs.length > 0 ? Math.min(...this.logs.map(log => log.timestamp)) : now,
      newestLog: this.logs.length > 0 ? Math.max(...this.logs.map(log => log.timestamp)) : now,
    };
  }

  // Configuration methods
  setLogLevel(level: string): void {
    this.logLevel = level;
    this.logSystem('info', `Log level changed to ${level}`);
  }

  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
    this.logSystem('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  setUserId(userId: string): void {
    this.userId = userId;
    this.logSystem('info', `User ID set to ${userId}`);
  }

  // Utility methods
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private getStackTrace(): string {
    try {
      throw new Error();
    } catch (error: Error | unknown) {
      return error.stack || 'No stack trace available';
    }
  }

  // Emergency log export (for rescue situations)
  async exportEmergencyLogs(): Promise<string> {
    const emergencyFilter: LogFilter = {
      category: ['emergency', 'sos', 'critical'],
      limit: 1000,
    };
    
    return await this.exportLogs(emergencyFilter);
  }

  // Clear all logs (use with caution)
  async clearAllLogs(): Promise<void> {
    try {
      this.logs = [];
      await AsyncStorage.removeItem('emergency_logs');
      await AsyncStorage.removeItem('log_stats');
      
      // Clear individual critical logs
      const keys = await AsyncStorage.getAllKeys();
      const criticalLogKeys = keys.filter(key => key.startsWith('critical_log_'));
      await AsyncStorage.multiRemove(criticalLogKeys);
      
      this.logSystem('warn', 'All logs cleared');
      
    } catch (error) {
      logger.error('❌ Failed to clear logs:', error);
    }
  }
}

// Export singleton instance
export const emergencyLogger = new EmergencyLogger();
export default EmergencyLogger;

