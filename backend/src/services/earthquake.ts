import axios from 'axios';
import { createCircuitBreaker, withFallback } from '../utils/circuitBreaker';
import { logger } from '../utils/logger';
import { earthquakeAlertsTotal } from '../utils/metrics';
import { prisma } from '../utils/prisma';
import { sendMulticastNotification } from './firebase';

interface EarthquakeData {
  id: string;
  magnitude: number;
  depth?: number;
  latitude: number;
  longitude: number;
  place: string;
  timestamp: Date;
  source: string;
}

// Circuit breakers for external APIs - CRITICAL: Prevents cascading failures
const afadBreaker = createCircuitBreaker(
  async () => fetchAFADEarthquakesInternal(),
  { name: 'AFAD_API', timeout: 10000, errorThresholdPercentage: 50 }
);

const usgsBreaker = createCircuitBreaker(
  async () => fetchUSGSEarthquakesInternal(),
  { name: 'USGS_API', timeout: 10000, errorThresholdPercentage: 50 }
);

// Internal fetch function for AFAD
const fetchAFADEarthquakesInternal = async (): Promise<EarthquakeData[]> => {
  try {
    const response = await axios.post(
      process.env.AFAD_API_URL || 'https://deprem.afad.gov.tr/EventService/GetEventsByFilter',
      {
        EventSearchFilterList: [
          {
            FilterType: 9,
            FilterValue: 1, // Last 1 day
          },
        ],
        Skip: 0,
        Take: 100,
        SortDescriptor: {
          field: 'EventDate',
          dir: 'desc',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (!response.data || !response.data.eventList) {
      return [];
    }

    return response.data.eventList.map((event: any) => ({
      id: `afad-${event.eventId || event.id}`,
      magnitude: parseFloat(event.magnitude || event.ml || event.mw || '0'),
      depth: parseFloat(event.depth || '0'),
      latitude: parseFloat(event.latitude || '0'),
      longitude: parseFloat(event.longitude || '0'),
      place: [event.location, event.district, event.city].filter(Boolean).join(', ') || 'Türkiye',
      timestamp: new Date(event.eventDate),
      source: 'AFAD',
    }));
  } catch (error) {
    console.error('AFAD fetch error:', error);
    return [];
  }
};

// Public wrapper with circuit breaker
export const fetchAFADEarthquakes = withFallback(afadBreaker, async (): Promise<EarthquakeData[]> => {
  logger.warn('⚠️  AFAD API circuit open, using empty fallback');
  return [];
});

// Internal fetch function for USGS
const fetchUSGSEarthquakesInternal = async (): Promise<EarthquakeData[]> => {
  try {
    const response = await axios.get(
      process.env.USGS_API_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
      {
        timeout: 10000,
      }
    );

    if (!response.data || !response.data.features) {
      return [];
    }

    return response.data.features.map((feature: any) => ({
      id: `usgs-${feature.id}`,
      magnitude: feature.properties.mag || 0,
      depth: feature.geometry.coordinates[2] || 0,
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      place: feature.properties.place || 'Unknown',
      timestamp: new Date(feature.properties.time),
      source: 'USGS',
    }));
  } catch (error) {
    console.error('USGS fetch error:', error);
    return [];
  }
};

// Public wrapper with circuit breaker
export const fetchUSGSEarthquakes = withFallback(usgsBreaker, async (): Promise<EarthquakeData[]> => {
  logger.warn('⚠️  USGS API circuit open, using empty fallback');
  return [];
});

export const startEarthquakeMonitoring = async () => {
  try {
    console.log('🌍 Fetching earthquake data...');

    // Fetch from both sources with circuit breakers
    const [afadData, usgsData] = await Promise.all([
      fetchAFADEarthquakes().catch(() => []),
      fetchUSGSEarthquakes().catch(() => []),
    ]);

    const allEarthquakes: EarthquakeData[] = [...afadData, ...usgsData];
    console.log(`Found ${allEarthquakes.length} earthquakes`);

    // Process each earthquake
    for (const quake of allEarthquakes) {
      try {
        // Check if already exists
        const existing = await prisma.earthquake.findUnique({
          where: { externalId: quake.id },
        });

        if (existing) {
          continue; // Skip if already processed
        }

        // Save to database
        const saved = await prisma.earthquake.create({
          data: {
            externalId: quake.id,
            magnitude: quake.magnitude,
            depth: quake.depth,
            latitude: quake.latitude,
            longitude: quake.longitude,
            place: quake.place,
            source: quake.source,
            timestamp: quake.timestamp,
          },
        });

        console.log(`✅ New earthquake: ${quake.magnitude} - ${quake.place}`);

        // Send notifications for significant earthquakes (magnitude >= 4.0)
        if (quake.magnitude >= 4.0) {
          await sendEarthquakeNotifications(saved);
          
          // CRITICAL: Track earthquake alert metrics
          const magnitudeRange = quake.magnitude >= 7 ? '7+' :
                                 quake.magnitude >= 6 ? '6-7' :
                                 quake.magnitude >= 5 ? '5-6' : '4-5';
          earthquakeAlertsTotal.inc({ magnitude_range: magnitudeRange, source: quake.source });
        }
      } catch (error) {
        console.error(`Error processing earthquake ${quake.id}:`, error);
      }
    }

    console.log('✅ Earthquake monitoring complete');
  } catch (error) {
    console.error('Earthquake monitoring error:', error);
  }
};

const sendEarthquakeNotifications = async (earthquake: any) => {
  try {
    // Get all FCM tokens
    const tokens = await prisma.fcmToken.findMany({
      select: { token: true },
    });

    if (tokens.length === 0) {
      return;
    }

    const tokenList = tokens.map((t: { token: string }) => t.token);

    // Send multicast notification
    await sendMulticastNotification(tokenList, {
      title: `🚨 Deprem: ${earthquake.magnitude} büyüklüğünde`,
      body: `${earthquake.place} - ${new Date(earthquake.timestamp).toLocaleString('tr-TR')}`,
      data: {
        type: 'earthquake',
        earthquakeId: earthquake.id,
        magnitude: earthquake.magnitude.toString(),
        latitude: earthquake.latitude.toString(),
        longitude: earthquake.longitude.toString(),
      },
    });

    // Update notification count
    await prisma.earthquake.update({
      where: { id: earthquake.id },
      data: { notificationsSent: tokenList.length },
    });

    console.log(`📱 Sent ${tokenList.length} earthquake notifications`);
  } catch (error) {
    console.error('Error sending earthquake notifications:', error);
  }
};
