/**
 * REGIONAL RISK PROFILES
 * Simplified seismic hazard clusters for Turkey with qualitative metadata.
 * These values do not replace official AFAD maps but provide contextual guidance
 * when running local, offline risk assessments.
 */

export interface RegionalHazardCluster {
  id: string;
  name: string;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  hazardLevel: 'very_high' | 'high' | 'medium' | 'low';
  description: string;
  criticalInfrastructure: string[];
  historicalEvents: Array<{
    year: number;
    magnitude: number;
    note: string;
  }>;
  notableFaults: string[];
}

export const REGIONAL_HAZARD_CLUSTERS: RegionalHazardCluster[] = [
  {
    id: 'marmara-north-anatolian',
    name: 'Marmara - Kuzey Anadolu Fay Zonu',
    center: { latitude: 40.925, longitude: 29.055 },
    radiusKm: 220,
    hazardLevel: 'very_high',
    description:
      'Kuzey Anadolu Fay hattının Marmara segmenti üzerinde yer alan yoğun nüfuslu bölge. Büyük İstanbul depremi senaryosu için kritik.',
    criticalInfrastructure: ['AFAD İstanbul Lojistik Merkezleri', 'Avrasya Tüneli', 'İstanbul Havalimanı'],
    historicalEvents: [
      { year: 1999, magnitude: 7.4, note: 'Gölcük Depremi' },
      { year: 2019, magnitude: 5.8, note: 'Silivri Depremi' },
    ],
    notableFaults: ['Kuzey Anadolu Fay Zonu', 'Çınarcık Çukuru', 'Adalar Segmenti'],
  },
  {
    id: 'ege-denizli-izmir',
    name: 'Ege Grabeni - İzmir & Denizli',
    center: { latitude: 38.45, longitude: 27.17 },
    radiusKm: 180,
    hazardLevel: 'high',
    description:
      'Ege graben sistemi boyunca sık orta büyüklükte depremler. Faylanmanın karmaşık olduğu yoğun yerleşimli bölge.',
    criticalInfrastructure: ['AFAD İzmir Depo', 'Alsancak Limanı', 'Manisa OSB'],
    historicalEvents: [
      { year: 2020, magnitude: 6.9, note: 'İzmir - Seferihisar Depremi' },
      { year: 1969, magnitude: 6.2, note: 'Alaşehir Depremi' },
    ],
    notableFaults: ['Gediz Graben', 'Büyük Menderes Graben', 'Seferihisar Fayları'],
  },
  {
    id: 'east-anatolia',
    name: 'Doğu Anadolu Fay Zonu',
    center: { latitude: 38.35, longitude: 39.25 },
    radiusKm: 240,
    hazardLevel: 'very_high',
    description:
      'Kahramanmaraş merkezli 6 Şubat 2023 depremleriyle kırılan Doğu Anadolu Fayı segmentleri. Artçı aktivite potansiyeli yüksek.',
    criticalInfrastructure: ['AFAD Kahramanmaraş Deposu', 'Malatya Havalimanı', 'Elazığ Barajları'],
    historicalEvents: [
      { year: 2023, magnitude: 7.8, note: 'Pazarcık Depremi' },
      { year: 2023, magnitude: 7.5, note: 'Elbistan Depremi' },
      { year: 2020, magnitude: 6.8, note: 'Elazığ-Sivrice Depremi' },
    ],
    notableFaults: ['Doğu Anadolu Fay Zonu', 'Çardak-Sürgü Fayı', 'Ölüdeniz (Levant) Fayı'],
  },
  {
    id: 'north-east-blacksea',
    name: 'Karadeniz Kuzey Anadolu Segmenti',
    center: { latitude: 41.05, longitude: 37.87 },
    radiusKm: 160,
    hazardLevel: 'high',
    description:
      'Ordu, Giresun ve Samsun çevresindeki fay segmentleri; faylanma hızı daha düşük ancak zemin sıvılaşması riski bulunuyor.',
    criticalInfrastructure: ['Samsun Limanı', 'Çarşamba Havalimanı'],
    historicalEvents: [
      { year: 1943, magnitude: 7.2, note: 'Ladik Depremi' },
    ],
    notableFaults: ['Kuzey Anadolu Orta Segment', 'Vezirköprü Fay Zonu'],
  },
  {
    id: 'mediterranean-hatay',
    name: 'Akdeniz - Hatay & Adana Segmenti',
    center: { latitude: 36.20, longitude: 36.16 },
    radiusKm: 170,
    hazardLevel: 'high',
    description:
      'Hatay, Osmaniye ve Adana illerini etkileyen fay sistemleri. Büyük depremler sonrası artçı tehlikesi yüksek.',
    criticalInfrastructure: ['İskenderun Limanı', 'AFAD Hatay Koordinasyon Merkezi'],
    historicalEvents: [
      { year: 2023, magnitude: 6.4, note: 'Defne-Hatay Depremi' },
      { year: 1998, magnitude: 6.3, note: 'Adana-Ceyhan Depremi' },
    ],
    notableFaults: ['Ölüdeniz Fayı', 'Antakya Fay Zonu'],
  },
  {
    id: 'central-anatolia',
    name: 'İç Anadolu Orta Risk Kuşağı',
    center: { latitude: 39.75, longitude: 32.85 },
    radiusKm: 210,
    hazardLevel: 'medium',
    description:
      'Ankara, Eskişehir ve Konya hattında nispeten düşük fakat yayılan risk. Zemin yumuşaklığı ve yapı stoğu ana belirleyici.',
    criticalInfrastructure: ['AFAD Ankara Deposu', 'Ankara Şehir Hastanesi'],
    historicalEvents: [
      { year: 2007, magnitude: 5.9, note: 'Bala Depremi' },
    ],
    notableFaults: ['Eskişehir Fay Zonu', 'Kırşehir Fay Zonu'],
  },
  {
    id: 'south-west-mediterranean',
    name: 'Göller Yöresi & Antalya',
    center: { latitude: 37.10, longitude: 30.50 },
    radiusKm: 150,
    hazardLevel: 'medium',
    description:
      'Burdur, Isparta ve Antalya çevresi; diri faylar nedeniyle sarsıntı riski orta seviyede.',
    criticalInfrastructure: ['Antalya Havalimanı', 'Burdur Deprem Gözlem Ağı'],
    historicalEvents: [
      { year: 1971, magnitude: 6.2, note: 'Burdur Depremi' },
    ],
    notableFaults: ['Fethiye-Burdur Fay Zonu', 'Akseki Fay Segmenti'],
  },
  {
    id: 'low-risk-central',
    name: 'Düşük Riskli İç Kesimler',
    center: { latitude: 40.20, longitude: 34.85 },
    radiusKm: 260,
    hazardLevel: 'low',
    description:
      'Çorum, Yozgat ve çevresinde daha az aktif faylar. Yine de yapı güvenliği ve hazırlık kritik.',
    criticalInfrastructure: ['AFAD Çorum Bölge Deposı'],
    historicalEvents: [
      { year: 1980, magnitude: 5.6, note: 'Çorum Depremi' },
    ],
    notableFaults: ['Çankırı Fay Zonu'],
  },
];

/**
 * Haversine distance between two coordinates in kilometers.
 */
export function distanceInKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371; // Earth radius in km
  const dLat = degreesToRadians(b.latitude - a.latitude);
  const dLon = degreesToRadians(b.longitude - a.longitude);
  const lat1 = degreesToRadians(a.latitude);
  const lat2 = degreesToRadians(b.latitude);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return R * c;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}


