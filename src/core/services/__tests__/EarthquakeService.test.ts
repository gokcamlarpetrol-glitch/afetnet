/**
 * EARTHQUAKE SERVICE TESTS - CURRENT API
 * Focus: store update behavior and failure fallbacks
 */

import { earthquakeService } from '../EarthquakeService';
import { useEarthquakeStore } from '../../stores/earthquakeStore';
import { fetchAllEarthquakes } from '../earthquake/EarthquakeFetcher';
import { loadFromCache, saveToCache } from '../earthquake/EarthquakeCacheManager';

jest.mock('../earthquake/EarthquakeFetcher', () => ({
  fetchAllEarthquakes: jest.fn(),
  fetchFromAFADAPI: jest.fn(),
  fetchFromKandilliAPI: jest.fn(),
}));

jest.mock('../earthquake/EarthquakeCacheManager', () => ({
  loadFromCache: jest.fn(),
  saveToCache: jest.fn().mockResolvedValue(undefined),
  getCacheAge: jest.fn().mockResolvedValue(1),
}));

jest.mock('../earthquake/EarthquakeDataProcessor', () => ({
  filterByTurkeyBounds: jest.fn((items) => items),
}));

jest.mock('../earthquake/EarthquakeDeduplicator', () => ({
  deduplicateEarthquakes: jest.fn((items) => items),
}));

jest.mock('../../ai/services/EarthquakeValidationService', () => ({
  earthquakeValidationService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    validateBatch: jest.fn(async (items) => ({ valid: items, invalid: [] })),
  },
}));

jest.mock('../earthquake/EarthquakeNotificationHandler', () => ({
  processEarthquakeNotifications: jest.fn().mockResolvedValue(undefined),
}));

const mockedFetchAllEarthquakes = fetchAllEarthquakes as jest.MockedFunction<typeof fetchAllEarthquakes>;
const mockedLoadFromCache = loadFromCache as jest.MockedFunction<typeof loadFromCache>;
const mockedSaveToCache = saveToCache as jest.MockedFunction<typeof saveToCache>;
const mockFetch = jest.fn();

(global as any).fetch = mockFetch;

describe('EarthquakeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    useEarthquakeStore.setState({
      items: [],
      loading: false,
      error: null,
      lastUpdate: null,
    });
  });

  it('is singleton and exposes required methods', () => {
    expect(earthquakeService).toBeDefined();
    expect(typeof earthquakeService.fetchEarthquakes).toBe('function');
    expect(typeof earthquakeService.fetchEarthquakeDetail).toBe('function');
  });

  it('updates store items when upstream fetch succeeds', async () => {
    mockedFetchAllEarthquakes.mockResolvedValueOnce({
      earthquakes: [
        {
          id: 'afad-1',
          magnitude: 3.8,
          latitude: 41.0,
          longitude: 29.0,
          depth: 10,
          location: 'Istanbul',
          time: Date.now(),
          source: 'AFAD',
        },
      ],
      sources: {
        afadHTML: true,
        afadAPI: true,
        kandilliAPI: false,
      },
    } as any);

    await earthquakeService.fetchEarthquakes();

    const state = useEarthquakeStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(mockedSaveToCache).toHaveBeenCalled();
  });

  it('keeps service stable on empty upstream response', async () => {
    mockedFetchAllEarthquakes.mockResolvedValueOnce({
      earthquakes: [],
      sources: {
        afadHTML: false,
        afadAPI: false,
        kandilliAPI: false,
      },
    } as any);

    await expect(earthquakeService.fetchEarthquakes()).resolves.toBeUndefined();

    const state = useEarthquakeStore.getState();
    expect(state.loading).toBe(false);
  });

  it('sets an error when fetch throws and cache is unavailable', async () => {
    mockedFetchAllEarthquakes.mockRejectedValueOnce(new Error('Network error'));
    mockedLoadFromCache.mockResolvedValueOnce(null);

    await expect(earthquakeService.fetchEarthquakes()).resolves.toBeUndefined();

    const state = useEarthquakeStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.error).toBeTruthy();
    expect(state.loading).toBe(false);
  });

  it('fetchEarthquakeDetail returns null when API is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn(),
      text: jest.fn().mockResolvedValue('not found'),
    } as any);

    const result = await earthquakeService.fetchEarthquakeDetail('missing');

    expect(result).toBeNull();
  });
});
