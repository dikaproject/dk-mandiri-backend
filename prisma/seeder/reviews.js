const reviews = [
  {
    name: 'Budi Santoso',
    message: 'Ikan yang saya beli dari DK Mandiri selalu segar dan berkualitas tinggi. Pengiriman juga cepat!',
    rating: 5
  },
  {
    name: 'Siti Rahayu',
    message: 'Udang windu yang saya pesan sangat segar dan ukurannya sesuai dengan yang dijanjikan. Sangat puas dengan kualitasnya.',
    rating: 5
  },
  {
    name: 'Ahmad Fauzi',
    message: 'Pelayanan cepat dan barang sesuai dengan deskripsi. Cukup puas dengan pembelian saya.',
    rating: 4
  },
  {
    name: 'Dewi Lestari',
    message: 'Ikan kakap yang saya beli masih segar saat sampai. Harga juga cukup bersaing dengan pasar tradisional.',
    rating: 5
  },
  {
    name: 'Hendra Wijaya',
    message: 'Pengiriman agak terlambat, tetapi ikan masih dalam kondisi baik. Rasa ikan gurame sangat enak.',
    rating: 4
  },
  {
    name: 'Rina Novita',
    message: 'Cumi-cumi segar dan berkualitas. Customer service ramah dan membantu. Pasti akan pesan lagi!',
    rating: 5
  },
  {
    name: 'Agung Prabowo',
    message: 'Kualitas ikan lele lumayan, tapi masih ada beberapa yang kurang segar. Semoga bisa ditingkatkan lagi.',
    rating: 3
  },
  {
    name: 'Nina Wulandari',
    message: 'Bakso ikan sangat lezat dan teksturnya pas. Keluarga saya sangat menyukainya. Terima kasih DK Mandiri!',
    rating: 5
  }
];

async function seedReviews(prisma) {
  // Get registered users
  const users = await prisma.user.findMany({
    where: { role: 'USER' }
  });
  
  let createdReviews = [];
  
  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    // Assign some reviews to registered users
    const userId = i < 3 && users[i] ? users[i].id : null;
    const imageUrl = i % 3 === 0 ? 'review-image.jpg' : null; // Add image to some reviews
    
    const createdReview = await prisma.communityReview.create({
      data: {
        ...review,
        email: userId ? users[i].email : `${review.name.toLowerCase().replace(' ', '.')}@example.com`,
        imageUrl,
        userId,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000) // Random date in the last 30 days
      }
    });
    
    createdReviews.push(createdReview);
  }
  
  console.log(`Created ${createdReviews.length} community reviews`);
  return createdReviews;
}

module.exports = {
  seedReviews
};