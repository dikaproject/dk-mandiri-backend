const products = [
  {
    name: 'Ikan Kakap Merah',
    slug: 'ikan-kakap-merah',
    description: 'Ikan kakap merah segar dengan kualitas premium. Daging tebal, manis, dan cocok untuk berbagai olahan seperti sup, goreng, atau panggang.',
    price: 85000,
    costPrice: 65000,
    weightInStock: 10000,
    minOrderWeight: 500,
    categorySlug: 'ikan-laut'
  },
  {
    name: 'Ikan Kerapu',
    slug: 'ikan-kerapu',
    description: 'Ikan kerapu segar berkualitas tinggi. Daging lembut dengan rasa manis yang khas. Sangat cocok untuk steam atau goreng tepung.',
    price: 95000,
    costPrice: 75000,
    weightInStock: 8500,
    minOrderWeight: 500,
    categorySlug: 'ikan-laut'
  },
  {
    name: 'Ikan Tongkol',
    slug: 'ikan-tongkol',
    description: 'Ikan tongkol segar yang kaya akan Omega-3. Cocok untuk pindang, goreng, atau balado.',
    price: 45000,
    costPrice: 32000,
    weightInStock: 15000,
    minOrderWeight: 500,
    categorySlug: 'ikan-laut'
  },
  {
    name: 'Ikan Gurame',
    slug: 'ikan-gurame',
    description: 'Ikan gurame segar dengan daging tebal dan lembut. Cocok untuk digoreng, steam atau dibuat bumbu acar kuning.',
    price: 55000,
    costPrice: 42000,
    weightInStock: 12000,
    minOrderWeight: 500,
    categorySlug: 'ikan-air-tawar'
  },
  {
    name: 'Ikan Nila',
    slug: 'ikan-nila',
    description: 'Ikan nila segar yang dibudidayakan dengan standar kualitas tinggi. Daging putih dengan rasa yang lembut.',
    price: 38000,
    costPrice: 28000,
    weightInStock: 20000,
    minOrderWeight: 500,
    categorySlug: 'ikan-air-tawar'
  },
  {
    name: 'Ikan Lele',
    slug: 'ikan-lele',
    description: 'Ikan lele segar yang memiliki daging lembut dan gurih. Sangat cocok untuk digoreng atau dipepes.',
    price: 32000,
    costPrice: 22000,
    weightInStock: 18000,
    minOrderWeight: 500,
    categorySlug: 'ikan-air-tawar'
  },
  {
    name: 'Udang Windu',
    slug: 'udang-windu',
    description: 'Udang windu segar berkualitas super. Ukuran besar dengan rasa manis yang khas. Cocok untuk berbagai hidangan seperti goreng tepung, bakar, atau tumis.',
    price: 120000,
    costPrice: 85000,
    weightInStock: 7500,
    minOrderWeight: 250,
    categorySlug: 'udang'
  },
  {
    name: 'Udang Vaname',
    slug: 'udang-vaname',
    description: 'Udang vaname segar dengan kualitas terbaik. Ukuran sedang dengan rasa manis sedikit asin. Cocok untuk tumis, goreng, atau hidangan berkuah.',
    price: 95000,
    costPrice: 70000,
    weightInStock: 9000,
    minOrderWeight: 250,
    categorySlug: 'udang'
  },
  {
    name: 'Kepiting Rajungan',
    slug: 'kepiting-rajungan',
    description: 'Kepiting rajungan segar dengan daging manis dan gurih. Ideal untuk sup, saus padang, atau dikukus.',
    price: 110000,
    costPrice: 82000,
    weightInStock: 6500,
    minOrderWeight: 500,
    categorySlug: 'kepiting-rajungan'
  },
  {
    name: 'Cumi-Cumi Segar',
    slug: 'cumi-cumi-segar',
    description: 'Cumi-cumi segar berkualitas terbaik. Tekstur kenyal dengan rasa manis gurih. Cocok untuk tumis, goreng tepung, atau sambal.',
    price: 75000,
    costPrice: 55000,
    weightInStock: 8000,
    minOrderWeight: 250,
    categorySlug: 'cumi-gurita'
  },
  {
    name: 'Gurita Baby',
    slug: 'gurita-baby',
    description: 'Gurita baby segar premium quality. Tekstur lembut dengan rasa khas laut yang menggugah selera. Cocok untuk tumis, rebus, atau panggang.',
    price: 90000,
    costPrice: 67000,
    weightInStock: 5500,
    minOrderWeight: 250,
    categorySlug: 'cumi-gurita'
  },
  {
    name: 'Bakso Ikan',
    slug: 'bakso-ikan',
    description: 'Bakso ikan homemade dengan daging ikan pilihan. Tekstur kenyal dengan rasa gurih alami tanpa bahan pengawet.',
    price: 65000,
    costPrice: 45000,
    weightInStock: 10000,
    minOrderWeight: 250,
    categorySlug: 'olahan-ikan'
  }
];

async function seedProducts(prisma) {
  // Get categories first to obtain their IDs
  const categories = await prisma.category.findMany();
  const categoryMap = categories.reduce((map, category) => {
    map[category.slug] = category.id;
    return map;
  }, {});

  const createdProducts = [];

  for (const product of products) {
    const { categorySlug, ...productData } = product;
    const categoryId = categoryMap[categorySlug];

    if (!categoryId) {
      console.warn(`Category with slug ${categorySlug} not found. Skipping product ${product.name}`);
      continue;
    }

    const createdProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        ...productData,
        price: productData.price,
        costPrice: productData.costPrice,
        weightInStock: productData.weightInStock,
        minOrderWeight: productData.minOrderWeight,
        categoryId
      }
    });

    createdProducts.push(createdProduct);
    console.log(`Created product: ${product.name}`);
  }

  return createdProducts;
}

module.exports = {
  seedProducts
};