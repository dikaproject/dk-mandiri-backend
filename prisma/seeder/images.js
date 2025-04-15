const getRandomImageUrl = (type) => {
  const size = '800x600';
  const categories = {
    'ikan-laut': ['fish', 'seafood'],
    'ikan-air-tawar': ['fish', 'freshwater'],
    'udang': ['shrimp', 'seafood'],
    'kepiting-rajungan': ['crab', 'seafood'],
    'cumi-gurita': ['squid', 'seafood', 'octopus'],
    'olahan-ikan': ['food', 'fishcake']
  };
  
  const keywords = categories[type] || ['seafood'];
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  
  // Using lorempixel as placeholder
  return `https://source.unsplash.com/random/${size}?${randomKeyword}`;
};

async function seedImages(prisma) {
  // Get all products to add images
  const products = await prisma.product.findMany({
    include: { category: true }
  });

  // Delete existing images first to avoid duplicates
  await prisma.productImage.deleteMany({});

  for (const product of products) {
    // Add 2-4 images per product
    const numImages = 2 + Math.floor(Math.random() * 3); // 2 to 4 images
    
    for (let i = 0; i < numImages; i++) {
      const isPrimary = i === 0; // First image is primary
      await prisma.productImage.create({
        data: {
          imageUrl: getRandomImageUrl(product.category.slug),
          isPrimary,
          productId: product.id
        }
      });
    }
    
    console.log(`Added ${numImages} images for product: ${product.name}`);
  }

  const totalImages = await prisma.productImage.count();
  console.log(`Created ${totalImages} product images`);
}

module.exports = {
  seedImages
};