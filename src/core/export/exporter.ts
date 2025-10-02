import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { HelpRequestRepository } from '../data/repositories';
import { database } from '../data/db';
import { HelpRequest, ResourcePost, DamageReport } from '../data/models';

export interface ExportOptions {
  format: 'csv' | 'geojson';
  timeRange: '24h' | '72h' | 'all';
  includeLocation: boolean;
  includeNotes: boolean;
  jitterRadius: number; // meters
  stripPersonalInfo: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  recordCount: number;
  error?: string;
}

export class DataExporter {
  private static instance: DataExporter;

  private constructor() {}

  static getInstance(): DataExporter {
    if (!DataExporter.instance) {
      DataExporter.instance = new DataExporter();
    }
    return DataExporter.instance;
  }

  async exportHelpRequests(options: ExportOptions): Promise<ExportResult> {
    try {
      const cutoffTime = this.getCutoffTime(options.timeRange);
      const helpRequests = await HelpRequestRepository.getByTimeRange(cutoffTime);
      
      const maskedData = helpRequests.map(request => this.maskHelpRequest(request, options));
      
      const filePath = await this.writeToFile(
        'help_requests',
        maskedData,
        options.format
      );

      return {
        success: true,
        filePath,
        recordCount: maskedData.length,
      };
    } catch (error) {
      console.error('Failed to export help requests:', error);
      return {
        success: false,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async exportResourcePosts(options: ExportOptions): Promise<ExportResult> {
    try {
      const cutoffTime = this.getCutoffTime(options.timeRange);
      const resourcePosts = await this.getResourcePosts(cutoffTime);
      
      const maskedData = resourcePosts.map(post => this.maskResourcePost(post, options));
      
      const filePath = await this.writeToFile(
        'resource_posts',
        maskedData,
        options.format
      );

      return {
        success: true,
        filePath,
        recordCount: maskedData.length,
      };
    } catch (error) {
      console.error('Failed to export resource posts:', error);
      return {
        success: false,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async exportDamageReports(options: ExportOptions): Promise<ExportResult> {
    try {
      const cutoffTime = this.getCutoffTime(options.timeRange);
      const damageReports = await this.getDamageReports(cutoffTime);
      
      const maskedData = damageReports.map(report => this.maskDamageReport(report, options));
      
      const filePath = await this.writeToFile(
        'damage_reports',
        maskedData,
        options.format
      );

      return {
        success: true,
        filePath,
        recordCount: maskedData.length,
      };
    } catch (error) {
      console.error('Failed to export damage reports:', error);
      return {
        success: false,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async exportAll(options: ExportOptions): Promise<{
    helpRequests: ExportResult;
    resourcePosts: ExportResult;
    damageReports: ExportResult;
  }> {
    const [helpRequests, resourcePosts, damageReports] = await Promise.all([
      this.exportHelpRequests(options),
      this.exportResourcePosts(options),
      this.exportDamageReports(options),
    ]);

    return {
      helpRequests,
      resourcePosts,
      damageReports,
    };
  }

  private getCutoffTime(timeRange: '24h' | '72h' | 'all'): number {
    const now = Date.now();
    
    switch (timeRange) {
      case '24h':
        return now - (24 * 60 * 60 * 1000);
      case '72h':
        return now - (72 * 60 * 60 * 1000);
      case 'all':
      default:
        return 0;
    }
  }

  private maskHelpRequest(request: HelpRequest, options: ExportOptions): any {
    const base = {
      id: request.id,
      timestamp: request.ts,
      priority: request.priority,
      underRubble: request.underRubble,
      injured: request.injured,
      peopleCount: request.peopleCount,
      battery: request.battery,
      anonymity: request.anonymity,
      ttl: request.ttl,
      delivered: request.delivered,
      hops: request.hops,
      source: request.source,
    };

    if (options.includeLocation) {
      const location = this.jitterLocation(
        request.lat,
        request.lon,
        options.jitterRadius
      );
      base.latitude = location.lat;
      base.longitude = location.lon;
      base.accuracy = request.accuracy;
    }

    if (options.includeNotes && !options.stripPersonalInfo) {
      base.note = request.note;
    }

    return base;
  }

  private maskResourcePost(post: any, options: ExportOptions): any {
    const base = {
      id: post.id,
      timestamp: post.ts,
      type: post.type,
      qty: post.qty,
    };

    if (options.includeLocation) {
      const location = this.jitterLocation(
        post.lat,
        post.lon,
        options.jitterRadius
      );
      base.latitude = location.lat;
      base.longitude = location.lon;
    }

    if (options.includeNotes && !options.stripPersonalInfo) {
      base.description = post.description;
    }

    return base;
  }

  private maskDamageReport(report: any, options: ExportOptions): any {
    const base = {
      id: report.id,
      timestamp: report.ts,
      type: report.type,
      severity: report.severity,
      confirmed: report.confirmed,
      delivered: report.delivered,
      source: report.source,
    };

    if (options.includeLocation) {
      const location = this.jitterLocation(
        report.lat,
        report.lon,
        options.jitterRadius
      );
      base.latitude = location.lat;
      base.longitude = location.lon;
      base.accuracy = report.accuracy;
    }

    if (options.includeNotes && !options.stripPersonalInfo) {
      base.description = report.description;
      base.reporterName = report.reporterName;
      base.reporterPhone = this.maskPhoneNumber(report.reporterPhone);
    }

    return base;
  }

  private jitterLocation(lat: number, lon: number, radiusMeters: number): {
    lat: number;
    lon: number;
  } {
    // Convert radius from meters to approximate degrees
    const latRadius = radiusMeters / 111000; // Rough conversion
    const lonRadius = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));

    // Generate random jitter within radius
    const randomLat = (Math.random() - 0.5) * 2 * latRadius;
    const randomLon = (Math.random() - 0.5) * 2 * lonRadius;

    return {
      lat: lat + randomLat,
      lon: lon + randomLon,
    };
  }

  private maskPhoneNumber(phone?: string): string | undefined {
    if (!phone || options.stripPersonalInfo) {
      return undefined;
    }

    // Mask phone number: keep country code and last 3 digits
    if (phone.length > 6) {
      const countryCode = phone.substring(0, 3);
      const lastDigits = phone.substring(phone.length - 3);
      return `${countryCode}****${lastDigits}`;
    }

    return '***';
  }

  private async writeToFile(
    dataType: string,
    data: any[],
    format: 'csv' | 'geojson'
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${dataType}_${timestamp}.${format}`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    let content: string;

    if (format === 'csv') {
      content = this.convertToCSV(data);
    } else {
      content = this.convertToGeoJSON(data);
    }

    await FileSystem.writeAsStringAsync(filePath, content);
    return filePath;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape CSV values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }

  private convertToGeoJSON(data: any[]): string {
    const features = data
      .filter(item => item.latitude && item.longitude)
      .map(item => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.longitude, item.latitude],
        },
        properties: {
          ...item,
          latitude: undefined,
          longitude: undefined,
        },
      }));

    const geojson = {
      type: 'FeatureCollection',
      features,
    };

    return JSON.stringify(geojson, null, 2);
  }

  async shareFile(filePath: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing not available');
      }

      await Sharing.shareAsync(filePath);
      return true;
    } catch (error) {
      console.error('Failed to share file:', error);
      return false;
    }
  }

  async cleanupExportFiles(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
      const exportFiles = files.filter(file => 
        file.match(/_(help_requests|resource_posts|damage_reports)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.(csv|geojson)$/)
      );

      // Delete files older than 7 days
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      for (const file of exportFiles) {
        const filePath = `${FileSystem.documentDirectory}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        
        if (info.exists && info.modificationTime && info.modificationTime * 1000 < weekAgo) {
          await FileSystem.deleteAsync(filePath);
        }
      }

      console.log('Export files cleaned up');
    } catch (error) {
      console.error('Failed to cleanup export files:', error);
    }
  }

  private async getResourcePosts(cutoffTime: number): Promise<any[]> {
    // This would query the database for resource posts
    // For now, return empty array
    return [];
  }

  private async getDamageReports(cutoffTime: number): Promise<any[]> {
    // This would query the database for damage reports
    // For now, return empty array
    return [];
  }
}
