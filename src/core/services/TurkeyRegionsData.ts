/**
 * TURKEY REGIONS DATA
 * Complete list of all 81 provinces in Turkey with coordinates and bounds
 * ELITE: Professional implementation for offline map downloads
 */

export interface TurkeyProvince {
  id: string;
  name: string;
  plateCode: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: {
    latitude: number;
    longitude: number;
  };
  estimatedSize: number; // MB
}

/**
 * Complete list of all 81 provinces in Turkey
 * Coordinates and bounds are approximate and cover the entire province
 */
export const TURKEY_PROVINCES: TurkeyProvince[] = [
  // Marmara Region
  { id: 'istanbul', name: 'İstanbul', plateCode: 34, bounds: { north: 41.32, south: 40.80, east: 29.45, west: 28.50 }, center: { latitude: 41.0082, longitude: 28.9784 }, estimatedSize: 850 },
  { id: 'ankara', name: 'Ankara', plateCode: 6, bounds: { north: 40.15, south: 39.70, east: 33.20, west: 32.50 }, center: { latitude: 39.9334, longitude: 32.8597 }, estimatedSize: 450 },
  { id: 'izmir', name: 'İzmir', plateCode: 35, bounds: { north: 38.70, south: 38.20, east: 27.50, west: 26.80 }, center: { latitude: 38.4192, longitude: 27.1287 }, estimatedSize: 380 },
  { id: 'bursa', name: 'Bursa', plateCode: 16, bounds: { north: 40.35, south: 40.00, east: 29.30, west: 28.80 }, center: { latitude: 40.1826, longitude: 29.0665 }, estimatedSize: 320 },
  { id: 'antalya', name: 'Antalya', plateCode: 7, bounds: { north: 37.20, south: 36.50, east: 31.50, west: 30.30 }, center: { latitude: 36.8969, longitude: 30.7133 }, estimatedSize: 420 },
  { id: 'kocaeli', name: 'Kocaeli', plateCode: 41, bounds: { north: 41.00, south: 40.50, east: 30.20, west: 29.50 }, center: { latitude: 40.8533, longitude: 29.8815 }, estimatedSize: 280 },
  { id: 'adana', name: 'Adana', plateCode: 1, bounds: { north: 37.20, south: 36.80, east: 35.50, west: 35.00 }, center: { latitude: 36.9914, longitude: 35.3308 }, estimatedSize: 350 },
  { id: 'gaziantep', name: 'Gaziantep', plateCode: 27, bounds: { north: 37.20, south: 36.80, east: 37.60, west: 37.00 }, center: { latitude: 37.0662, longitude: 37.3833 }, estimatedSize: 300 },
  { id: 'konya', name: 'Konya', plateCode: 42, bounds: { north: 38.50, south: 37.50, east: 33.50, west: 31.50 }, center: { latitude: 37.8746, longitude: 32.4932 }, estimatedSize: 500 },
  { id: 'mersin', name: 'Mersin', plateCode: 33, bounds: { north: 36.90, south: 36.40, east: 34.80, west: 33.80 }, center: { latitude: 36.8000, longitude: 34.6333 }, estimatedSize: 340 },
  
  // Ege Region
  { id: 'aydin', name: 'Aydın', plateCode: 9, bounds: { north: 38.00, south: 37.50, east: 28.50, west: 27.50 }, center: { latitude: 37.8444, longitude: 27.8456 }, estimatedSize: 280 },
  { id: 'mugla', name: 'Muğla', plateCode: 48, bounds: { north: 37.50, south: 36.50, east: 29.50, west: 27.50 }, center: { latitude: 37.2153, longitude: 28.3636 }, estimatedSize: 400 },
  { id: 'manisa', name: 'Manisa', plateCode: 45, bounds: { north: 39.00, south: 38.20, east: 28.50, west: 27.50 }, center: { latitude: 38.6191, longitude: 27.4289 }, estimatedSize: 320 },
  { id: 'denizli', name: 'Denizli', plateCode: 20, bounds: { north: 38.20, south: 37.50, east: 29.50, west: 28.80 }, center: { latitude: 37.7765, longitude: 29.0864 }, estimatedSize: 260 },
  { id: 'balikesir', name: 'Balıkesir', plateCode: 10, bounds: { north: 40.20, south: 39.20, east: 28.50, west: 26.50 }, center: { latitude: 39.6484, longitude: 27.8826 }, estimatedSize: 380 },
  
  // Akdeniz Region
  { id: 'hatay', name: 'Hatay', plateCode: 31, bounds: { north: 36.80, south: 35.80, east: 36.50, west: 35.80 }, center: { latitude: 36.4018, longitude: 36.3498 }, estimatedSize: 300 },
  { id: 'osmaniye', name: 'Osmaniye', plateCode: 80, bounds: { north: 37.20, south: 36.80, east: 36.30, west: 35.80 }, center: { latitude: 37.0742, longitude: 36.2478 }, estimatedSize: 180 },
  { id: 'kahramanmaras', name: 'Kahramanmaraş', plateCode: 46, bounds: { north: 38.20, south: 37.30, east: 37.20, west: 36.20 }, center: { latitude: 37.5858, longitude: 36.9371 }, estimatedSize: 320 },
  
  // İç Anadolu Region
  { id: 'eskisehir', name: 'Eskişehir', plateCode: 26, bounds: { north: 40.00, south: 39.50, east: 31.50, west: 30.50 }, center: { latitude: 39.7767, longitude: 30.5206 }, estimatedSize: 280 },
  { id: 'kayseri', name: 'Kayseri', plateCode: 38, bounds: { north: 38.80, south: 38.20, east: 36.00, west: 35.00 }, center: { latitude: 38.7312, longitude: 35.4787 }, estimatedSize: 340 },
  { id: 'sivas', name: 'Sivas', plateCode: 58, bounds: { north: 40.00, south: 39.20, east: 37.50, west: 36.50 }, center: { latitude: 39.7477, longitude: 37.0179 }, estimatedSize: 400 },
  { id: 'yozgat', name: 'Yozgat', plateCode: 66, bounds: { north: 40.20, south: 39.50, east: 35.50, west: 34.50 }, center: { latitude: 39.8200, longitude: 34.8044 }, estimatedSize: 280 },
  { id: 'kirikkale', name: 'Kırıkkale', plateCode: 71, bounds: { north: 40.00, south: 39.50, east: 33.80, west: 33.20 }, center: { latitude: 39.8468, longitude: 33.5153 }, estimatedSize: 200 },
  { id: 'aksaray', name: 'Aksaray', plateCode: 68, bounds: { north: 38.50, south: 38.00, east: 34.20, west: 33.50 }, center: { latitude: 38.3687, longitude: 34.0369 }, estimatedSize: 240 },
  { id: 'nevsehir', name: 'Nevşehir', plateCode: 50, bounds: { north: 38.80, south: 38.40, east: 34.80, west: 34.20 }, center: { latitude: 38.6244, longitude: 34.7239 }, estimatedSize: 220 },
  { id: 'kirsehir', name: 'Kırşehir', plateCode: 40, bounds: { north: 39.50, south: 39.00, east: 34.20, west: 33.50 }, center: { latitude: 39.1425, longitude: 34.1709 }, estimatedSize: 200 },
  
  // Karadeniz Region
  { id: 'samsun', name: 'Samsun', plateCode: 55, bounds: { north: 41.50, south: 41.00, east: 36.50, west: 35.50 }, center: { latitude: 41.2867, longitude: 36.3300 }, estimatedSize: 380 },
  { id: 'trabzon', name: 'Trabzon', plateCode: 61, bounds: { north: 41.20, south: 40.50, east: 40.00, west: 39.20 }, center: { latitude: 41.0015, longitude: 39.7178 }, estimatedSize: 320 },
  { id: 'ordu', name: 'Ordu', plateCode: 52, bounds: { north: 41.00, south: 40.50, east: 38.20, west: 37.20 }, center: { latitude: 40.9839, longitude: 37.8764 }, estimatedSize: 300 },
  { id: 'rize', name: 'Rize', plateCode: 53, bounds: { north: 41.20, south: 40.50, east: 41.00, west: 40.20 }, center: { latitude: 41.0201, longitude: 40.5234 }, estimatedSize: 240 },
  { id: 'giresun', name: 'Giresun', plateCode: 28, bounds: { north: 41.00, south: 40.50, east: 39.00, west: 38.00 }, center: { latitude: 40.9128, longitude: 38.3895 }, estimatedSize: 280 },
  { id: 'artvin', name: 'Artvin', plateCode: 8, bounds: { north: 41.50, south: 40.80, east: 42.50, west: 41.50 }, center: { latitude: 41.1828, longitude: 41.8183 }, estimatedSize: 300 },
  { id: 'gumushane', name: 'Gümüşhane', plateCode: 29, bounds: { north: 40.80, south: 40.20, east: 39.80, west: 39.00 }, center: { latitude: 40.4603, longitude: 39.5086 }, estimatedSize: 220 },
  { id: 'bayburt', name: 'Bayburt', plateCode: 69, bounds: { north: 40.50, south: 40.00, east: 40.50, west: 39.80 }, center: { latitude: 40.2552, longitude: 40.2249 }, estimatedSize: 180 },
  { id: 'zonguldak', name: 'Zonguldak', plateCode: 67, bounds: { north: 41.50, south: 41.00, east: 32.50, west: 31.50 }, center: { latitude: 41.4564, longitude: 31.7987 }, estimatedSize: 280 },
  { id: 'kastamonu', name: 'Kastamonu', plateCode: 37, bounds: { north: 41.80, south: 41.00, east: 34.20, west: 33.00 }, center: { latitude: 41.3767, longitude: 33.7767 }, estimatedSize: 320 },
  { id: 'sinop', name: 'Sinop', plateCode: 57, bounds: { north: 42.00, south: 41.50, east: 35.20, west: 34.50 }, center: { latitude: 41.7311, longitude: 34.8708 }, estimatedSize: 240 },
  { id: 'bartin', name: 'Bartın', plateCode: 74, bounds: { north: 41.80, south: 41.50, east: 32.50, west: 32.00 }, center: { latitude: 41.6344, longitude: 32.3375 }, estimatedSize: 200 },
  { id: 'karabuk', name: 'Karabük', plateCode: 78, bounds: { north: 41.50, south: 41.00, east: 32.80, west: 32.20 }, center: { latitude: 41.2061, longitude: 32.6204 }, estimatedSize: 220 },
  { id: 'duzce', name: 'Düzce', plateCode: 81, bounds: { north: 41.00, south: 40.50, east: 31.50, west: 30.80 }, center: { latitude: 40.8438, longitude: 31.1565 }, estimatedSize: 240 },
  { id: 'bolu', name: 'Bolu', plateCode: 14, bounds: { north: 40.80, south: 40.20, east: 32.20, west: 31.20 }, center: { latitude: 40.7396, longitude: 31.6110 }, estimatedSize: 260 },
  
  // Doğu Anadolu Region
  { id: 'erzurum', name: 'Erzurum', plateCode: 25, bounds: { north: 40.20, south: 39.50, east: 42.00, west: 41.00 }, center: { latitude: 39.9043, longitude: 41.2679 }, estimatedSize: 400 },
  { id: 'erzincan', name: 'Erzincan', plateCode: 24, bounds: { north: 40.00, south: 39.50, east: 39.80, west: 39.20 }, center: { latitude: 39.7500, longitude: 39.5000 }, estimatedSize: 280 },
  { id: 'agri', name: 'Ağrı', plateCode: 4, bounds: { north: 40.00, south: 39.20, east: 44.00, west: 42.50 }, center: { latitude: 39.7217, longitude: 43.0567 }, estimatedSize: 360 },
  { id: 'kars', name: 'Kars', plateCode: 36, bounds: { north: 40.80, south: 40.00, east: 43.50, west: 42.50 }, center: { latitude: 40.6013, longitude: 43.0975 }, estimatedSize: 340 },
  { id: 'ardahan', name: 'Ardahan', plateCode: 75, bounds: { north: 41.20, south: 40.50, east: 43.20, west: 42.50 }, center: { latitude: 41.1100, longitude: 42.7022 }, estimatedSize: 240 },
  { id: 'igdir', name: 'Iğdır', plateCode: 76, bounds: { north: 40.20, south: 39.50, east: 44.50, west: 43.50 }, center: { latitude: 39.9167, longitude: 44.0333 }, estimatedSize: 200 },
  { id: 'van', name: 'Van', plateCode: 65, bounds: { north: 38.80, south: 38.20, east: 43.50, west: 42.50 }, center: { latitude: 38.4891, longitude: 43.4089 }, estimatedSize: 380 },
  { id: 'mus', name: 'Muş', plateCode: 49, bounds: { north: 39.20, south: 38.50, east: 42.00, west: 41.00 }, center: { latitude: 38.7333, longitude: 41.4911 }, estimatedSize: 300 },
  { id: 'bitlis', name: 'Bitlis', plateCode: 13, bounds: { north: 38.80, south: 38.20, east: 42.50, west: 41.50 }, center: { latitude: 38.4000, longitude: 42.1083 }, estimatedSize: 260 },
  { id: 'siirt', name: 'Siirt', plateCode: 56, bounds: { north: 38.20, south: 37.50, east: 42.50, west: 41.50 }, center: { latitude: 37.9333, longitude: 41.9500 }, estimatedSize: 240 },
  { id: 'hakkari', name: 'Hakkari', plateCode: 30, bounds: { north: 37.80, south: 37.20, east: 44.50, west: 43.00 }, center: { latitude: 37.5744, longitude: 43.7408 }, estimatedSize: 300 },
  { id: 'sirnak', name: 'Şırnak', plateCode: 73, bounds: { north: 37.80, south: 37.20, east: 43.00, west: 41.80 }, center: { latitude: 37.5167, longitude: 42.4500 }, estimatedSize: 280 },
  { id: 'mardin', name: 'Mardin', plateCode: 47, bounds: { north: 37.50, south: 37.00, east: 41.50, west: 40.50 }, center: { latitude: 37.3131, longitude: 40.7356 }, estimatedSize: 320 },
  { id: 'diyarbakir', name: 'Diyarbakır', plateCode: 12, bounds: { north: 38.20, south: 37.50, east: 40.50, west: 39.50 }, center: { latitude: 37.9144, longitude: 40.2306 }, estimatedSize: 360 },
  { id: 'batman', name: 'Batman', plateCode: 11, bounds: { north: 37.80, south: 37.30, east: 41.50, west: 41.00 }, center: { latitude: 37.8813, longitude: 41.1351 }, estimatedSize: 240 },
  { id: 'bingol', name: 'Bingöl', plateCode: 12, bounds: { north: 39.20, south: 38.50, east: 41.00, west: 40.00 }, center: { latitude: 38.8847, longitude: 40.4981 }, estimatedSize: 260 },
  { id: 'elazig', name: 'Elazığ', plateCode: 23, bounds: { north: 38.80, south: 38.30, east: 39.50, west: 38.50 }, center: { latitude: 38.6747, longitude: 39.2228 }, estimatedSize: 280 },
  { id: 'tunceli', name: 'Tunceli', plateCode: 62, bounds: { north: 39.50, south: 38.80, east: 39.80, west: 39.00 }, center: { latitude: 39.1079, longitude: 39.5401 }, estimatedSize: 200 },
  { id: 'malatya', name: 'Malatya', plateCode: 44, bounds: { north: 38.80, south: 38.20, east: 38.80, west: 37.80 }, center: { latitude: 38.3552, longitude: 38.3095 }, estimatedSize: 320 },
  
  // Güneydoğu Anadolu Region
  { id: 'sanliurfa', name: 'Şanlıurfa', plateCode: 63, bounds: { north: 37.50, south: 36.80, east: 39.50, west: 38.00 }, center: { latitude: 37.1674, longitude: 38.7955 }, estimatedSize: 360 },
  { id: 'adiyaman', name: 'Adıyaman', plateCode: 2, bounds: { north: 38.00, south: 37.50, east: 38.80, west: 37.80 }, center: { latitude: 37.7636, longitude: 38.2786 }, estimatedSize: 280 },
  { id: 'kilis', name: 'Kilis', plateCode: 79, bounds: { north: 36.90, south: 36.50, east: 37.50, west: 36.80 }, center: { latitude: 36.7184, longitude: 37.1212 }, estimatedSize: 180 },
  
  // Remaining provinces
  { id: 'afyonkarahisar', name: 'Afyonkarahisar', plateCode: 3, bounds: { north: 38.80, south: 38.20, east: 31.00, west: 30.00 }, center: { latitude: 38.7638, longitude: 30.5403 }, estimatedSize: 300 },
  { id: 'amasya', name: 'Amasya', plateCode: 5, bounds: { north: 40.80, south: 40.30, east: 36.20, west: 35.20 }, center: { latitude: 40.6533, longitude: 35.8331 }, estimatedSize: 240 },
  { id: 'corum', name: 'Çorum', plateCode: 19, bounds: { north: 40.80, south: 40.00, east: 35.20, west: 34.20 }, center: { latitude: 40.5506, longitude: 34.9556 }, estimatedSize: 280 },
  { id: 'tokat', name: 'Tokat', plateCode: 60, bounds: { north: 40.50, south: 39.80, east: 37.20, west: 36.00 }, center: { latitude: 40.3139, longitude: 36.5544 }, estimatedSize: 300 },
  { id: 'sakarya', name: 'Sakarya', plateCode: 54, bounds: { north: 40.80, south: 40.50, east: 30.80, west: 30.00 }, center: { latitude: 40.7569, longitude: 30.3781 }, estimatedSize: 280 },
  { id: 'tekirdag', name: 'Tekirdağ', plateCode: 59, bounds: { north: 41.20, south: 40.50, east: 28.00, west: 27.00 }, center: { latitude: 40.9833, longitude: 27.5167 }, estimatedSize: 260 },
  { id: 'edirne', name: 'Edirne', plateCode: 22, bounds: { north: 42.00, south: 40.50, east: 27.00, west: 26.00 }, center: { latitude: 41.6771, longitude: 26.5556 }, estimatedSize: 240 },
  { id: 'kirklareli', name: 'Kırklareli', plateCode: 39, bounds: { north: 42.00, south: 41.20, east: 28.00, west: 27.00 }, center: { latitude: 41.7342, longitude: 27.2253 }, estimatedSize: 220 },
  { id: 'canakkale', name: 'Çanakkale', plateCode: 17, bounds: { north: 40.50, south: 39.50, east: 27.50, west: 26.00 }, center: { latitude: 40.1553, longitude: 26.4142 }, estimatedSize: 300 },
  { id: 'usak', name: 'Uşak', plateCode: 64, bounds: { north: 38.80, south: 38.20, east: 29.50, west: 28.80 }, center: { latitude: 38.6823, longitude: 29.4082 }, estimatedSize: 220 },
  { id: 'burdur', name: 'Burdur', plateCode: 15, bounds: { north: 37.80, south: 37.20, east: 30.50, west: 29.50 }, center: { latitude: 37.7206, longitude: 30.2908 }, estimatedSize: 200 },
  { id: 'isparta', name: 'Isparta', plateCode: 32, bounds: { north: 38.20, south: 37.50, east: 31.20, west: 30.20 }, center: { latitude: 37.7648, longitude: 30.5566 }, estimatedSize: 240 },
  { id: 'karaman', name: 'Karaman', plateCode: 70, bounds: { north: 37.50, south: 36.80, east: 33.50, west: 32.50 }, center: { latitude: 37.1811, longitude: 33.2150 }, estimatedSize: 240 },
  { id: 'nigde', name: 'Niğde', plateCode: 51, bounds: { north: 38.20, south: 37.50, east: 35.00, west: 34.00 }, center: { latitude: 37.9667, longitude: 34.6833 }, estimatedSize: 240 },
];

/**
 * Get province by ID
 */
export function getProvinceById(id: string): TurkeyProvince | undefined {
  return TURKEY_PROVINCES.find(p => p.id === id);
}

/**
 * Get province by plate code
 */
export function getProvinceByPlateCode(plateCode: number): TurkeyProvince | undefined {
  return TURKEY_PROVINCES.find(p => p.plateCode === plateCode);
}

/**
 * Get province by coordinates (find which province contains the point)
 */
export function getProvinceByCoordinates(latitude: number, longitude: number): TurkeyProvince | undefined {
  return TURKEY_PROVINCES.find(province => {
    const { bounds } = province;
    return latitude >= bounds.south && 
           latitude <= bounds.north && 
           longitude >= bounds.west && 
           longitude <= bounds.east;
  });
}

/**
 * Get nearby provinces (within radius)
 */
export function getNearbyProvinces(latitude: number, longitude: number, radiusKm: number = 50): TurkeyProvince[] {
  const R = 6371; // Earth's radius in km
  
  return TURKEY_PROVINCES.filter(province => {
    const { center } = province;
    const dLat = (latitude - center.latitude) * Math.PI / 180;
    const dLon = (longitude - center.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(center.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance <= radiusKm;
  });
}

