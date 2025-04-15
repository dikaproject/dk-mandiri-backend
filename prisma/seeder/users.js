const bcrypt = require('bcrypt');

const users = [
  {
    username: 'admin',
    email: 'admin@dkmandiri.com',
    password: 'admin123',
    role: 'ADMIN',
    phone: '081234567890',
    isVerified: true
  },
  {
    username: 'customer1',
    email: 'customer1@example.com',
    password: 'password123',
    role: 'USER',
    phone: '081234567891',
    isVerified: true
  },
  {
    username: 'budi_santoso',
    email: 'budi@example.com',
    password: 'password123',
    role: 'USER',
    phone: '081234567892',
    isVerified: true
  },
  {
    username: 'siti_rahayu',
    email: 'siti@example.com',
    password: 'password123',
    role: 'USER',
    phone: '081234567893',
    isVerified: true
  },
  {
    username: 'agus_purnomo',
    email: 'agus@example.com',
    password: 'password123',
    role: 'USER',
    phone: '081234567894',
    isVerified: false
  }
];

const addresses = [
  {
    province: 'Jawa Barat',
    city: 'Bandung',
    district: 'Cicendo',
    postalCode: '40171',
    fullAddress: 'Jl. Sukajadi No. 123',
    recipientName: 'Budi Santoso',
    phone: '081234567892',
    isPrimary: true
  },
  {
    province: 'DKI Jakarta',
    city: 'Jakarta Selatan',
    district: 'Kebayoran Baru',
    postalCode: '12150',
    fullAddress: 'Jl. Senopati No. 45',
    recipientName: 'Siti Rahayu',
    phone: '081234567893',
    isPrimary: true
  },
  {
    province: 'Jawa Tengah',
    city: 'Semarang',
    district: 'Tembalang',
    postalCode: '50275',
    fullAddress: 'Jl. Durian No. 88',
    recipientName: 'Agus Purnomo',
    phone: '081234567894',
    isPrimary: false
  },
  {
    province: 'Jawa Barat',
    city: 'Bandung',
    district: 'Buah Batu',
    postalCode: '40287',
    fullAddress: 'Jl. Mangga No. 212',
    recipientName: 'Budi Santoso',
    phone: '081234567892',
    isPrimary: false
  }
];

async function seedUsers(prisma) {
  // Hash passwords
  const saltRounds = 10;
  const usersWithHashedPasswords = await Promise.all(users.map(async (user) => {
    const hashedPassword = await bcrypt.hash(user.password, saltRounds);
    return {
      ...user,
      password: hashedPassword
    };
  }));

  // Create users
  const createdUsers = [];
  for (const user of usersWithHashedPasswords) {
    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user
    });
    createdUsers.push(createdUser);
    console.log(`Created user: ${user.username}`);
  }

  // Match addresses to users
  const userBudi = createdUsers.find(u => u.username === 'budi_santoso');
  const userSiti = createdUsers.find(u => u.username === 'siti_rahayu');
  const userAgus = createdUsers.find(u => u.username === 'agus_purnomo');
  
  if (userBudi) {
    await prisma.address.createMany({
      data: [
        { ...addresses[0], userId: userBudi.id },
        { ...addresses[3], userId: userBudi.id }
      ]
    });
  }
  
  if (userSiti) {
    await prisma.address.create({
      data: { ...addresses[1], userId: userSiti.id }
    });
  }
  
  if (userAgus) {
    await prisma.address.create({
      data: { ...addresses[2], userId: userAgus.id }
    });
  }

  return createdUsers;
}

module.exports = {
  seedUsers
};