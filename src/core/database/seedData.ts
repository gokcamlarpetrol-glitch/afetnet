import { database } from './index';
import { Shelter } from './models';

export const seedShelters = async () => {
  const sheltersData = [
    {
      name: 'Kadıköy Belediyesi Acil Durum Merkezi',
      lat: 40.9906,
      lon: 29.0268,
      capacity: 500,
      open: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    },
    {
      name: 'Beşiktaş Spor Salonu',
      lat: 41.0434,
      lon: 29.0068,
      capacity: 300,
      open: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    },
    {
      name: 'Şişli Belediyesi Toplum Merkezi',
      lat: 41.0603,
      lon: 28.9876,
      capacity: 200,
      open: false,
      updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
      createdAt: new Date(),
    },
    {
      name: 'Fatih Belediyesi Kültür Merkezi',
      lat: 41.0055,
      lon: 28.9769,
      capacity: 400,
      open: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    },
    {
      name: 'Üsküdar Belediyesi Sosyal Tesisler',
      lat: 41.0214,
      lon: 29.0045,
      capacity: 250,
      open: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    },
    {
      name: 'Beyoğlu Belediyesi Gençlik Merkezi',
      lat: 41.0369,
      lon: 28.9850,
      capacity: 150,
      open: false,
      updatedAt: new Date(Date.now() - 7200000), // 2 hours ago
      createdAt: new Date(),
    },
    {
      name: 'Bakırköy Belediyesi Spor Kompleksi',
      lat: 40.9756,
      lon: 28.8714,
      capacity: 600,
      open: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    },
    {
      name: 'Maltepe Belediyesi Toplantı Salonu',
      lat: 40.9229,
      lon: 29.1567,
      capacity: 180,
      open: true,
      updatedAt: new Date(),
      createdAt: new Date(),
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
  }
};

export const seedResourcePosts = async () => {
  const resourcesData = [
    {
      ts: Date.now() - 1800000, // 30 minutes ago
      type: 'water' as const,
      qty: '100 bottles',
      lat: 41.0082,
      lon: 28.9784,
      desc: 'Clean drinking water available',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      ts: Date.now() - 3600000, // 1 hour ago
      type: 'food' as const,
      qty: '50 meals',
      lat: 41.0123,
      lon: 28.9823,
      desc: 'Hot meals and snacks',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      ts: Date.now() - 7200000, // 2 hours ago
      type: 'med' as const,
      qty: 'First aid supplies',
      lat: 41.0056,
      lon: 28.9745,
      desc: 'Basic medical supplies and first aid',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      ts: Date.now() - 900000, // 15 minutes ago
      type: 'blanket' as const,
      qty: '20 blankets',
      lat: 41.0156,
      lon: 28.9867,
      desc: 'Warm blankets for cold weather',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      ts: Date.now() - 2700000, // 45 minutes ago
      type: 'powerbank' as const,
      qty: '10 powerbanks',
      lat: 41.0034,
      lon: 28.9723,
      desc: 'Portable phone chargers',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  try {
    await database.write(async () => {
      for (const resourceData of resourcesData) {
        await database.collections.get('resource_posts').create((resource) => {
          resource.ts = resourceData.ts;
          resource.type = resourceData.type;
          resource.qty = resourceData.qty;
          resource.lat = resourceData.lat;
          resource.lon = resourceData.lon;
          resource.desc = resourceData.desc;
          resource.createdAt = resourceData.createdAt;
          resource.updatedAt = resourceData.updatedAt;
        });
      }
    });
    
    console.log(`Seeded ${resourcesData.length} resource posts`);
  } catch (error) {
    console.error('Error seeding resource posts:', error);
  }
};

export const seedAllData = async () => {
  await seedShelters();
  await seedResourcePosts();
  console.log('Database seeding completed');
};
