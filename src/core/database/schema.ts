import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'help_requests',
      columns: [
        { name: 'ts', type: 'number', isIndexed: true },
        { name: 'lat', type: 'number', isIndexed: true },
        { name: 'lon', type: 'number', isIndexed: true },
        { name: 'accuracy', type: 'number' },
        { name: 'priority', type: 'number', isIndexed: true },
        { name: 'under_rubble', type: 'boolean' },
        { name: 'injured', type: 'boolean' },
        { name: 'people_count', type: 'number' },
        { name: 'note', type: 'string' },
        { name: 'battery', type: 'number' },
        { name: 'anonymity', type: 'boolean' },
        { name: 'ttl', type: 'number' },
        { name: 'signature', type: 'string' },
        { name: 'delivered', type: 'boolean' },
        { name: 'hops', type: 'number' },
        { name: 'source', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'status_pings',
      columns: [
        { name: 'ts', type: 'number', isIndexed: true },
        { name: 'lat', type: 'number', isIndexed: true },
        { name: 'lon', type: 'number', isIndexed: true },
        { name: 'battery', type: 'number' },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'resource_posts',
      columns: [
        { name: 'ts', type: 'number', isIndexed: true },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'qty', type: 'string' },
        { name: 'lat', type: 'number', isIndexed: true },
        { name: 'lon', type: 'number', isIndexed: true },
        { name: 'desc', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'shelters',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'lat', type: 'number', isIndexed: true },
        { name: 'lon', type: 'number', isIndexed: true },
        { name: 'capacity', type: 'number' },
        { name: 'open', type: 'boolean' },
        { name: 'updated_at', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'device_peers',
      columns: [
        { name: 'last_seen_ts', type: 'number', isIndexed: true },
        { name: 'rssi_avg', type: 'number' },
        { name: 'hops_min', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
