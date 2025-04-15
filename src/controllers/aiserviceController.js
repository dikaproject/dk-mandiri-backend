const prisma = require('../config/database');
const axios = require('axios');
const path = require('path');
const { generateSlug } = require('../utils/helpers');

// Generate data untuk AI
const getAdminSystemData = async () => {
  try {
    // Ambil data dasar yang dibutuhkan AI untuk memberi konteks
    const [categories, topProducts, recentOrders, systemStats] = await Promise.all([
      // Kategori produk
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true
        }
      }),
      
      // Top 5 produk terlaris
      prisma.product.findMany({
        take: 5,
        orderBy: {
          orderItems: {
            _count: 'desc'
          }
        },
        select: {
          id: true,
          name: true,
          price: true,
          costPrice: true,
          category: {
            select: {
              name: true
            }
          }
        }
      }),
      
      // 5 order terbaru
      prisma.order.findMany({
        take: 5,
        orderBy: {
          orderDate: 'desc'
        },
        select: {
          orderNumber: true,
          status: true,
          totalAmount: true
        }
      }),
      
      // Statistik sistem
      {
        productCount: await prisma.product.count(),
        categoryCount: await prisma.category.count(),
        orderCount: await prisma.order.count(),
        userCount: await prisma.user.count()
      }
    ]);
    
    return {
      categories,
      topProducts,
      recentOrders,
      systemStats
    };
  } catch (error) {
    console.error('Error fetching admin system data:', error);
    throw error;
  }
};

// Proses chat dari admin
const adminChat = async (req, res) => {
  try {
    const { message, options } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pesan tidak boleh kosong' 
      });
    }
    
    // Dapatkan data untuk konteks AI
    const adminData = await getAdminSystemData();
    
    // Buat context untuk AI
    const systemContext = {
      current_date: new Date().toISOString(),
      admin_data: adminData,
      website_name: "DK Mandiri Seafood",
      admin_features: [
        "Product Management (CRUD)",
        "Category Management (CRUD)",
        "Order Management",
        "User Management",
        "Transaction Management",
        "Analytics Dashboard"
      ]
    };
    
    // Tentukan mode dari options
    const smartMode = options?.smartMode || 'normal';
    
    // Buat system prompt berdasarkan mode
    let systemPrompt = `Kamu adalah AI Assistant khusus untuk admin website DK Mandiri Seafood. Tugasmu adalah membantu admin mengelola website, menjawab pertanyaan, dan melakukan operasi CRUD berdasarkan permintaan. Kamu memiliki data terbaru tentang kategori, produk, pesanan, dan statistik sistem.

Saat menjawab pertanyaan atau permintaan:
1. Berikan jawaban ringkas dan jelas
2. Untuk tutorial, berikan langkah-langkah yang detail`;

    // Tambahkan petunjuk khusus berdasarkan mode
    if (smartMode === 'create') {
      systemPrompt += `\n\nMode pembuatan produk aktif. Ekstrak informasi berikut dari pesan admin:
- Nama produk
- Kategori (cocokkan dengan salah satu kategori yang ada: ${adminData.categories.map(c => c.name).join(', ')})
- Harga jual (dalam Rupiah, tanpa koma)
- Harga modal/cost (dalam Rupiah, tanpa koma)
- Stok (dalam gram)
- Minimal order (defaultnya 500 gram)
- Deskripsi produk

Format respons untuk pembuatan produk (JSON):
{
  "action": "CREATE_PRODUCT",
  "data": {
    "name": "[nama produk]",
    "categoryId": "[id kategori yang sesuai]",
    "categoryName": "[nama kategori]",
    "price": [harga jual dalam angka],
    "costPrice": [harga modal dalam angka],
    "weightInStock": [stok dalam angka],
    "minOrderWeight": [minimal order dalam angka],
    "description": "[deskripsi produk]"
  }
}`;
    }
    else if (smartMode === 'edit') {
      systemPrompt += `\n\nMode edit produk aktif. Ekstrak informasi berikut dari pesan admin:
- ID produk yang akan diupdate
- Properti yang ingin diubah, yang bisa mencakup:
  - Nama produk
  - Harga jual
  - Harga modal
  - Stok (weightInStock)
  - Minimal order (minOrderWeight)
  - Deskripsi
  - Kategori

Format respons untuk update produk (JSON):
{
  "action": "UPDATE_PRODUCT",
  "data": {
    "id": "[id produk yang akan diupdate]",
    "name": "[nama produk baru]",
    "categoryId": "[id kategori baru, jika diubah]",
    "categoryName": "[nama kategori baru, jika diubah]",
    "price": [harga jual baru, jika diubah],
    "costPrice": [harga modal baru, jika diubah],
    "weightInStock": [stok baru, jika diubah],
    "minOrderWeight": [minimal order baru, jika diubah],
    "description": "[deskripsi baru, jika diubah]"
  }
}`;
    }

    // Menentukan format respons
    const useJsonFormat = smartMode === 'create' || smartMode === 'edit';
    
    // Panggil Groq API
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `${message}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1500,
        response_format: useJsonFormat ? { type: "json_object" } : { type: "text" }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        }
      }
    );
    
    let responseData = response.data.choices[0].message.content;
    let actionData = null;
    
    // Proses respons JSON jika berada di mode create atau edit
    if (useJsonFormat) {
      try {
        const parsedResponse = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        
        if (parsedResponse.action === "CREATE_PRODUCT" && parsedResponse.data) {
          // Proses pembuatan produk
          actionData = await processCreateProduct(parsedResponse, adminData, req);
        }
        else if (parsedResponse.action === "UPDATE_PRODUCT" && parsedResponse.data) {
          // Proses update produk
          actionData = await processUpdateProduct(parsedResponse, adminData);
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Jika gagal parse, tetap gunakan respons text biasa
      }
    }
    
    res.status(200).json({
      success: true,
      response: responseData,
      actionData
    });
    
  } catch (error) {
    console.error('AI Admin Service error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request'
    });
  }
};



// Fungsi untuk memproses pembuatan produk
async function processCreateProduct(parsedResponse, adminData, req) {
  try {
    let categoryId = null;
    
    // 1. Coba periksa kategori dari ID terlebih dahulu (konversi ke string)
    if (parsedResponse.data.categoryId) {
      // Jika ID berupa angka, coba temukan kategori di adminData
      const categoryIdStr = String(parsedResponse.data.categoryId);
      const categoryById = adminData.categories.find(c => c.id === categoryIdStr);
      
      if (categoryById) {
        categoryId = categoryById.id;
      }
    }
    
    // 2. Jika ID tidak valid, coba cari berdasarkan nama kategori
    if (!categoryId && parsedResponse.data.categoryName) {
      const categoryByName = adminData.categories.find(
        c => c.name.toLowerCase() === parsedResponse.data.categoryName.toLowerCase()
      );
      
      if (categoryByName) {
        categoryId = categoryByName.id;
      }
    }
    
    // 3. Jika masih tidak menemukan kategori, gunakan kategori pertama
    if (!categoryId && adminData.categories.length > 0) {
      categoryId = adminData.categories[0].id;
    } else if (!categoryId) {
      throw new Error("Tidak dapat menemukan kategori yang valid");
    }
    
    // Buat slug dari nama produk
    const slug = generateSlug(parsedResponse.data.name);
    
    // Konversi nilai numerik
    const price = parseFloat(parsedResponse.data.price);
    const costPrice = parseFloat(parsedResponse.data.costPrice);
    const weightInStock = parseFloat(parsedResponse.data.weightInStock);
    const minOrderWeight = parseFloat(parsedResponse.data.minOrderWeight || 500);
    
    // Validasi nilai
    if (isNaN(price) || isNaN(costPrice) || isNaN(weightInStock) || isNaN(minOrderWeight)) {
      throw new Error("Nilai numerik tidak valid");
    }
    
    // Buat produk di database
    const newProduct = await prisma.product.create({
      data: {
        name: parsedResponse.data.name,
        slug: slug,
        description: parsedResponse.data.description || `${parsedResponse.data.name} segar berkualitas dari DK Mandiri`,
        price: price,
        costPrice: costPrice,
        weightInStock: weightInStock,
        minOrderWeight: minOrderWeight,
        isAvailable: true,
        categoryId: categoryId,
      }
    });
    
    // Tambahkan image placeholder
    const defaultImageUrl = `${req.protocol}://${req.get('host')}/api/uploads/product/images-1744100552475-642403100.jpg`;
    
    const productImage = await prisma.productImage.create({
      data: {
        imageUrl: defaultImageUrl,
        isPrimary: true,
        productId: newProduct.id
      }
    });
    
    return {
      action: "CREATE_PRODUCT",
      success: true,
      product: {
        ...newProduct,
        image: defaultImageUrl
      }
    };
  } catch (error) {
    console.error("Error creating product:", error);
    return {
      action: "CREATE_PRODUCT",
      success: false,
      error: error.message || "Gagal membuat produk"
    };
  }
}

// Fungsi untuk memproses update produk
// Tambahkan fungsi ini sebelum processUpdateProduct
async function findProductByNameOrId(productIdentifier, includeDetails = false) {
  // Jika sepertinya placeholder ID atau string tidak valid
  if (productIdentifier.includes("ID_") || productIdentifier.includes("PRODUK_YANG") || 
      productIdentifier.length < 10 || productIdentifier.includes("[")) {
    return null;
  }

  try {
    // Coba cari berdasarkan ID langsung
    const productById = await prisma.product.findUnique({
      where: { id: productIdentifier },
      include: includeDetails ? {
        category: true,
        productImages: { where: { isPrimary: true } }
      } : undefined
    });

    if (productById) return productById;

    // Jika tidak ditemukan, cari berdasarkan nama yang mirip
    // Kode ini berasumsi database MySQL/PostgreSQL untuk LIKE query
    const productsByName = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: productIdentifier } },
          { name: { equals: productIdentifier } }
        ]
      },
      include: includeDetails ? {
        category: true,
        productImages: { where: { isPrimary: true } }
      } : undefined,
      take: 1 // Ambil satu yang paling cocok
    });

    if (productsByName.length > 0) return productsByName[0];
    return null;
  } catch (error) {
    console.error("Error finding product:", error);
    return null;
  }
}

// Ganti fungsi processUpdateProduct dengan ini:
async function processUpdateProduct(parsedResponse, adminData) {
  try {
    // Dapatkan ID produk dari respons atau cari berdasarkan nama
    let productId = parsedResponse.data.id;
    let existingProduct = null;
    
    // Coba cari produk berdasarkan ID atau nama
    if (productId) {
      existingProduct = await findProductByNameOrId(productId);
    }
    
    // Jika masih tidak ditemukan dan ada nama, coba cari berdasarkan nama
    if (!existingProduct && parsedResponse.data.name) {
      const productByName = await findProductByNameOrId(parsedResponse.data.name);
      if (productByName) {
        existingProduct = productByName;
        productId = productByName.id;
      }
    }

    if (!existingProduct) {
      // Log untuk debugging
      console.error("Product not found:", productId || "No valid ID provided");
      
      return {
        action: "UPDATE_PRODUCT",
        success: false,
        error: `Produk dengan ID/nama "${productId || parsedResponse.data.name}" tidak ditemukan.`
      };
    }
    
    console.log("Found product to update:", existingProduct.name);
    
    // Siapkan data update
    const updateData = {};
    
    // Update nama produk jika tersedia dan berbeda
    if (parsedResponse.data.name && parsedResponse.data.name !== existingProduct.name) {
      updateData.name = parsedResponse.data.name;
      updateData.slug = generateSlug(parsedResponse.data.name); // Update slug juga
    }
    
    // Update deskripsi jika tersedia
    if (parsedResponse.data.description) {
      updateData.description = parsedResponse.data.description;
    }
    
    // Update harga jika tersedia
    if (parsedResponse.data.price) {
      updateData.price = parseFloat(parsedResponse.data.price);
    }
    
    // Update harga modal jika tersedia
    if (parsedResponse.data.costPrice) {
      updateData.costPrice = parseFloat(parsedResponse.data.costPrice);
    }
    
    // Update stok jika tersedia
    if (parsedResponse.data.weightInStock) {
      updateData.weightInStock = parseFloat(parsedResponse.data.weightInStock);
    }
    
    // Update minimal order jika tersedia
    if (parsedResponse.data.minOrderWeight) {
      updateData.minOrderWeight = parseFloat(parsedResponse.data.minOrderWeight);
    }
    
    // Update kategori jika tersedia
    if (parsedResponse.data.categoryId || parsedResponse.data.categoryName) {
      let categoryId = parsedResponse.data.categoryId;
      
      // Jika tidak ada categoryId tapi ada categoryName, cari ID berdasarkan nama
      if (!categoryId && parsedResponse.data.categoryName) {
        const category = adminData.categories.find(
          c => c.name.toLowerCase() === parsedResponse.data.categoryName.toLowerCase()
        );
        if (category) {
          categoryId = category.id;
        }
      }
      
      if (categoryId) {
        updateData.categoryId = categoryId;
      }
    }
    
    // Cek apakah ada data yang diupdate
    if (Object.keys(updateData).length === 0) {
      return {
        action: "UPDATE_PRODUCT",
        success: false,
        error: "Tidak ada data yang diperbarui."
      };
    }
    
    // Eksekusi update
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: true
      }
    });
    
    return {
      action: "UPDATE_PRODUCT",
      success: true,
      product: {
        ...updatedProduct,
        categoryName: updatedProduct.category?.name || "Tidak diketahui"
      }
    };
  } catch (error) {
    console.error("Error updating product:", error);
    return {
      action: "UPDATE_PRODUCT",
      success: false,
      error: error.message || "Terjadi kesalahan saat memperbarui produk."
    };
  }
}

module.exports = {
  adminChat
};