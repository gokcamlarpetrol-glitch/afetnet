import { database } from './db';
import { HelpRequest, StatusPing, ResourcePost, Shelter, DevicePeer, FamilyMember, DamageReport, Priority, ResourceType, MessageSource, DamageType, DamageSeverity } from './models';

export class HelpRequestRepository {
  static async create(data: {
    ts: number;
    lat: number;
    lon: number;
    accuracy: number;
    priority: Priority;
    underRubble: boolean;
    injured: boolean;
    peopleCount: number;
    note?: string;
    battery?: number;
    anonymity: boolean;
    ttl: number;
    signature: string;
    delivered: boolean;
    hops: number;
    source: MessageSource;
  }): Promise<HelpRequest> {
    return await database.write(async () => {
      return await database.collections
        .get<HelpRequest>('help_requests')
        .create(helpRequest => {
          helpRequest.ts = data.ts;
          helpRequest.lat = data.lat;
          helpRequest.lon = data.lon;
          helpRequest.accuracy = data.accuracy;
          helpRequest.priority = data.priority;
          helpRequest.underRubble = data.underRubble;
          helpRequest.injured = data.injured;
          helpRequest.peopleCount = data.peopleCount;
          helpRequest.note = data.note;
          helpRequest.battery = data.battery;
          helpRequest.anonymity = data.anonymity;
          helpRequest.ttl = data.ttl;
          helpRequest.signature = data.signature;
          helpRequest.delivered = data.delivered;
          helpRequest.hops = data.hops;
          helpRequest.source = data.source;
        });
    });
  }

  static async getAll(): Promise<HelpRequest[]> {
    return await database.collections
      .get<HelpRequest>('help_requests')
      .query()
      .fetch();
  }

  static async getByPriority(priority: Priority): Promise<HelpRequest[]> {
    return await database.collections
      .get<HelpRequest>('help_requests')
      .query()
      .where('priority', priority)
      .fetch();
  }

  static async getRecent(limit: number = 50): Promise<HelpRequest[]> {
    return await database.collections
      .get<HelpRequest>('help_requests')
      .query()
      .sortBy('ts', 'desc')
      .take(limit)
      .fetch();
  }

  static async markAsDelivered(id: string): Promise<void> {
    await database.write(async () => {
      const helpRequest = await database.collections
        .get<HelpRequest>('help_requests')
        .find(id);
      
      await helpRequest.update(hr => {
        hr.delivered = true;
      });
    });
  }
}

export class StatusPingRepository {
  static async create(data: {
    ts: number;
    lat: number;
    lon: number;
    battery?: number;
    note?: string;
  }): Promise<StatusPing> {
    return await database.write(async () => {
      return await database.collections
        .get<StatusPing>('status_pings')
        .create(statusPing => {
          statusPing.ts = data.ts;
          statusPing.lat = data.lat;
          statusPing.lon = data.lon;
          statusPing.battery = data.battery;
          statusPing.note = data.note;
        });
    });
  }

  static async getRecent(limit: number = 20): Promise<StatusPing[]> {
    return await database.collections
      .get<StatusPing>('status_pings')
      .query()
      .sortBy('ts', 'desc')
      .take(limit)
      .fetch();
  }
}

export class ResourcePostRepository {
  static async create(data: {
    ts: number;
    type: ResourceType;
    qty: string;
    lat: number;
    lon: number;
    desc?: string;
  }): Promise<ResourcePost> {
    return await database.write(async () => {
      return await database.collections
        .get<ResourcePost>('resource_posts')
        .create(resourcePost => {
          resourcePost.ts = data.ts;
          resourcePost.type = data.type;
          resourcePost.qty = data.qty;
          resourcePost.lat = data.lat;
          resourcePost.lon = data.lon;
          resourcePost.desc = data.desc;
        });
    });
  }

  static async getByType(type: ResourceType): Promise<ResourcePost[]> {
    return await database.collections
      .get<ResourcePost>('resource_posts')
      .query()
      .where('type', type)
      .fetch();
  }

  static async getRecent(limit: number = 50): Promise<ResourcePost[]> {
    return await database.collections
      .get<ResourcePost>('resource_posts')
      .query()
      .sortBy('ts', 'desc')
      .take(limit)
      .fetch();
  }
}

export class ShelterRepository {
  static async create(data: {
    name: string;
    lat: number;
    lon: number;
    capacity: number;
    open: boolean;
  }): Promise<Shelter> {
    return await database.write(async () => {
      return await database.collections
        .get<Shelter>('shelters')
        .create(shelter => {
          shelter.name = data.name;
          shelter.lat = data.lat;
          shelter.lon = data.lon;
          shelter.capacity = data.capacity;
          shelter.open = data.open;
          shelter.updatedAt = Date.now();
        });
    });
  }

  static async getAll(): Promise<Shelter[]> {
    return await database.collections
      .get<Shelter>('shelters')
      .query()
      .fetch();
  }

  static async getOpen(): Promise<Shelter[]> {
    return await database.collections
      .get<Shelter>('shelters')
      .query()
      .where('open', true)
      .fetch();
  }

  static async updateCapacity(id: string, capacity: number): Promise<void> {
    await database.write(async () => {
      const shelter = await database.collections
        .get<Shelter>('shelters')
        .find(id);
      
      await shelter.update(s => {
        s.capacity = capacity;
        s.updatedAt = Date.now();
      });
    });
  }
}

export class DevicePeerRepository {
  static async create(data: {
    lastSeenTs: number;
    rssiAvg?: number;
    hopsMin?: number;
  }): Promise<DevicePeer> {
    return await database.write(async () => {
      return await database.collections
        .get<DevicePeer>('device_peers')
        .create(devicePeer => {
          devicePeer.lastSeenTs = data.lastSeenTs;
          devicePeer.rssiAvg = data.rssiAvg;
          devicePeer.hopsMin = data.hopsMin;
        });
    });
  }

  static async updateLastSeen(id: string, lastSeenTs: number): Promise<void> {
    await database.write(async () => {
      const devicePeer = await database.collections
        .get<DevicePeer>('device_peers')
        .find(id);
      
      await devicePeer.update(dp => {
        dp.lastSeenTs = lastSeenTs;
      });
    });
  }

  static async getActive(withinMinutes: number = 10): Promise<DevicePeer[]> {
    const cutoff = Date.now() - (withinMinutes * 60 * 1000);
    return await database.collections
      .get<DevicePeer>('device_peers')
      .query()
      .where('last_seen_ts', 'gt', cutoff)
      .fetch();
  }
}

export class FamilyMemberRepository {
  private static instance: FamilyMemberRepository;

  static getInstance(): FamilyMemberRepository {
    if (!FamilyMemberRepository.instance) {
      FamilyMemberRepository.instance = new FamilyMemberRepository();
    }
    return FamilyMemberRepository.instance;
  }

  async create(data: {
    name: string;
    phoneNumber?: string;
    email?: string;
    shareCode: string;
    lastSeen: number;
    isOnline: boolean;
    trustLevel: number;
    addedAt: number;
  }): Promise<FamilyMember> {
    return await database.write(async () => {
      return await database.collections
        .get<FamilyMember>('family_members')
        .create(familyMember => {
          familyMember.name = data.name;
          familyMember.phoneNumber = data.phoneNumber;
          familyMember.email = data.email;
          familyMember.shareCode = data.shareCode;
          familyMember.lastSeen = data.lastSeen;
          familyMember.isOnline = data.isOnline;
          familyMember.trustLevel = data.trustLevel;
          familyMember.addedAt = data.addedAt;
        });
    });
  }

  async getAll(): Promise<FamilyMember[]> {
    return await database.collections
      .get<FamilyMember>('family_members')
      .query()
      .fetch();
  }

  async getByShareCode(shareCode: string): Promise<FamilyMember | null> {
    const members = await database.collections
      .get<FamilyMember>('family_members')
      .query()
      .where('share_code', shareCode)
      .fetch();
    
    return members.length > 0 ? members[0] : null;
  }

  async getOnline(): Promise<FamilyMember[]> {
    return await database.collections
      .get<FamilyMember>('family_members')
      .query()
      .where('is_online', true)
      .fetch();
  }

  async updateLastSeen(id: string, lastSeen: number): Promise<void> {
    await database.write(async () => {
      const familyMember = await database.collections
        .get<FamilyMember>('family_members')
        .find(id);
      
      await familyMember.update(fm => {
        fm.lastSeen = lastSeen;
        fm.isOnline = true;
      });
    });
  }

  async setOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await database.write(async () => {
      const familyMember = await database.collections
        .get<FamilyMember>('family_members')
        .find(id);
      
      await familyMember.update(fm => {
        fm.isOnline = isOnline;
      });
    });
  }

  async updateTrustLevel(id: string, trustLevel: number): Promise<void> {
    await database.write(async () => {
      const familyMember = await database.collections
        .get<FamilyMember>('family_members')
        .find(id);
      
      await familyMember.update(fm => {
        fm.trustLevel = Math.max(1, Math.min(5, trustLevel));
      });
    });
  }

  async update(id: string, updates: Partial<{
    name: string;
    phoneNumber?: string;
    email?: string;
    shareCode: string;
    trustLevel: number;
  }>): Promise<void> {
    await database.write(async () => {
      const familyMember = await database.collections
        .get<FamilyMember>('family_members')
        .find(id);
      
      await familyMember.update(fm => {
        if (updates.name !== undefined) fm.name = updates.name;
        if (updates.phoneNumber !== undefined) fm.phoneNumber = updates.phoneNumber;
        if (updates.email !== undefined) fm.email = updates.email;
        if (updates.shareCode !== undefined) fm.shareCode = updates.shareCode;
        if (updates.trustLevel !== undefined) fm.trustLevel = updates.trustLevel;
      });
    });
  }

  async delete(id: string): Promise<void> {
    await database.write(async () => {
      const familyMember = await database.collections
        .get<FamilyMember>('family_members')
        .find(id);
      
      await familyMember.destroyPermanently();
    });
  }

  async getRecentActivity(withinHours: number = 24): Promise<FamilyMember[]> {
    const cutoff = Date.now() - (withinHours * 60 * 60 * 1000);
    return await database.collections
      .get<FamilyMember>('family_members')
      .query()
      .where('last_seen', 'gt', cutoff)
      .sortBy('last_seen', 'desc')
      .fetch();
  }
}

export class DamageReportRepository {
  private static instance: DamageReportRepository;

  static getInstance(): DamageReportRepository {
    if (!DamageReportRepository.instance) {
      DamageReportRepository.instance = new DamageReportRepository();
    }
    return DamageReportRepository.instance;
  }

  async create(data: {
    ts: number;
    lat: number;
    lon: number;
    accuracy: number;
    type: DamageType;
    severity: DamageSeverity;
    description?: string;
    photoPath?: string;
    reporterName?: string;
    reporterPhone?: string;
    confirmed: boolean;
    delivered: boolean;
    source: MessageSource;
  }): Promise<DamageReport> {
    return await database.write(async () => {
      return await database.collections
        .get<DamageReport>('damage_reports')
        .create(damageReport => {
          damageReport.ts = data.ts;
          damageReport.lat = data.lat;
          damageReport.lon = data.lon;
          damageReport.accuracy = data.accuracy;
          damageReport.type = data.type;
          damageReport.severity = data.severity;
          damageReport.description = data.description;
          damageReport.photoPath = data.photoPath;
          damageReport.reporterName = data.reporterName;
          damageReport.reporterPhone = data.reporterPhone;
          damageReport.confirmed = data.confirmed;
          damageReport.delivered = data.delivered;
          damageReport.source = data.source;
        });
    });
  }

  async getAll(): Promise<DamageReport[]> {
    return await database.collections
      .get<DamageReport>('damage_reports')
      .query()
      .fetch();
  }

  async getByType(type: DamageType): Promise<DamageReport[]> {
    return await database.collections
      .get<DamageReport>('damage_reports')
      .query()
      .where('type', type)
      .fetch();
  }

  async getBySeverity(severity: DamageSeverity): Promise<DamageReport[]> {
    return await database.collections
      .get<DamageReport>('damage_reports')
      .query()
      .where('severity', severity)
      .fetch();
  }

  async getRecent(limit: number = 50): Promise<DamageReport[]> {
    return await database.collections
      .get<DamageReport>('damage_reports')
      .query()
      .sortBy('ts', 'desc')
      .take(limit)
      .fetch();
  }

  async getUnconfirmed(): Promise<DamageReport[]> {
    return await database.collections
      .get<DamageReport>('damage_reports')
      .query()
      .where('confirmed', false)
      .fetch();
  }

  async getUndelivered(): Promise<DamageReport[]> {
    return await database.collections
      .get<DamageReport>('damage_reports')
      .query()
      .where('delivered', false)
      .fetch();
  }

  async markAsConfirmed(id: string): Promise<void> {
    await database.write(async () => {
      const damageReport = await database.collections
        .get<DamageReport>('damage_reports')
        .find(id);
      
      await damageReport.update(dr => {
        dr.confirmed = true;
      });
    });
  }

  async markAsDelivered(id: string): Promise<void> {
    await database.write(async () => {
      const damageReport = await database.collections
        .get<DamageReport>('damage_reports')
        .find(id);
      
      await damageReport.update(dr => {
        dr.delivered = true;
      });
    });
  }

  async update(id: string, updates: Partial<{
    description: string;
    photoPath: string;
    confirmed: boolean;
    delivered: boolean;
  }>): Promise<void> {
    await database.write(async () => {
      const damageReport = await database.collections
        .get<DamageReport>('damage_reports')
        .find(id);
      
      await damageReport.update(dr => {
        if (updates.description !== undefined) dr.description = updates.description;
        if (updates.photoPath !== undefined) dr.photoPath = updates.photoPath;
        if (updates.confirmed !== undefined) dr.confirmed = updates.confirmed;
        if (updates.delivered !== undefined) dr.delivered = updates.delivered;
      });
    });
  }

  async delete(id: string): Promise<void> {
    await database.write(async () => {
      const damageReport = await database.collections
        .get<DamageReport>('damage_reports')
        .find(id);
      
      await damageReport.destroyPermanently();
    });
  }

  async getStats(): Promise<{
    total: number;
    byType: { [key in DamageType]: number };
    bySeverity: { [key in DamageSeverity]: number };
    confirmed: number;
    delivered: number;
  }> {
    const allReports = await this.getAll();
    
    const byType = {
      building: 0,
      infrastructure: 0,
      vehicle: 0,
      other: 0,
    } as { [key in DamageType]: number };

    const bySeverity = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
    } as { [key in DamageSeverity]: number };

    let confirmed = 0;
    let delivered = 0;

    for (const report of allReports) {
      byType[report.type]++;
      bySeverity[report.severity]++;
      if (report.confirmed) confirmed++;
      if (report.delivered) delivered++;
    }

    return {
      total: allReports.length,
      byType,
      bySeverity,
      confirmed,
      delivered,
    };
  }
}