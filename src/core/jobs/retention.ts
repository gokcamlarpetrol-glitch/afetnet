import { database } from '../data/db';
import { HelpRequest, ResourcePost, DamageReport, StatusPing } from '../data/models';
import { PreferencesManager } from '../storage/prefs';

export interface RetentionConfig {
  helpRequestsDays: number;
  resourcePostsDays: number;
  damageReportsDays: number;
  statusPingsDays: number;
  enableAutoCleanup: boolean;
  cleanupIntervalHours: number;
}

export interface CleanupStats {
  helpRequestsDeleted: number;
  resourcePostsDeleted: number;
  damageReportsDeleted: number;
  statusPingsDeleted: number;
  totalDeleted: number;
  lastCleanup: number;
}

export class DataRetentionManager {
  private static instance: DataRetentionManager;
  private config: RetentionConfig;
  private lastCleanupTime: number = 0;

  private constructor() {
    this.config = {
      helpRequestsDays: 30,
      resourcePostsDays: 30,
      damageReportsDays: 30,
      statusPingsDays: 7,
      enableAutoCleanup: true,
      cleanupIntervalHours: 24,
    };
  }

  static getInstance(): DataRetentionManager {
    if (!DataRetentionManager.instance) {
      DataRetentionManager.instance = new DataRetentionManager();
    }
    return DataRetentionManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Load preferences
      const preferencesManager = PreferencesManager.getInstance();
      await preferencesManager.initialize();

      // Set up auto cleanup if enabled
      if (this.config.enableAutoCleanup) {
        this.scheduleAutoCleanup();
      }

      console.log('DataRetentionManager initialized');
    } catch (error) {
      console.error('Failed to initialize DataRetentionManager:', error);
    }
  }

  async purgeOldRecords(): Promise<CleanupStats> {
    try {
      const stats: CleanupStats = {
        helpRequestsDeleted: 0,
        resourcePostsDeleted: 0,
        damageReportsDeleted: 0,
        statusPingsDeleted: 0,
        totalDeleted: 0,
        lastCleanup: Date.now(),
      };

      // Calculate cutoff timestamps
      const now = Date.now();
      const helpRequestsCutoff = now - (this.config.helpRequestsDays * 24 * 60 * 60 * 1000);
      const resourcePostsCutoff = now - (this.config.resourcePostsDays * 24 * 60 * 60 * 1000);
      const damageReportsCutoff = now - (this.config.damageReportsDays * 24 * 60 * 60 * 1000);
      const statusPingsCutoff = now - (this.config.statusPingsDays * 24 * 60 * 60 * 1000);

      // Clean up help requests
      const helpRequestsToDelete = await database.collections
        .get<HelpRequest>('help_requests')
        .query()
        .where('ts', 'lt', helpRequestsCutoff)
        .fetch();

      for (const request of helpRequestsToDelete) {
        await request.destroyPermanently();
        stats.helpRequestsDeleted++;
      }

      // Clean up resource posts
      const resourcePostsToDelete = await database.collections
        .get<ResourcePost>('resource_posts')
        .query()
        .where('ts', 'lt', resourcePostsCutoff)
        .fetch();

      for (const post of resourcePostsToDelete) {
        await post.destroyPermanently();
        stats.resourcePostsDeleted++;
      }

      // Clean up damage reports
      const damageReportsToDelete = await database.collections
        .get<DamageReport>('damage_reports')
        .query()
        .where('ts', 'lt', damageReportsCutoff)
        .fetch();

      for (const report of damageReportsToDelete) {
        await report.destroyPermanently();
        stats.damageReportsDeleted++;
      }

      // Clean up status pings
      const statusPingsToDelete = await database.collections
        .get<StatusPing>('status_pings')
        .query()
        .where('ts', 'lt', statusPingsCutoff)
        .fetch();

      for (const ping of statusPingsToDelete) {
        await ping.destroyPermanently();
        stats.statusPingsDeleted++;
      }

      stats.totalDeleted = 
        stats.helpRequestsDeleted +
        stats.resourcePostsDeleted +
        stats.damageReportsDeleted +
        stats.statusPingsDeleted;

      this.lastCleanupTime = stats.lastCleanup;

      console.log(`Data retention cleanup completed: ${stats.totalDeleted} records deleted`);
      return stats;
    } catch (error) {
      console.error('Failed to purge old records:', error);
      throw error;
    }
  }

  async purgeSpecificRecordType(
    recordType: 'help_requests' | 'resource_posts' | 'damage_reports' | 'status_pings',
    daysOld: number
  ): Promise<number> {
    try {
      const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      const recordsToDelete = await database.collections
        .get(recordType)
        .query()
        .where('ts', 'lt', cutoff)
        .fetch();

      let deletedCount = 0;
      for (const record of recordsToDelete) {
        await record.destroyPermanently();
        deletedCount++;
      }

      console.log(`Deleted ${deletedCount} ${recordType} older than ${daysOld} days`);
      return deletedCount;
    } catch (error) {
      console.error(`Failed to purge ${recordType}:`, error);
      throw error;
    }
  }

  async getRetentionStats(): Promise<{
    totalRecords: number;
    oldestRecord: number;
    newestRecord: number;
    recordsByType: Record<string, number>;
    nextCleanup: number;
  }> {
    try {
      const now = Date.now();
      const recordsByType: Record<string, number> = {};

      // Count records by type
      const helpRequests = await database.collections.get<HelpRequest>('help_requests').query().fetchCount();
      const resourcePosts = await database.collections.get<ResourcePost>('resource_posts').query().fetchCount();
      const damageReports = await database.collections.get<DamageReport>('damage_reports').query().fetchCount();
      const statusPings = await database.collections.get<StatusPing>('status_pings').query().fetchCount();

      recordsByType.help_requests = helpRequests;
      recordsByType.resource_posts = resourcePosts;
      recordsByType.damage_reports = damageReports;
      recordsByType.status_pings = statusPings;

      const totalRecords = helpRequests + resourcePosts + damageReports + statusPings;

      // Find oldest and newest records
      let oldestRecord = now;
      let newestRecord = 0;

      const allRecords = await Promise.all([
        database.collections.get<HelpRequest>('help_requests').query().fetch(),
        database.collections.get<ResourcePost>('resource_posts').query().fetch(),
        database.collections.get<DamageReport>('damage_reports').query().fetch(),
        database.collections.get<StatusPing>('status_pings').query().fetch(),
      ]);

      for (const records of allRecords) {
        for (const record of records) {
          const timestamp = record.ts;
          if (timestamp < oldestRecord) {
            oldestRecord = timestamp;
          }
          if (timestamp > newestRecord) {
            newestRecord = timestamp;
          }
        }
      }

      // Calculate next cleanup time
      const nextCleanup = this.lastCleanupTime + (this.config.cleanupIntervalHours * 60 * 60 * 1000);

      return {
        totalRecords,
        oldestRecord,
        newestRecord,
        recordsByType,
        nextCleanup,
      };
    } catch (error) {
      console.error('Failed to get retention stats:', error);
      throw error;
    }
  }

  getConfig(): RetentionConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<RetentionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reschedule auto cleanup if interval changed
    if (newConfig.cleanupIntervalHours || newConfig.enableAutoCleanup) {
      this.scheduleAutoCleanup();
    }
  }

  private scheduleAutoCleanup(): void {
    if (!this.config.enableAutoCleanup) {
      return;
    }

    const intervalMs = this.config.cleanupIntervalHours * 60 * 60 * 1000;
    
    // Schedule cleanup
    setInterval(async () => {
      try {
        await this.purgeOldRecords();
      } catch (error) {
        console.error('Auto cleanup failed:', error);
      }
    }, intervalMs);

    console.log(`Auto cleanup scheduled every ${this.config.cleanupIntervalHours} hours`);
  }

  async forceCleanup(): Promise<CleanupStats> {
    console.log('Forcing data retention cleanup...');
    return this.purgeOldRecords();
  }

  async exportRetentionPolicy(): Promise<string> {
    return JSON.stringify({
      config: this.config,
      lastCleanup: this.lastCleanupTime,
      exportedAt: Date.now(),
    }, null, 2);
  }

  async importRetentionPolicy(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.config) {
        this.updateConfig(data.config);
      }
      
      if (data.lastCleanup) {
        this.lastCleanupTime = data.lastCleanup;
      }
      
      console.log('Retention policy imported successfully');
    } catch (error) {
      console.error('Failed to import retention policy:', error);
      throw error;
    }
  }

  async resetAllData(): Promise<void> {
    try {
      // This is a destructive operation - use with caution
      const collections = ['help_requests', 'resource_posts', 'damage_reports', 'status_pings'];
      
      for (const collectionName of collections) {
        const records = await database.collections.get(collectionName).query().fetch();
        for (const record of records) {
          await record.destroyPermanently();
        }
      }
      
      console.log('All data reset completed');
    } catch (error) {
      console.error('Failed to reset all data:', error);
      throw error;
    }
  }
}
