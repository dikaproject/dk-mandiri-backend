const categories = [
  {
    name: 'Ikan Laut',
    slug: 'ikan-laut',
    description: 'Berbagai jenis ikan laut segar berkualitas tinggi'
  },
  {
    name: 'Ikan Air Tawar',
    slug: 'ikan-air-tawar',
    description: 'Pilihan ikan air tawar segar terbaik'
  },
  {
    name: 'Udang',
    slug: 'udang',
    description: 'Berbagai jenis udang segar dan berkualitas premium'
  },
  {
    name: 'Kepiting & Rajungan',
    slug: 'kepiting-rajungan',
    description: 'Kepiting dan rajungan segar yang siap diolah'
  },
  {
    name: 'Cumi & Gurita',
    slug: 'cumi-gurita',
    description: 'Cumi-cumi dan gurita segar dengan kualitas terbaik'
  },
  {
    name: 'Olahan Ikan',
    slug: 'olahan-ikan',
    description: 'Produk olahan ikan yang siap dimasak'
  }
];

async function seedCategories(prisma) {
  const createdCategories = [];

  for (const category of categories) {
    const createdCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category
    });
    createdCategories.push(createdCategory);
  }

  console.log(`Created ${createdCategories.length} categories`);
  return createdCategories;
}

module.exports = {
  seedCategories
};