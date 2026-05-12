import { createLogger } from '../../utils/logger';

const logger = createLogger('MapPOIService');

export interface MapPOI {
    id: string;
    type: 'hospital' | 'assembly_point' | 'pharmacy';
    title: string;
    latitude: number;
    longitude: number;
    distance?: number;
}

/**
 * POI feature is disabled until a real data source (Google Places API, Overpass API,
 * or AFAD official dataset) is integrated. Returns empty array to avoid showing
 * fake/random locations to users.
 */
class MapPOIService {
    /** Feature not yet available - returns empty array */
    async getNearbyPOIs(_latitude: number, _longitude: number, _radiusKm: number = 5): Promise<MapPOI[]> {
        logger.info('POI feature not yet available - real data source integration pending');
        return [];
    }
}

export const mapPOIService = new MapPOIService();
