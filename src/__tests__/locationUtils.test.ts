/**
 * LOCATION SERVICE TESTS - ELITE EDITION
 * Tests for location utilities and calculations
 */

describe('Location Utilities', () => {
    describe('Distance Calculation (Haversine)', () => {
        const calculateDistance = (
            lat1: number,
            lon1: number,
            lat2: number,
            lon2: number
        ): number => {
            const R = 6371; // Earth's radius in km
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return Math.round(R * c); // Distance in km
        };

        test('should calculate distance between Istanbul and Ankara', () => {
            const istanbul = { lat: 41.0082, lon: 28.9784 };
            const ankara = { lat: 39.9334, lon: 32.8597 };

            const distance = calculateDistance(
                istanbul.lat,
                istanbul.lon,
                ankara.lat,
                ankara.lon
            );

            // Distance should be approximately 350-360 km
            expect(distance).toBeGreaterThan(340);
            expect(distance).toBeLessThan(370);
        });

        test('should return 0 for same location', () => {
            const location = { lat: 41.0082, lon: 28.9784 };

            const distance = calculateDistance(
                location.lat,
                location.lon,
                location.lat,
                location.lon
            );

            expect(distance).toBe(0);
        });

        test('should calculate earthquake impact radius correctly', () => {
            const epicenter = { lat: 40.748, lon: 29.945 }; // Marmara Sea
            const userLocation = { lat: 41.0082, lon: 28.9784 }; // Istanbul

            const distance = calculateDistance(
                epicenter.lat,
                epicenter.lon,
                userLocation.lat,
                userLocation.lon
            );

            // Should be within 100km impact radius
            expect(distance).toBeLessThan(100);
        });
    });

    describe('Coordinate Validation', () => {
        const isValidCoordinate = (lat: number, lon: number): boolean => {
            return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
        };

        test('should validate valid coordinates', () => {
            expect(isValidCoordinate(41.0082, 28.9784)).toBe(true); // Istanbul
            expect(isValidCoordinate(0, 0)).toBe(true); // Null Island
            expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true); // Sydney
        });

        test('should reject invalid coordinates', () => {
            expect(isValidCoordinate(91, 0)).toBe(false); // Lat > 90
            expect(isValidCoordinate(0, 181)).toBe(false); // Lon > 180
            expect(isValidCoordinate(-91, 0)).toBe(false); // Lat < -90
        });
    });

    describe('Turkey Boundary Check', () => {
        const isInTurkey = (lat: number, lon: number): boolean => {
            // Approximate Turkey bounding box
            return lat >= 35.8 && lat <= 42.1 && lon >= 26.0 && lon <= 44.8;
        };

        test('should identify locations in Turkey', () => {
            expect(isInTurkey(41.0082, 28.9784)).toBe(true); // Istanbul
            expect(isInTurkey(39.9334, 32.8597)).toBe(true); // Ankara
            expect(isInTurkey(38.4192, 27.1287)).toBe(true); // Izmir
            expect(isInTurkey(37.0662, 37.3833)).toBe(true); // Gaziantep
        });

        test('should identify locations outside Turkey', () => {
            expect(isInTurkey(51.5074, -0.1278)).toBe(false); // London
            expect(isInTurkey(40.7128, -74.006)).toBe(false); // New York
            expect(isInTurkey(35.6762, 139.6503)).toBe(false); // Tokyo
        });
    });

    describe('EEW Time Calculation', () => {
        const calculateSWaveArrival = (distance: number): number => {
            // S-wave velocity ~3.5 km/s
            const S_WAVE_VELOCITY = 3.5;
            return Math.round(distance / S_WAVE_VELOCITY);
        };

        test('should calculate S-wave arrival time correctly', () => {
            expect(calculateSWaveArrival(35)).toBe(10); // 35 km = 10 seconds
            expect(calculateSWaveArrival(70)).toBe(20); // 70 km = 20 seconds
            expect(calculateSWaveArrival(0)).toBe(0); // Epicenter = 0 seconds
        });

        test('should give user 10+ seconds warning at 35km distance', () => {
            const distance = 35;
            const warningTime = calculateSWaveArrival(distance);

            // User should have at least 10 seconds to take cover
            expect(warningTime).toBeGreaterThanOrEqual(10);
        });
    });
});
