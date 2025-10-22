import { QuakeItem } from '../services/quake/types';
import { RegionFilter } from '../store/settings';

// Turkish province names and codes mapping
export const PROVINCES = {
  '01': 'Adana',
  '02': 'Adıyaman',
  '03': 'Afyonkarahisar',
  '04': 'Ağrı',
  '05': 'Amasya',
  '06': 'Ankara',
  '07': 'Antalya',
  '08': 'Artvin',
  '09': 'Aydın',
  '10': 'Balıkesir',
  '11': 'Bilecik',
  '12': 'Bingöl',
  '13': 'Bitlis',
  '14': 'Bolu',
  '15': 'Burdur',
  '16': 'Bursa',
  '17': 'Çanakkale',
  '18': 'Çankırı',
  '19': 'Çorum',
  '20': 'Denizli',
  '21': 'Diyarbakır',
  '22': 'Edirne',
  '23': 'Elazığ',
  '24': 'Erzincan',
  '25': 'Erzurum',
  '26': 'Eskişehir',
  '27': 'Gaziantep',
  '28': 'Giresun',
  '29': 'Gümüşhane',
  '30': 'Hakkari',
  '31': 'Hatay',
  '32': 'Isparta',
  '33': 'Mersin',
  '34': 'İstanbul',
  '35': 'İzmir',
  '36': 'Kars',
  '37': 'Kastamonu',
  '38': 'Kayseri',
  '39': 'Kırklareli',
  '40': 'Kırşehir',
  '41': 'Kocaeli',
  '42': 'Konya',
  '43': 'Kütahya',
  '44': 'Malatya',
  '45': 'Manisa',
  '46': 'Kahramanmaraş',
  '47': 'Mardin',
  '48': 'Muğla',
  '49': 'Muş',
  '50': 'Nevşehir',
  '51': 'Niğde',
  '52': 'Ordu',
  '53': 'Rize',
  '54': 'Sakarya',
  '55': 'Samsun',
  '56': 'Siirt',
  '57': 'Sinop',
  '58': 'Sivas',
  '59': 'Tekirdağ',
  '60': 'Tokat',
  '61': 'Trabzon',
  '62': 'Tunceli',
  '63': 'Şanlıurfa',
  '64': 'Uşak',
  '65': 'Van',
  '66': 'Yozgat',
  '67': 'Zonguldak',
  '68': 'Aksaray',
  '69': 'Bayburt',
  '70': 'Karaman',
  '71': 'Kırıkkale',
  '72': 'Batman',
  '73': 'Şırnak',
  '74': 'Bartın',
  '75': 'Ardahan',
  '76': 'Iğdır',
  '77': 'Yalova',
  '78': 'Karabük',
  '79': 'Kilis',
  '80': 'Osmaniye',
  '81': 'Düzce',
};

// Haversine distance calculation
export function haversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
}

export function inProvince(quake: QuakeItem, codes: string[]): boolean {
  if (!quake.lat || !quake.lon) {
    // Fallback to text matching if coordinates not available
    const place = quake.place.toLowerCase();
    return codes.some(code => {
      const provinceName = PROVINCES[code as keyof typeof PROVINCES];
      return provinceName && place.includes(provinceName.toLowerCase());
    });
  }

  // Simple bounding box approach for major provinces
  // This is a simplified implementation - in production, use proper geographic boundaries
  const bounds: Record<string, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
    '06': { minLat: 39.5, maxLat: 40.2, minLon: 32.4, maxLon: 33.4 }, // Ankara
    '34': { minLat: 40.8, maxLat: 41.3, minLon: 28.5, maxLon: 29.5 }, // İstanbul
    '35': { minLat: 38.0, maxLat: 38.8, minLon: 26.5, maxLon: 27.5 }, // İzmir
    '16': { minLat: 39.9, maxLat: 40.5, minLon: 28.9, maxLon: 29.9 }, // Bursa
    '07': { minLat: 36.0, maxLat: 37.2, minLon: 30.0, maxLon: 31.5 }, // Antalya
    '01': { minLat: 36.8, maxLat: 37.5, minLon: 35.0, maxLon: 36.0 }, // Adana
  };

  return codes.some(code => {
    const bound = bounds[code];
    if (!bound) {
      // Fallback to text matching for provinces without bounds
      const provinceName = PROVINCES[code as keyof typeof PROVINCES];
      return provinceName && quake.place.toLowerCase().includes(provinceName.toLowerCase());
    }
    
    return quake.lat! >= bound.minLat && quake.lat! <= bound.maxLat &&
           quake.lon! >= bound.minLon && quake.lon! <= bound.maxLon;
  });
}

export function inCircle(
  quake: QuakeItem, 
  centerLat: number, 
  centerLon: number, 
  radiusKm: number,
): boolean {
  if (!quake.lat || !quake.lon) {
    return false;
  }

  const distanceM = haversineDistance(quake.lat, quake.lon, centerLat, centerLon);
  return distanceM <= (radiusKm * 1000);
}

export function matchesRegionFilter(quake: QuakeItem, filter: RegionFilter): boolean {
  switch (filter.type) {
  case 'all':
    return true;
  case 'province':
    return inProvince(quake, filter.codes);
  case 'circle':
    return inCircle(quake, filter.lat, filter.lon, filter.km);
  default:
    return true;
  }
}

export function getRegionDisplayName(filter: RegionFilter): string {
  switch (filter.type) {
  case 'all':
    return 'Tüm Türkiye';
  case 'province':
    if (filter.codes.length === 0) return 'İl seçilmedi';
    if (filter.codes.length === 1) {
      const code = filter.codes[0];
      return PROVINCES[code as keyof typeof PROVINCES] || code;
    }
    return `${filter.codes.length} il`;
  case 'circle':
    return `${filter.km}km yarıçap (${filter.lat.toFixed(2)}, ${filter.lon.toFixed(2)})`;
  default:
    return 'Bilinmeyen';
  }
}
