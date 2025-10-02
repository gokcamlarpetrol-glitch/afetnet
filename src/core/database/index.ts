import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@watermelondb/sqlite-adapter';
import { schema } from './schema';
import { HelpRequest, StatusPing, ResourcePost, Shelter, DevicePeer } from './models';

const adapter = new SQLiteAdapter({
  schema,
  // For debugging, you can uncomment the next line:
  // dbName: 'AfetNet',
  // migrations,
  // synchronous: true,
});

export const database = new Database({
  adapter,
  modelClasses: [HelpRequest, StatusPing, ResourcePost, Shelter, DevicePeer],
});

// Helper functions for common queries
export const getHelpRequestsByPriority = async (priority: number) => {
  return await database.collections.get<HelpRequest>('help_requests')
    .query()
    .where('priority', priority)
    .fetch();
};

export const getNearbyShelters = async (lat: number, lon: number, radiusKm: number = 5) => {
  // Simple distance calculation - in production, use proper geospatial queries
  const shelters = await database.collections.get<Shelter>('shelters')
    .query()
    .fetch();
  
  return shelters.filter(shelter => {
    const distance = calculateDistance(lat, lon, shelter.lat, shelter.lon);
    return distance <= radiusKm;
  });
};

export const getActiveHelpRequests = async () => {
  const now = Date.now();
  return await database.collections.get<HelpRequest>('help_requests')
    .query()
    .where('delivered', false)
    .where('ttl', Q.gte, now)
    .fetch();
};

// Utility function for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Import Q for queries
import { Q } from '@nozbe/watermelondb';
