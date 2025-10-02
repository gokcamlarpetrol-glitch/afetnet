import { database } from './db';
import { Shelter } from './models';

export const seedShelters = async (): Promise<void> => {
  const sheltersData = [
    {
      name: 'Kadıköy Belediyesi Acil Durum Merkezi',
      lat: 40.9906,
      lon: 29.0268,
      capacity: 500,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    {
      name: 'Beşiktaş Spor Salonu',
      lat: 41.0434,
      lon: 29.0068,
      capacity: 300,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    {
      name: 'Şişli Belediyesi Toplum Merkezi',
      lat: 41.0603,
      lon: 28.9876,
      capacity: 200,
      open: false,
      updatedAt: Date.now() - 3600000, // 1 hour ago
      createdAt: Date.now(),
    },
    {
      name: 'Fatih Belediyesi Kültür Merkezi',
      lat: 41.0055,
      lon: 28.9769,
      capacity: 400,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    {
      name: 'Üsküdar Belediyesi Sosyal Tesisler',
      lat: 41.0214,
      lon: 29.0045,
      capacity: 250,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    {
      name: 'Beyoğlu Belediyesi Gençlik Merkezi',
      lat: 41.0369,
      lon: 28.9850,
      capacity: 150,
      open: false,
      updatedAt: Date.now() - 7200000, // 2 hours ago
      createdAt: Date.now(),
    },
    {
      name: 'Bakırköy Belediyesi Spor Kompleksi',
      lat: 40.9756,
      lon: 28.8714,
      capacity: 600,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    {
      name: 'Maltepe Belediyesi Toplantı Salonu',
      lat: 40.9229,
      lon: 29.1567,
      capacity: 180,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    {
      name: 'Kartal Belediyesi Acil Toplanma Alanı',
      lat: 40.8896,
      lon: 29.1899,
      capacity: 800,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
    {
      name: 'Pendik Belediyesi Sosyal Tesisler',
      lat: 40.8772,
      lon: 29.2284,
      capacity: 350,
      open: true,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
  ];

  try {
    await database.write(async () => {
      for (const shelterData of sheltersData) {
        await database.collections.get<Shelter>('shelters').create((shelter) => {
          shelter.name = shelterData.name;
          shelter.lat = shelterData.lat;
          shelter.lon = shelterData.lon;
          shelter.capacity = shelterData.capacity;
          shelter.open = shelterData.open;
          shelter.updatedAt = shelterData.updatedAt;
          shelter.createdAt = shelterData.createdAt;
        });
      }
    });

    console.log(`Seeded ${sheltersData.length} shelters`);
  } catch (error) {
    console.error('Error seeding shelters:', error);
    throw error;
  }
};

export const seedAllData = async (): Promise<void> => {
  try {
    await seedShelters();
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
};
