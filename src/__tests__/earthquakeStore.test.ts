/**
 * EARTHQUAKE STORE TESTS - CURRENT API
 */

import { useEarthquakeStore } from '../core/stores/earthquakeStore';

describe('EarthquakeStore', () => {
  beforeEach(() => {
    useEarthquakeStore.setState({
      items: [],
      loading: false,
      error: null,
      lastUpdate: null,
    });
  });

  test('initial state should be empty', () => {
    const state = useEarthquakeStore.getState();
    expect(state.items).toEqual([]);
    expect(state.loading).toBe(false);
  });

  test('setItems should update items array', () => {
    const mockEarthquakes = [
      {
        id: 'test-1',
        magnitude: 4.5,
        latitude: 41.0082,
        longitude: 28.9784,
        depth: 10,
        location: 'Istanbul',
        time: Date.now(),
        source: 'AFAD' as const,
      },
      {
        id: 'test-2',
        magnitude: 5.2,
        latitude: 39.9334,
        longitude: 32.8597,
        depth: 15,
        location: 'Ankara',
        time: Date.now(),
        source: 'KANDILLI' as const,
      },
    ];

    useEarthquakeStore.getState().setItems(mockEarthquakes);

    const state = useEarthquakeStore.getState();
    expect(state.items).toHaveLength(2);
    expect(state.items[0].magnitude).toBe(4.5);
    expect(state.items[1].location).toBe('Ankara');
    expect(typeof state.lastUpdate).toBe('number');
  });

  test('setLoading should update loading state', () => {
    useEarthquakeStore.getState().setLoading(true);
    expect(useEarthquakeStore.getState().loading).toBe(true);

    useEarthquakeStore.getState().setLoading(false);
    expect(useEarthquakeStore.getState().loading).toBe(false);
  });

  test('earthquake should pass custom matcher', () => {
    const validEarthquake = {
      id: 'valid-eq-1',
      magnitude: 4.5,
      latitude: 41.0,
      longitude: 28.9,
      depth: 10,
      location: 'Test Location',
      time: Date.now(),
      source: 'AFAD' as const,
    };

    expect(validEarthquake).toBeValidEarthquake();
  });

  test('should filter earthquakes by magnitude', () => {
    const mockEarthquakes = [
      { id: '1', magnitude: 2.0, latitude: 41.0, longitude: 28.9, depth: 5, location: 'A', time: Date.now(), source: 'AFAD' as const },
      { id: '2', magnitude: 4.0, latitude: 41.0, longitude: 28.9, depth: 5, location: 'B', time: Date.now(), source: 'AFAD' as const },
      { id: '3', magnitude: 5.5, latitude: 41.0, longitude: 28.9, depth: 5, location: 'C', time: Date.now(), source: 'AFAD' as const },
    ];

    useEarthquakeStore.getState().setItems(mockEarthquakes);

    const state = useEarthquakeStore.getState();
    const significantEarthquakes = state.items.filter((e) => e.magnitude >= 4.0);

    expect(significantEarthquakes).toHaveLength(2);
    expect(significantEarthquakes.every((e) => e.magnitude >= 4.0)).toBe(true);
  });
});
