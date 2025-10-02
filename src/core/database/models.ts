import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export type Priority = 0 | 1 | 2; // critical, high, normal
export type ResourceType = 'water' | 'food' | 'blanket' | 'powerbank' | 'med';
export type MessageSource = 'self' | 'p2p' | 'server';

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
  @field('note') note!: string;
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
  @field('battery') battery!: number;
  @field('note') note?: string;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class ResourcePost extends Model {
  static table = 'resource_posts';

  @field('ts') ts!: number;
  @field('type') type!: ResourceType;
  @field('qty') qty?: string;
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
  @field('capacity') capacity?: number;
  @field('open') open?: boolean;

  @date('updated_at') updatedAt!: Date;
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
