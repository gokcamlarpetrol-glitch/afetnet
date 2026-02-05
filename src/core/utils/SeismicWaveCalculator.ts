/**
 * SEISMIC WAVE CALCULATOR - PRECISION EDITION
 * 
 * 🌊 SİSMİK DALGA HESAPLAMA SİSTEMİ
 * 
 * ELITE FEATURES:
 * - P-Wave arrival time calculation (uyarı dalgası)
 * - S-Wave arrival time calculation (hasar dalgası)
 * - Soil type intensity modifiers (zemin amplifikasyonu)
 * - Warning time estimation (kaç saniye kaldı?)
 * - Intensity attenuation (şiddet azalması)
 * 
 * PHYSICS:
 * ┌────────────────────────────────────────────────────────┐
 * │  P-Wave (Primary)   : ~6.0 km/s  (first to arrive)   │
 * │  S-Wave (Secondary) : ~3.5 km/s  (causes damage)     │
 * │  Surface Wave       : ~2.5 km/s  (most destructive)  │
 * └────────────────────────────────────────────────────────┘
 * 
 * WARNING TIME = (S-Wave Arrival) - (Current Time)
 * This is the time users have to take protective action!
 * 
 * @version 1.0.0
 * @elite true
 * @lifesaving true
 */

import { createLogger } from './logger';

const logger = createLogger('SeismicWaveCalculator');

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Seismic wave velocities in km/s
 * These are averages for crustal rock in Turkey
 */
const WAVE_VELOCITIES = {
    P_WAVE: 6.0,        // km/s - Primary wave (compression)
    S_WAVE: 3.5,        // km/s - Secondary wave (shear)
    SURFACE_WAVE: 2.5,  // km/s - Surface waves (Love/Rayleigh)
} as const;

/**
 * Soil type amplification factors (NEHRP classification)
 * These modify the expected intensity based on local geology
 */
const SOIL_AMPLIFICATION = {
    A: 0.8,   // Hard rock (granite, etc.)
    B: 0.9,   // Rock
    C: 1.0,   // Very dense soil / soft rock
    D: 1.3,   // Stiff soil
    E: 1.6,   // Soft clay
    F: 2.0,   // Special study required (liquefiable soils)
} as const;

export type SoilType = keyof typeof SOIL_AMPLIFICATION;

/**
 * Turkish city soil classifications (simplified)
 * Based on AFAD/TBDY-2018 data
 */
const TURKISH_CITY_SOIL: Record<string, SoilType> = {
    // Marmara
    'Istanbul': 'D',
    'Kocaeli': 'D',
    'Bursa': 'C',
    'Tekirdağ': 'C',
    'Adapazarı': 'E',
    'Yalova': 'D',
    'Balıkesir': 'C',

    // Ege
    'Izmir': 'D',
    'Aydın': 'C',
    'Denizli': 'C',
    'Manisa': 'C',
    'Muğla': 'B',

    // Akdeniz
    'Antalya': 'C',
    'Mersin': 'C',
    'Adana': 'D',
    'Hatay': 'D',

    // Karadeniz
    'Trabzon': 'B',
    'Samsun': 'C',
    'Zonguldak': 'B',

    // İç Anadolu
    'Ankara': 'C',
    'Konya': 'C',
    'Eskişehir': 'C',
    'Kayseri': 'B',

    // Doğu
    'Erzurum': 'B',
    'Van': 'C',
    'Malatya': 'C',
    'Elazığ': 'C',
    'Diyarbakır': 'C',
    'Kahramanmaraş': 'D',
    'Gaziantep': 'C',
};

// ============================================================
// TYPES
// ============================================================

export interface SeismicCalculation {
    /** Seconds until P-wave arrives (first warning) */
    pWaveArrival: number;
    /** Seconds until S-wave arrives (damaging wave) */
    sWaveArrival: number;
    /** Effective warning time for protective action */
    warningTime: number;
    /** Estimated MMI intensity at user location */
    estimatedIntensity: number;
    /** Intensity level description */
    intensityDescription: string;
    /** Distance from epicenter in km */
    distance: number;
    /** Soil amplification factor applied */
    soilFactor: number;
}

export interface EpicenterInfo {
    latitude: number;
    longitude: number;
    depth: number; // km
    magnitude: number;
    originTime: number; // Unix timestamp
}

export interface UserLocation {
    latitude: number;
    longitude: number;
    soilType?: SoilType;
    city?: string;
}

// ============================================================
// SEISMIC WAVE CALCULATOR
// ============================================================

export class SeismicWaveCalculator {

    /**
     * Calculate all seismic parameters for a user relative to an earthquake
     * This is the main entry point
     */
    static calculate(
        epicenter: EpicenterInfo,
        user: UserLocation,
        currentTime: number = Date.now()
    ): SeismicCalculation {

        // 1. Calculate epicentral distance
        const horizontalDistance = this.calculateDistance(
            epicenter.latitude,
            epicenter.longitude,
            user.latitude,
            user.longitude
        );

        // Account for depth (hypocentral distance)
        const hypocentralDistance = Math.sqrt(
            horizontalDistance ** 2 + epicenter.depth ** 2
        );

        // 2. Calculate wave arrival times
        const pWaveSeconds = hypocentralDistance / WAVE_VELOCITIES.P_WAVE;
        const sWaveSeconds = hypocentralDistance / WAVE_VELOCITIES.S_WAVE;

        // 3. Calculate elapsed time since origin
        const elapsedSeconds = (currentTime - epicenter.originTime) / 1000;

        // 4. Calculate remaining time until waves arrive
        const pWaveArrival = Math.max(0, pWaveSeconds - elapsedSeconds);
        const sWaveArrival = Math.max(0, sWaveSeconds - elapsedSeconds);
        const warningTime = sWaveArrival; // Time to take action before damage

        // 5. Determine soil factor
        const soilType = user.soilType || this.getSoilType(user.city);
        const soilFactor = SOIL_AMPLIFICATION[soilType];

        // 6. Calculate estimated intensity
        const baseIntensity = this.calculateIntensity(
            epicenter.magnitude,
            hypocentralDistance
        );
        const estimatedIntensity = Math.min(12, baseIntensity * soilFactor);

        // 7. Get intensity description
        const intensityDescription = this.getIntensityDescription(estimatedIntensity);

        const result: SeismicCalculation = {
            pWaveArrival: Math.round(pWaveArrival * 10) / 10,
            sWaveArrival: Math.round(sWaveArrival * 10) / 10,
            warningTime: Math.round(sWaveArrival),
            estimatedIntensity: Math.round(estimatedIntensity * 10) / 10,
            intensityDescription,
            distance: Math.round(horizontalDistance * 10) / 10,
            soilFactor,
        };

        logger.debug('Seismic calculation:', result);

        return result;
    }

    /**
     * Calculate simple warning time (shortcut method)
     */
    static getWarningTime(
        epicenterLat: number,
        epicenterLon: number,
        userLat: number,
        userLon: number,
        depth: number = 10,
        originTime: number = Date.now()
    ): number {
        const distance = this.calculateDistance(epicenterLat, epicenterLon, userLat, userLon);
        const hypocentralDistance = Math.sqrt(distance ** 2 + depth ** 2);
        const sWaveTime = hypocentralDistance / WAVE_VELOCITIES.S_WAVE;
        const elapsed = (Date.now() - originTime) / 1000;
        return Math.max(0, Math.round(sWaveTime - elapsed));
    }

    /**
     * Calculate distance using Haversine formula
     */
    static calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Calculate MMI intensity using empirical attenuation
     * Based on simplified Wald et al. (1999) relation
     */
    static calculateIntensity(magnitude: number, distance: number): number {
        // Avoid log(0)
        if (distance <= 0) distance = 1;

        // Modified Wald relation for Turkey region
        // I = 1.5M - 1.5log(r) + const
        const intensity = 1.5 * magnitude - 1.5 * Math.log10(distance) + 1.5;

        return Math.max(1, Math.min(12, intensity));
    }

    /**
     * Get MMI intensity description (Turkish)
     */
    static getIntensityDescription(intensity: number): string {
        const rounded = Math.round(intensity);

        const descriptions: Record<number, string> = {
            1: 'Hissedilmez',
            2: 'Çok hafif',
            3: 'Hafif',
            4: 'Orta',
            5: 'Kuvvetli',
            6: 'Çok kuvvetli',
            7: 'Çok şiddetli',
            8: 'Yıkıcı',
            9: 'Çok yıkıcı',
            10: 'Felaket',
            11: 'Afet',
            12: 'Büyük afet',
        };

        return descriptions[rounded] || 'Bilinmiyor';
    }

    /**
     * Get soil type for a city
     */
    static getSoilType(city?: string): SoilType {
        if (!city) return 'C'; // Default

        // Normalize city name
        const normalized = city
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ı/g, 'i')
            .replace(/İ/g, 'I')
            .replace(/ş/g, 's')
            .replace(/Ş/g, 'S')
            .replace(/ğ/g, 'g')
            .replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u')
            .replace(/Ü/g, 'U')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'O')
            .replace(/ç/g, 'c')
            .replace(/Ç/g, 'C');

        // Find matching city
        for (const [name, type] of Object.entries(TURKISH_CITY_SOIL)) {
            if (normalized.toLowerCase().includes(name.toLowerCase())) {
                return type;
            }
        }

        return 'C'; // Default soil type
    }

    /**
     * Format warning time for display
     */
    static formatWarningTime(seconds: number): string {
        if (seconds <= 0) return 'ŞİMDİ!';
        if (seconds < 60) return `${Math.round(seconds)} saniye`;

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);

        if (remainingSeconds === 0) {
            return `${minutes} dakika`;
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get urgency level based on warning time and intensity
     */
    static getUrgencyLevel(
        warningSeconds: number,
        intensity: number
    ): 'critical' | 'high' | 'medium' | 'low' {

        // Critical: Very little time and/or high intensity
        if (warningSeconds <= 10 && intensity >= 5) return 'critical';
        if (intensity >= 7) return 'critical';

        // High: Limited time or significant intensity
        if (warningSeconds <= 30 && intensity >= 4) return 'high';
        if (intensity >= 5) return 'high';

        // Medium: Some warning time available
        if (intensity >= 4) return 'medium';

        // Low: Minor event or distant
        return 'low';
    }

    /**
     * Convert degrees to radians
     */
    private static toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}

// ============================================================
// CONVENIENCE EXPORTS
// ============================================================

/**
 * Quick calculation function
 */
export function calculateSeismicWarning(
    earthquake: {
        latitude: number;
        longitude: number;
        depth: number;
        magnitude: number;
        time: number;
    },
    user: {
        latitude: number;
        longitude: number;
        city?: string;
    }
): SeismicCalculation {
    return SeismicWaveCalculator.calculate(
        {
            latitude: earthquake.latitude,
            longitude: earthquake.longitude,
            depth: earthquake.depth,
            magnitude: earthquake.magnitude,
            originTime: earthquake.time,
        },
        {
            latitude: user.latitude,
            longitude: user.longitude,
            city: user.city,
        }
    );
}

export default SeismicWaveCalculator;
