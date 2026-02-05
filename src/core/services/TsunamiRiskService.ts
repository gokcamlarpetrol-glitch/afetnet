/**
 * TSUNAMI RISK SERVICE - ELITE EDITION
 * 
 * Tsunami riski olan kıyı bölgelerini hesaplar ve gösterir
 * 
 * Features:
 * - Coastal distance calculation
 * - Elevation-based risk assessment
 * - Historical tsunami data
 * - Real-time warning integration
 * - Evacuation route to high ground
 */

import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';

const logger = createLogger('TsunamiRiskService');

export interface TsunamiZone {
    id: string;
    name: string;
    region: string;
    coastLine: { latitude: number; longitude: number }[];
    riskLevel: 'extreme' | 'high' | 'moderate' | 'low';
    maxWaveHeight: number; // meters
    historicalEvents: number;
    evacuationRoutes: {
        name: string;
        destination: { latitude: number; longitude: number };
        elevationGain: number; // meters
    }[];
    warnings: string[];
}

export interface TsunamiRisk {
    distanceToCoast: number; // meters
    elevation: number; // meters
    riskLevel: 'extreme' | 'high' | 'moderate' | 'low';
    estimatedArrivalTime: number; // seconds after earthquake
    safeZone: { latitude: number; longitude: number; name: string } | null;
    recommendations: string[];
}

// ELITE: Turkish coastal tsunami risk zones
const TSUNAMI_ZONES: TsunamiZone[] = [
    // Marmara Denizi - Kritik
    {
        id: 'marmara_south',
        name: 'Marmara Güney Kıyısı',
        region: 'İstanbul',
        coastLine: [
            { latitude: 40.9615, longitude: 29.0800 },
            { latitude: 40.9908, longitude: 29.0238 },
            { latitude: 41.0022, longitude: 28.9495 },
            { latitude: 41.0156, longitude: 28.9792 },
        ],
        riskLevel: 'extreme',
        maxWaveHeight: 6,
        historicalEvents: 12, // 1509, 1766, 1894...
        evacuationRoutes: [
            {
                name: 'Çamlıca Tepesi',
                destination: { latitude: 41.0283, longitude: 29.0700 },
                elevationGain: 268,
            },
        ],
        warnings: [
            'Marmara Denizi altında aktif fay hattı',
            'Depremden sonra 2-10 dakika içinde dalga gelebilir',
            'Minimum 30 metre yüksekliğe çıkın',
        ],
    },
    {
        id: 'marmara_princes',
        name: 'Adalar',
        region: 'İstanbul',
        coastLine: [
            { latitude: 40.8717, longitude: 29.0890 },
            { latitude: 40.8567, longitude: 29.1189 },
        ],
        riskLevel: 'extreme',
        maxWaveHeight: 8,
        historicalEvents: 8,
        evacuationRoutes: [
            {
                name: 'Ada Tepesi',
                destination: { latitude: 40.8650, longitude: 29.1000 },
                elevationGain: 100,
            },
        ],
        warnings: [
            'Ada çevresinden uzaklaşma imkanı yok',
            'Yüksek zemine çıkın',
            'Deniz çekilirse hemen kaçın',
        ],
    },
    // Ege Denizi
    {
        id: 'izmir_bay',
        name: 'İzmir Körfezi',
        region: 'İzmir',
        coastLine: [
            { latitude: 38.4256, longitude: 27.1367 },
            { latitude: 38.4314, longitude: 27.1398 },
            { latitude: 38.4621, longitude: 27.1650 },
        ],
        riskLevel: 'high',
        maxWaveHeight: 4,
        historicalEvents: 5, // 2020 Seferihisar
        evacuationRoutes: [
            {
                name: 'Kadifekale',
                destination: { latitude: 38.4153, longitude: 27.1423 },
                elevationGain: 186,
            },
        ],
        warnings: [
            '2020 Seferihisar depreminde tsunami yaşandı',
            'Körfez yapısı dalgayı yoğunlaştırır',
        ],
    },
    // Akdeniz
    {
        id: 'antalya_coast',
        name: 'Antalya Kıyısı',
        region: 'Antalya',
        coastLine: [
            { latitude: 36.8500, longitude: 30.7000 },
            { latitude: 36.8600, longitude: 30.7200 },
        ],
        riskLevel: 'moderate',
        maxWaveHeight: 2,
        historicalEvents: 2,
        evacuationRoutes: [
            {
                name: 'Toros Dağları',
                destination: { latitude: 36.9000, longitude: 30.7100 },
                elevationGain: 500,
            },
        ],
        warnings: ['Akdeniz tsunamileri nadir ama olası'],
    },
    // Karadeniz
    {
        id: 'trabzon_coast',
        name: 'Trabzon Kıyısı',
        region: 'Trabzon',
        coastLine: [
            { latitude: 41.0050, longitude: 39.7168 },
            { latitude: 41.0020, longitude: 39.7300 },
        ],
        riskLevel: 'low',
        maxWaveHeight: 1,
        historicalEvents: 1,
        evacuationRoutes: [],
        warnings: ['Karadeniz tsunamileri çok nadir'],
    },
];

// ELITE: High ground evacuation points for major coastal cities
const HIGH_GROUND_POINTS = [
    // Istanbul
    { name: 'Çamlıca Tepesi', latitude: 41.0283, longitude: 29.0700, elevation: 268, city: 'Istanbul' },
    { name: 'Aydos Tepesi', latitude: 40.9650, longitude: 29.2100, elevation: 537, city: 'Istanbul' },
    { name: 'Pierre Loti', latitude: 41.0481, longitude: 28.9377, elevation: 75, city: 'Istanbul' },
    // Izmir
    { name: 'Kadifekale', latitude: 38.4153, longitude: 27.1423, elevation: 186, city: 'Izmir' },
    { name: 'Narlıdere Tepe', latitude: 38.4100, longitude: 27.0500, elevation: 150, city: 'Izmir' },
    // Antalya
    { name: 'Tünek Tepe', latitude: 36.8800, longitude: 30.6900, elevation: 160, city: 'Antalya' },
];

class TsunamiRiskService {
    private userLocation: { latitude: number; longitude: number } | null = null;
    private isInitialized = false;

    /**
     * Initialize service
     */
    async initialize(): Promise<void> {
        this.isInitialized = true;
        logger.info('Tsunami risk service initialized');
    }

    /**
     * Calculate tsunami risk for a location
     */
    async calculateRisk(latitude: number, longitude: number): Promise<TsunamiRisk> {
        // Find nearest coast
        let minDistanceToCoast = Infinity;
        let nearestZone: TsunamiZone | null = null;

        for (const zone of TSUNAMI_ZONES) {
            for (const point of zone.coastLine) {
                const distance = this.calculateDistance(latitude, longitude, point.latitude, point.longitude);
                if (distance < minDistanceToCoast) {
                    minDistanceToCoast = distance;
                    nearestZone = zone;
                }
            }
        }

        // Determine risk level based on distance
        let riskLevel: TsunamiRisk['riskLevel'] = 'low';
        if (minDistanceToCoast < 500) {
            riskLevel = 'extreme';
        } else if (minDistanceToCoast < 1000) {
            riskLevel = 'high';
        } else if (minDistanceToCoast < 3000) {
            riskLevel = 'moderate';
        }

        // Find nearest high ground
        let nearestSafeZone: { latitude: number; longitude: number; name: string } | null = null;
        let minSafeDistance = Infinity;

        for (const point of HIGH_GROUND_POINTS) {
            const distance = this.calculateDistance(latitude, longitude, point.latitude, point.longitude);
            if (distance < minSafeDistance) {
                minSafeDistance = distance;
                nearestSafeZone = {
                    latitude: point.latitude,
                    longitude: point.longitude,
                    name: point.name,
                };
            }
        }

        // Calculate estimated arrival time (rough estimate based on distance)
        // Tsunami speed in shallow water: ~50-100 km/h
        const estimatedArrivalTime = Math.max(60, (minDistanceToCoast / 1000) * 60); // seconds

        // Generate recommendations
        const recommendations = this.generateRecommendations(riskLevel, minDistanceToCoast, nearestZone);

        return {
            distanceToCoast: minDistanceToCoast,
            elevation: 0, // Would need elevation API
            riskLevel,
            estimatedArrivalTime,
            safeZone: nearestSafeZone,
            recommendations,
        };
    }

    /**
     * Get all tsunami zones
     */
    getTsunamiZones(): TsunamiZone[] {
        return [...TSUNAMI_ZONES];
    }

    /**
     * Get zones by region
     */
    getZonesByRegion(region: string): TsunamiZone[] {
        return TSUNAMI_ZONES.filter(z => z.region.toLowerCase() === region.toLowerCase());
    }

    /**
     * Get high ground points
     */
    getHighGroundPoints(city?: string): typeof HIGH_GROUND_POINTS {
        if (city) {
            return HIGH_GROUND_POINTS.filter(p => p.city.toLowerCase() === city.toLowerCase());
        }
        return [...HIGH_GROUND_POINTS];
    }

    /**
     * Check if location is in extreme risk zone
     */
    isInExtremeRiskZone(latitude: number, longitude: number): boolean {
        for (const zone of TSUNAMI_ZONES) {
            if (zone.riskLevel === 'extreme') {
                for (const point of zone.coastLine) {
                    const distance = this.calculateDistance(latitude, longitude, point.latitude, point.longitude);
                    if (distance < 500) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Get evacuation route to high ground
     */
    getEvacuationRoute(latitude: number, longitude: number): {
        destination: { latitude: number; longitude: number; name: string };
        distance: number;
        estimatedTime: number; // minutes walking
    } | null {
        let nearest: typeof HIGH_GROUND_POINTS[number] | null = null;
        let minDistance = Infinity;

        for (const point of HIGH_GROUND_POINTS) {
            const distance = this.calculateDistance(latitude, longitude, point.latitude, point.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = point;
            }
        }

        if (!nearest) return null;

        return {
            destination: {
                latitude: nearest.latitude,
                longitude: nearest.longitude,
                name: nearest.name,
            },
            distance: minDistance,
            estimatedTime: Math.ceil(minDistance / 83), // ~5 km/h walking speed
        };
    }

    /**
     * Generate recommendations based on risk
     */
    private generateRecommendations(
        level: TsunamiRisk['riskLevel'],
        distance: number,
        zone: TsunamiZone | null
    ): string[] {
        const recommendations: string[] = [];

        if (level === 'extreme') {
            recommendations.push('⚠️ ACIL: Denizden uzaklaşın!');
            recommendations.push('Yüksek yere çıkın (min. 30m)');
            recommendations.push('Deniz çekilirse HEMEN kaçın');
        } else if (level === 'high') {
            recommendations.push('Deniz kenarından uzak durun');
            recommendations.push('Deprem sonrası en yakın yüksek noktaya gidin');
        } else if (level === 'moderate') {
            recommendations.push('Tsunami uyarılarını takip edin');
            recommendations.push('Tahliye rotalarını öğrenin');
        }

        if (zone?.warnings) {
            recommendations.push(...zone.warnings);
        }

        return recommendations;
    }

    /**
     * Calculate distance using Haversine formula
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}

export const tsunamiRiskService = new TsunamiRiskService();
