import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@watermelondb/sqlite-adapter';
import { schema } from './schema';
import { HelpRequest, StatusPing, ResourcePost, Shelter, DevicePeer, FamilyMember, DamageReport } from './models';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'AfetNetDB',
  migrations: [
    // Future migrations go here
  ],
});

export const database = new Database({
  adapter,
  modelClasses: [HelpRequest, StatusPing, ResourcePost, Shelter, DevicePeer, FamilyMember, DamageReport],
});