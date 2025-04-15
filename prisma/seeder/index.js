const { PrismaClient } = require('@prisma/client');
const { seedUsers } = require('./users');
const { seedCategories } = require('./categories');
const { seedProducts } = require('./products');
const { seedImages } = require('./images');
const { seedOrders } = require('./orders');
const { seedReviews } = require('./reviews');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');
  
  // Seeding in sequence to respect relationships
  console.log('🧑‍💼 Seeding users...');
  await seedUsers(prisma);
  
  console.log('📁 Seeding categories...');
  await seedCategories(prisma);
  
  console.log('🐟 Seeding products...');
  await seedProducts(prisma);
  
  console.log('🖼️ Seeding product images...');
  await seedImages(prisma);
  
  console.log('📦 Seeding orders and transactions...');
  await seedOrders(prisma);
  
  console.log('⭐ Seeding community reviews...');
  await seedReviews(prisma);
  
  console.log('✅ Database seeding completed!');
}

// Execute the seeding
main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });