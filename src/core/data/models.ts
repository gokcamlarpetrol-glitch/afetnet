import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';
import { z } from 'zod';

// Zod schemas for validation
export const PrioritySchema = z.enum([0, 1, 2]); // critical, high, normal
export const ResourceTypeSchema = z.enum(['water', 'food', 'blanket', 'powerbank', 'med']);
export const MessageSourceSchema = z.enum(['self', 'p2p', 'server']);

export type Priority = z.infer<typeof PrioritySchema>;
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
export type MessageSource = z.infer<typeof MessageSourceSchema>;

export class HelpRequest extends Model {
  static table = 'help_requests';

  @field('ts') ts!: number;
  @field('lat') lat!: number;
  @field('lon') lon!: number;
  @field('accuracy') accuracy!: number;
  @field('priority') priority!: Priority;
  @field('under_rubble') underRubble!: boolean;
  @field('injured') injured!: boolean;
  @field('people_count') peopleCount!: number;
  @field('note') note?: string;
  @field('battery') battery?: number;
  @field('anonymity') anonymity!: boolean;
  @field('ttl') ttl!: number;
  @field('signature') signature!: string;
  @field('delivered') delivered!: boolean;
  @field('hops') hops!: number;
  @field('source') source!: MessageSource;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class StatusPing extends Model {
  static table = 'status_pings';

  @field('ts') ts!: number;
  @field('lat') lat!: number;
  @field('lon') lon!: number;
  @field('battery') battery?: number;
  @field('note') note?: string;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class ResourcePost extends Model {
  static table = 'resource_posts';

  @field('ts') ts!: number;
  @field('type') type!: ResourceType;
  @field('qty') qty!: string;
  @field('lat') lat!: number;
  @field('lon') lon!: number;
  @field('desc') desc?: string;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class Shelter extends Model {
  static table = 'shelters';

  @field('name') name!: string;
  @field('lat') lat!: number;
  @field('lon') lon!: number;
  @field('capacity') capacity!: number;
  @field('open') open!: boolean;
  @field('updated_at') updatedAt!: number;

  @date('created_at') createdAt!: Date;
}

export class DevicePeer extends Model {
  static table = 'device_peers';

  @field('last_seen_ts') lastSeenTs!: number;
  @field('rssi_avg') rssiAvg?: number;
  @field('hops_min') hopsMin?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class FamilyMember extends Model {
  static table = 'family_members';

  @field('name') name!: string;
  @field('phone_number') phoneNumber?: string;
  @field('email') email?: string;
  @field('share_code') shareCode!: string;
  @field('last_seen') lastSeen!: number;
  @field('is_online') isOnline!: boolean;
  @field('trust_level') trustLevel!: number;
  @field('added_at') addedAt!: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export const DamageTypeSchema = z.enum(['building', 'infrastructure', 'vehicle', 'other']);
export const DamageSeveritySchema = z.enum([0, 1, 2, 3]); // minor, moderate, severe, critical

export type DamageType = z.infer<typeof DamageTypeSchema>;
export type DamageSeverity = z.infer<typeof DamageSeveritySchema>;

export class DamageReport extends Model {
  static table = 'damage_reports';

  @field('ts') ts!: number;
  @field('lat') lat!: number;
  @field('lon') lon!: number;
  @field('accuracy') accuracy!: number;
  @field('type') type!: DamageType;
  @field('severity') severity!: DamageSeverity;
  @field('description') description?: string;
  @field('photo_path') photoPath?: string;
  @field('reporter_name') reporterName?: string;
  @field('reporter_phone') reporterPhone?: string;
  @field('confirmed') confirmed!: boolean;
  @field('delivered') delivered!: boolean;
  @field('source') source!: MessageSource;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}