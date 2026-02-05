/**
 * EMERGENCY CONTACTS SERVICE - ELITE EDITION
 * 
 * Türkiye acil durum numaraları ve kaynakları
 * 
 * Features:
 * - Tüm acil numaralar (online/offline)
 * - Şehre göre yerel numaralar
 * - Hızlı arama entegrasyonu
 * - Kaynak bilgileri
 */

import { Linking, Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('EmergencyContactsService');

export interface EmergencyContact {
    id: string;
    name: string;
    number: string;
    description: string;
    category: 'emergency' | 'health' | 'utility' | 'government' | 'ngo' | 'local';
    available24h: boolean;
    priority: 'critical' | 'high' | 'medium';
    icon: string;
}

export interface LocalEmergencyResource {
    id: string;
    name: string;
    city: string;
    type: 'hospital' | 'fire' | 'police' | 'afad' | 'municipality' | 'shelter';
    address: string;
    phone: string;
    coordinates?: { latitude: number; longitude: number };
}

// ELITE: Turkey emergency contacts
const EMERGENCY_CONTACTS: EmergencyContact[] = [
    // Kritik Acil
    {
        id: 'alo112',
        name: 'Acil Çağrı Merkezi',
        number: '112',
        description: 'Tüm acil durumlar için tek numara (ambulans, itfaiye, polis)',
        category: 'emergency',
        available24h: true,
        priority: 'critical',
        icon: 'call',
    },
    {
        id: 'afad',
        name: 'AFAD',
        number: '122',
        description: 'Afet ve Acil Durum Yönetimi Başkanlığı',
        category: 'emergency',
        available24h: true,
        priority: 'critical',
        icon: 'shield',
    },
    {
        id: 'akut',
        name: 'AKUT Arama Kurtarma',
        number: '0212 217 0110',
        description: 'Arama Kurtarma Derneği - Gönüllü kurtarma ekibi',
        category: 'ngo',
        available24h: true,
        priority: 'high',
        icon: 'people',
    },

    // Sağlık
    {
        id: 'ambulance',
        name: 'Ambulans (Sağlık)',
        number: '112',
        description: 'Acil sağlık hizmetleri',
        category: 'health',
        available24h: true,
        priority: 'critical',
        icon: 'medkit',
    },
    {
        id: 'saglik_danisma',
        name: 'Sağlık Danışma',
        number: '182',
        description: 'Sağlık Bakanlığı danışma hattı',
        category: 'health',
        available24h: true,
        priority: 'medium',
        icon: 'information-circle',
    },
    {
        id: 'zehir_danisma',
        name: 'Zehir Danışma',
        number: '114',
        description: 'Ulusal Zehir Danışma Merkezi',
        category: 'health',
        available24h: true,
        priority: 'high',
        icon: 'warning',
    },

    // Güvenlik
    {
        id: 'polis',
        name: 'Polis İmdat',
        number: '155',
        description: 'Emniyet Genel Müdürlüğü',
        category: 'emergency',
        available24h: true,
        priority: 'critical',
        icon: 'shield-checkmark',
    },
    {
        id: 'jandarma',
        name: 'Jandarma',
        number: '156',
        description: 'Jandarma Genel Komutanlığı (kırsal bölgeler)',
        category: 'emergency',
        available24h: true,
        priority: 'high',
        icon: 'shield',
    },
    {
        id: 'sahil',
        name: 'Sahil Güvenlik',
        number: '158',
        description: 'Deniz acil durumları',
        category: 'emergency',
        available24h: true,
        priority: 'high',
        icon: 'boat',
    },

    // İtfaiye
    {
        id: 'itfaiye',
        name: 'İtfaiye',
        number: '110',
        description: 'Yangın ve kurtarma',
        category: 'emergency',
        available24h: true,
        priority: 'critical',
        icon: 'flame',
    },

    // Altyapı
    {
        id: 'elektrik',
        name: 'Elektrik Arıza',
        number: '186',
        description: 'Elektrik kesintisi ve arıza bildirimi',
        category: 'utility',
        available24h: true,
        priority: 'medium',
        icon: 'flash',
    },
    {
        id: 'dogalgaz',
        name: 'Doğalgaz Acil',
        number: '187',
        description: 'Gaz kaçağı ve arıza bildirimi',
        category: 'utility',
        available24h: true,
        priority: 'critical',
        icon: 'flame',
    },
    {
        id: 'su',
        name: 'Su Arıza',
        number: '185',
        description: 'Su kesintisi ve arıza bildirimi',
        category: 'utility',
        available24h: true,
        priority: 'medium',
        icon: 'water',
    },

    // Devlet
    {
        id: 'valilik',
        name: 'Valilik/Kaymakamlık',
        number: '153',
        description: 'Yerel yönetim ve koordinasyon',
        category: 'government',
        available24h: false,
        priority: 'medium',
        icon: 'business',
    },
    {
        id: 'kizilay',
        name: 'Kızılay',
        number: '168',
        description: 'Türk Kızılayı - Kan bağışı ve yardım',
        category: 'ngo',
        available24h: true,
        priority: 'high',
        icon: 'heart',
    },

    // Diğer
    {
        id: 'alo_cocuk',
        name: 'ALO 183 Çocuk',
        number: '183',
        description: 'Çocuk ve kadın acil destek',
        category: 'emergency',
        available24h: true,
        priority: 'high',
        icon: 'people',
    },
    {
        id: 'alo_182',
        name: 'Psikososyal Destek',
        number: '182',
        description: 'Travma sonrası psikolojik destek',
        category: 'health',
        available24h: true,
        priority: 'medium',
        icon: 'heart',
    },
];

// ELITE: Local resources by city
const LOCAL_RESOURCES: LocalEmergencyResource[] = [
    // Istanbul
    {
        id: 'ist_afad',
        name: 'İstanbul AFAD',
        city: 'İstanbul',
        type: 'afad',
        address: 'Bahçelievler, İstanbul',
        phone: '0212 452 0000',
        coordinates: { latitude: 40.9981, longitude: 28.8485 },
    },
    {
        id: 'ist_hospital_cerrahpasa',
        name: 'Cerrahpaşa Tıp',
        city: 'İstanbul',
        type: 'hospital',
        address: 'Fatih, İstanbul',
        phone: '0212 414 3000',
        coordinates: { latitude: 41.0036, longitude: 28.9438 },
    },
    // Izmir
    {
        id: 'izm_afad',
        name: 'İzmir AFAD',
        city: 'İzmir',
        type: 'afad',
        address: 'Konak, İzmir',
        phone: '0232 464 0000',
        coordinates: { latitude: 38.4189, longitude: 27.1287 },
    },
    // Hatay (2023 earthquake zone)
    {
        id: 'hat_afad',
        name: 'Hatay AFAD',
        city: 'Hatay',
        type: 'afad',
        address: 'Antakya, Hatay',
        phone: '0326 213 0000',
        coordinates: { latitude: 36.2021, longitude: 36.1606 },
    },
];

class EmergencyContactsService {
    private contacts: EmergencyContact[] = [...EMERGENCY_CONTACTS];
    private localResources: LocalEmergencyResource[] = [...LOCAL_RESOURCES];

    /**
     * Get all emergency contacts
     */
    getAllContacts(): EmergencyContact[] {
        return [...this.contacts];
    }

    /**
     * Get contacts by category
     */
    getContactsByCategory(category: EmergencyContact['category']): EmergencyContact[] {
        return this.contacts.filter(c => c.category === category);
    }

    /**
     * Get critical contacts (for quick access)
     */
    getCriticalContacts(): EmergencyContact[] {
        return this.contacts.filter(c => c.priority === 'critical');
    }

    /**
     * Get 24h available contacts
     */
    get24hContacts(): EmergencyContact[] {
        return this.contacts.filter(c => c.available24h);
    }

    /**
     * Call an emergency number
     */
    async callNumber(number: string): Promise<boolean> {
        try {
            const cleanNumber = number.replace(/\s/g, '');
            const url = Platform.OS === 'android'
                ? `tel:${cleanNumber}`
                : `telprompt:${cleanNumber}`;

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                logger.info('Called emergency number:', number);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Failed to call:', error);
            return false;
        }
    }

    /**
     * Get local resources by city
     */
    getLocalResources(city: string): LocalEmergencyResource[] {
        return this.localResources.filter(
            r => r.city.toLowerCase() === city.toLowerCase()
        );
    }

    /**
     * Get resource by type
     */
    getResourcesByType(type: LocalEmergencyResource['type']): LocalEmergencyResource[] {
        return this.localResources.filter(r => r.type === type);
    }

    /**
     * Search contacts
     */
    search(query: string): EmergencyContact[] {
        const lowerQuery = query.toLowerCase();
        return this.contacts.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.description.toLowerCase().includes(lowerQuery) ||
            c.number.includes(query)
        );
    }

    /**
     * Get quick dial card (for earthquake emergency)
     */
    getEarthquakeQuickDial(): EmergencyContact[] {
        const ids = ['alo112', 'afad', 'akut', 'itfaiye', 'dogalgaz'];
        return this.contacts.filter(c => ids.includes(c.id));
    }
}

export const emergencyContactsService = new EmergencyContactsService();
