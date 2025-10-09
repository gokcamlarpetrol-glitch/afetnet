import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssemblyPoint } from './types';

const STORAGE_KEY = 'afn/assembly/v1';

export async function loadBundledAssembly(): Promise<AssemblyPoint[]> {
  try {
    const bundledPath = `${FileSystem.bundleDirectory}assets/assembly/assembly_tr_sample.geojson`;
    const fileInfo = await FileSystem.getInfoAsync(bundledPath);
    
    if (!fileInfo.exists) {
      console.warn('Bundled assembly points not found');
      return [];
    }

    const content = await FileSystem.readAsStringAsync(bundledPath);
    const geojson = JSON.parse(content);
    
    return parseGeoJSON(geojson);
  } catch (error) {
    console.error('Failed to load bundled assembly points:', error);
    return [];
  }
}

export async function importAssemblyFromFile(uri: string): Promise<number> {
  try {
    const content = await FileSystem.readAsStringAsync(uri);
    let assemblyPoints: AssemblyPoint[] = [];

    if (uri.endsWith('.geojson') || uri.endsWith('.json')) {
      const geojson = JSON.parse(content);
      assemblyPoints = parseGeoJSON(geojson);
    } else if (uri.endsWith('.csv')) {
      assemblyPoints = parseCSV(content);
    } else {
      throw new Error('Unsupported file format');
    }

    // Load existing points
    const existing = await listAssembly();
    
    // Add new points with source tracking
    const newPoints = assemblyPoints.map(point => ({
      ...point,
      source: uri,
      id: point.id || `imported_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }));

    const updatedPoints = [...existing, ...newPoints];
    
    // Save to storage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPoints));
    
    return newPoints.length;
  } catch (error) {
    console.error('Failed to import assembly points:', error);
    throw error;
  }
}

export async function listAssembly(): Promise<AssemblyPoint[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Try to load bundled data on first run
      const bundled = await loadBundledAssembly();
      if (bundled.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bundled));
        return bundled;
      }
      return [];
    }
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to list assembly points:', error);
    return [];
  }
}

function parseGeoJSON(geojson: any): AssemblyPoint[] {
  if (!geojson.features || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON format');
  }

  return geojson.features.map((feature: any, index: number) => {
    if (!feature.geometry || feature.geometry.type !== 'Point') {
      throw new Error(`Feature ${index} is not a Point geometry`);
    }

    const [lon, lat] = feature.geometry.coordinates;
    const props = feature.properties || {};

    return {
      id: props.id || `geojson_${index}`,
      name: props.name,
      lat,
      lon,
      addr: props.address || props.addr,
      district: props.district,
      city: props.city,
      capacity: props.capacity,
      type: props.type,
      contact: props.contact,
      source: 'bundled'
    };
  });
}

function parseCSV(content: string): AssemblyPoint[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const requiredHeaders = ['lat', 'lon'];
  
  for (const req of requiredHeaders) {
    if (!headers.includes(req)) {
      throw new Error(`CSV missing required column: ${req}`);
    }
  }

  const points: AssemblyPoint[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon);
    
    if (isNaN(lat) || isNaN(lon)) {
      console.warn(`Skipping invalid row ${i}: invalid coordinates`);
      continue;
    }

    points.push({
      id: row.id || `csv_${i}`,
      name: row.name,
      lat,
      lon,
      addr: row.address || row.addr,
      district: row.district,
      city: row.city,
      capacity: row.capacity ? parseInt(row.capacity) : undefined,
      type: row.type,
      contact: row.contact,
      source: 'imported'
    });
  }

  return points;
}

export async function clearAssembly(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function removeAssemblyPoint(id: string): Promise<void> {
  const points = await listAssembly();
  const filtered = points.filter(p => p.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
