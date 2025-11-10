/**
 * EARTHQUAKE STORE TESTS
 * Critical state management
 */

import { useEarthquakeStore } from '../../src/core/stores/earthquakeStore';
import { Earthquake } from '../../src/core/types/earthquake';

describe('Earthquake Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useEarthquakeStore.setState({
      items: [],
      loading: false,
      error: null,
    });
  });

  describe('Initial State', () => {
    it('should have empty items array', () => {
      const state = useEarthquakeStore.getState();
      expect(state.items).toEqual([]);
    });

    it('should not be loading initially', () => {
      const state = useEarthquakeStore.getState();
      expect(state.loading).toBe(false);
    });

    it('should have no error initially', () => {
      const state = useEarthquakeStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('setItems', () => {
    it('should set earthquake items', () => {
      const mockEarthquakes: Earthquake[] = [
        {
          id: 'eq1',
          magnitude: 4.5,
          location: 'Test Location',
          latitude: 41.0,
          longitude: 28.0,
          depth: 10,
          time: Date.now(),
          source: 'AFAD',
        },
      ];

      useEarthquakeStore.getState().setItems(mockEarthquakes);
      
      const state = useEarthquakeStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('eq1');
    });

    it('should replace existing items', () => {
      const first: Earthquake[] = [
        {
          id: 'eq1',
          magnitude: 4.0,
          location: 'First',
          latitude: 40.0,
          longitude: 28.0,
          depth: 5,
          time: Date.now(),
          source: 'AFAD',
        },
      ];

      const second: Earthquake[] = [
        {
          id: 'eq2',
          magnitude: 5.0,
          location: 'Second',
          latitude: 41.0,
          longitude: 29.0,
          depth: 8,
          time: Date.now(),
          source: 'USGS',
        },
      ];

      useEarthquakeStore.getState().setItems(first);
      useEarthquakeStore.getState().setItems(second);
      
      const state = useEarthquakeStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('eq2');
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      useEarthquakeStore.getState().setLoading(true);
      expect(useEarthquakeStore.getState().loading).toBe(true);
      
      useEarthquakeStore.getState().setLoading(false);
      expect(useEarthquakeStore.getState().loading).toBe(false);
    });

    it('should clear error when loading starts', () => {
      useEarthquakeStore.getState().setError('Test error');
      useEarthquakeStore.getState().setLoading(true);
      
      const state = useEarthquakeStore.getState();
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      useEarthquakeStore.getState().setError('Network error');
      
      const state = useEarthquakeStore.getState();
      expect(state.error).toBe('Network error');
    });

    it('should stop loading when error is set', () => {
      useEarthquakeStore.getState().setLoading(true);
      useEarthquakeStore.getState().setError('Error occurred');
      
      const state = useEarthquakeStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Error occurred');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle rapid state changes', () => {
      const store = useEarthquakeStore.getState();
      
      store.setLoading(true);
      store.setLoading(false);
      store.setError('Error 1');
      store.setError(null);
      
      const state = useEarthquakeStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should maintain items during error', () => {
      const mockEarthquakes: Earthquake[] = [
        {
          id: 'eq1',
          magnitude: 4.5,
          location: 'Test',
          latitude: 41.0,
          longitude: 28.0,
          depth: 10,
          time: Date.now(),
          source: 'AFAD',
        },
      ];

      useEarthquakeStore.getState().setItems(mockEarthquakes);
      useEarthquakeStore.getState().setError('Network error');
      
      const state = useEarthquakeStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.error).toBe('Network error');
    });
  });
});

