const prisma = require('../config/database');
const axios = require('axios');

// Helper function to get product data
const getProductData = async () => {
  try {
    // Get all fish products with their prices, categories, and order history
    const products = await prisma.product.findMany({
      where: {
        isAvailable: true
      },
      include: {
        category: true,
        orderItems: {
          include: {
            order: true
          }
        }
      }
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching product data:', error);
    throw error;
  }
};

// Helper function to get top selling products dengan filter status order yang benar
const getTopSellingProducts = async (limit = 5) => {
  try {
    // Get total sales across all time dengan hanya menghitung pesanan DELIVERED dan SHIPPED
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        weight: true
      },
      where: {
        order: {
          status: {
            in: ['DELIVERED', 'SHIPPED'] // Hanya hitung pesanan yang sudah dikirim atau diterima
          }
        }
      },
      orderBy: {
        _sum: {
          weight: 'desc'
        }
      },
      take: limit,
    });

    // Get the product details for these top products
    const productsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: {
            id: item.productId
          },
          include: {
            category: true
          }
        });
        
        // Get detailed sales info for this product dengan filter status yang tepat
        const yearSales = await prisma.orderItem.aggregate({
          where: {
            productId: item.productId,
            order: {
              orderDate: {
                gte: new Date(new Date().getFullYear(), 0, 1) // From Jan 1 of current year
              },
              status: {
                in: ['DELIVERED', 'SHIPPED'] // Hanya hitung pesanan yang sudah dikirim atau diterima
              }
            }
          },
          _sum: {
            weight: true
          }
        });
        
        return {
          ...product,
          totalSold: item._sum.weight,
          soldThisYear: yearSales._sum.weight || 0
        };
      })
    );
    
    return productsWithDetails;
  } catch (error) {
    console.error('Error fetching top selling products:', error);
    throw error;
  }
};

// Helper function to get large bulk orders (e.g., supplier orders)
const getLargeBulkOrders = async (minWeightKg = 2000) => {
  try {
    // Convert minWeightKg to grams since weight is stored in grams
    const minWeightGrams = minWeightKg * 1000;
    
    // Find order items with weight >= minWeightGrams and successful status
    const largeOrders = await prisma.orderItem.findMany({
      where: {
        weight: {
          gte: minWeightGrams
        },
        order: {
          status: {
            in: ['DELIVERED', 'SHIPPED'] // Hanya pesanan sukses
          }
        }
      },
      include: {
        product: {
          include: {
            category: true
          }
        },
        order: {
          include: {
            user: true
          }
        }
      }
    });
    
    return largeOrders;
  } catch (error) {
    console.error('Error fetching large bulk orders:', error);
    throw error;
  }
};

// Helper function to get total sales statistics with improved status filtering
const getSalesStatistics = async () => {
  try {
    // Get current year
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    
    // Get total sales for all time and current year
    const [totalSales, yearSales, currentYearOrders, successfulOrders] = await Promise.all([
      // Total sales all time (hanya pesanan yang berhasil)
      prisma.orderItem.aggregate({
        _sum: {
          weight: true
        },
        where: {
          order: {
            status: {
              in: ['DELIVERED', 'SHIPPED'] // Pesanan yang sudah dikirim atau diterima
            }
          }
        }
      }),
      
      // Sales this year (hanya pesanan yang berhasil)
      prisma.orderItem.aggregate({
        _sum: {
          weight: true
        },
        where: {
          order: {
            orderDate: {
              gte: startOfYear
            },
            status: {
              in: ['DELIVERED', 'SHIPPED'] // Pesanan yang sudah dikirim atau diterima
            }
          }
        }
      }),
      
      // Count of orders this year
      prisma.order.count({
        where: {
          orderDate: {
            gte: startOfYear
          }
        }
      }),
      
      // Count successful orders this year
      prisma.order.count({
        where: {
          orderDate: {
            gte: startOfYear
          },
          status: {
            in: ['DELIVERED', 'SHIPPED']
          }
        }
      })
    ]);
    
    // Get breakdown by order status for analisis yang lebih baik
    const orderStatusBreakdown = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });
    
    return {
      totalSalesKg: parseFloat(totalSales._sum.weight || 0) / 1000, // Convert from grams to kg
      yearSalesKg: parseFloat(yearSales._sum.weight || 0) / 1000,   // Convert from grams to kg
      yearOrderCount: currentYearOrders,
      successfulOrderCount: successfulOrders,
      orderStatusBreakdown: orderStatusBreakdown.reduce((acc, curr) => {
        acc[curr.status.toLowerCase()] = curr._count.id;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Error fetching sales statistics:', error);
    throw error;
  }
};

// Helper function untuk mendapatkan detail pesanan sukses per produk
const getSuccessfulOrdersByProduct = async (limit = 10) => {
  try {
    // Dapatkan total pesanan sukses per produk
    const productOrders = await prisma.product.findMany({
      take: limit,
      include: {
        category: true,
        orderItems: {
          where: {
            order: {
              status: {
                in: ['DELIVERED', 'SHIPPED']
              }
            }
          },
          include: {
            order: true
          }
        }
      },
      orderBy: {
        orderItems: {
          _count: 'desc'
        }
      }
    });
    
    // Format data untuk memudahkan konsumsi oleh AI
    return productOrders.map(product => {
      // Hitung total berat terjual
      const totalSold = product.orderItems.reduce((sum, item) => sum + parseFloat(item.weight), 0);
      
      // Hitung jumlah pesanan sukses
      const orderCount = new Set(product.orderItems.map(item => item.orderId)).size;
      
      return {
        id: product.id,
        name: product.name,
        category: product.category.name,
        totalSoldKg: totalSold / 1000, // Convert to kg
        successfulOrderCount: orderCount,
        isAvailable: product.isAvailable,
        currentStock: parseFloat(product.weightInStock) / 1000 // Convert to kg
      };
    });
  } catch (error) {
    console.error('Error fetching successful orders by product:', error);
    throw error;
  }
};

// Analisis konteks pesan
const analyzeMessage = (message) => {
  // Ubah ke huruf kecil untuk pemrosesan
  const lowerMessage = message.toLowerCase();
  
  // Deteksi jenis pesan
  const isGreeting = /^(halo|hai|hi|hello|hey|selamat|pagi|siang|sore|malam)/.test(lowerMessage);
  const isLocationQuery = /(lokasi|alamat|dimana|di mana|maps|peta|jalan|tempat|letak)/.test(lowerMessage);
  const isPriceQuery = /(harga|berapa|mahal|murah|biaya|tarif|rupiah|idr|rp)/.test(lowerMessage);
  const isProductQuery = /(ikan|produk|jual|tersedia|stok|ready|stock|punya)/.test(lowerMessage);
  const isSalesQuery = /(terjual|penjualan|laris|terlaris|populer|jual|banyak)/.test(lowerMessage);
  const isContactQuery = /(kontak|hubungi|telepon|telpon|hp|handphone|nomor|wa|whatsapp|hubungan)/.test(lowerMessage);
  
  return {
    isGreeting,
    isLocationQuery,
    isPriceQuery,
    isProductQuery,
    isSalesQuery,
    isContactQuery
  };
};

// Main controller function to handle AI chat
const assistantChat = async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Analisis konteks pesan
    const messageContext = analyzeMessage(message);
    
    // Hanya ambil data yang diperlukan berdasarkan konteks
    let dataPromises = [];
    
    // Selalu ambil data produk untuk semua jenis pesan
    dataPromises.push(getProductData()); 
    
    // Tambahkan query sesuai konteks pesan
    if (messageContext.isSalesQuery) {
      dataPromises.push(getTopSellingProducts(10));
      dataPromises.push(getSalesStatistics());
      dataPromises.push(getSuccessfulOrdersByProduct(10)); // Data baru
    } else {
      // Tetap ambil data penjualan tapi terbatas
      dataPromises.push(getTopSellingProducts(3)); 
    }
    
    if (messageContext.isSalesQuery) {
      dataPromises.push(getLargeBulkOrders());
    }
    
    // Jika bukan query khusus, ambil sales statistics dasar
    if (!messageContext.isSalesQuery && !messageContext.isGreeting) {
      dataPromises.push(getSalesStatistics());
    }
    
    // Execute all promises
    const results = await Promise.all(dataPromises);
    
    // Prepare data based on results
    const products = results[0];
    let topSelling = results[1];
    let salesStats = null;
    let successfulProducts = null;
    let bulkOrders = null;
    
    // Assign results based on query type
    if (messageContext.isSalesQuery) {
      salesStats = results[2];
      successfulProducts = results[3];
      bulkOrders = results[4];
    } else if (!messageContext.isGreeting) {
      salesStats = results[2];
    }
    
    // Struktur data default
    const contextData = {
      current_date: new Date().toISOString(),
      store_info: {
        name: "DK Mandiri Seafood",
        location: "Jl. Suryanegara, Mertangga, Jetis, Kec. Nusawungu, Kabupaten Cilacap, Jawa Tengah 53283",
        maps_link: "https://maps.app.goo.gl/UPKjcaAdxg5zFBgr5",
        rating: 4.9,
        description: "DK Mandiri menjual ikan air tawar, ikan laut, udang dan berbagai jenis ikan lainnya dengan harga murah. Produk bisa dibeli untuk dikonsumsi atau dijual kembali. Kami juga melayani pembelian grosir untuk supplier."
      }
    };
    
    // Tambahkan data produk
    contextData.available_products = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category.name,
      price_per_kg: parseFloat(p.price),
      available_weight_kg: parseFloat(p.weightInStock / 1000)
    }));
    
    // Tambahkan data penjualan jika diperlukan
    if (topSelling) {
      contextData.top_selling_fish = topSelling.map(p => ({
        name: p.name,
        category: p.category.name,
        total_sold_kg: parseFloat(p.totalSold / 1000),
        sold_this_year_kg: parseFloat(p.soldThisYear || 0) / 1000,
        current_price_per_kg: parseFloat(p.price)
      }));
    }
    
    // Tambahkan data produk dengan pesanan sukses
    if (successfulProducts) {
      contextData.successful_products = successfulProducts;
    }
    
    // Tambahkan statistik penjualan jika diperlukan
    if (salesStats) {
      contextData.sales_statistics = {
        total_sales_all_time_kg: salesStats.totalSalesKg,
        total_sales_this_year_kg: salesStats.yearSalesKg,
        total_orders_this_year: salesStats.yearOrderCount,
        successful_orders_this_year: salesStats.successfulOrderCount,
        order_status_breakdown: salesStats.orderStatusBreakdown
      };
    }
    
    // Tambahkan pesanan besar jika diperlukan
    if (bulkOrders) {
      contextData.large_supplier_orders = bulkOrders.map(o => ({
        product_name: o.product.name,
        category: o.product.category.name,
        order_weight_kg: parseFloat(o.weight / 1000),
        order_date: o.order.orderDate,
        order_status: o.order.status
      }));
    }
    
    // Tentukan prompt system berdasarkan konteks pesan
    let systemPrompt = '';
    
    if (messageContext.isGreeting) {
      systemPrompt = `Kamu adalah AI assistant DK Mandiri yang ramah dan hangat. Kamu bernama DK Mandiri Assistant. Saat menerima sapaan atau ucapan seperti "halo", "hai", dll, balaslah dengan sapaan ramah dan singkat seperti yang dilakukan pelayan toko pada umumnya. Jangan berikan informasi detail tentang toko kecuali ditanyakan.

Contoh respon yang baik untuk sapaan:
"Halo! Selamat datang di DK Mandiri. Ada yang bisa saya bantu terkait produk ikan kami hari ini?"
"Hai! Saya asisten DK Mandiri. Apa ada informasi seputar ikan yang Anda butuhkan?"

Ingat, tetap ramah dan alami, tidak kaku seperti robot.`;
    } else {
      systemPrompt = `Kamu adalah DK Mandiri Assistant, asisten AI yang membantu memberikan informasi tentang produk ikan, harga, dan tren pasar untuk toko DK Mandiri Seafood.

Tentang DK Mandiri Seafood:
- Kami berlokasi di Jl. Suryanegara, Mertangga, Jetis, Kec. Nusawungu, Kabupaten Cilacap, Jawa Tengah 53283
- Link Google Maps kami: https://maps.app.goo.gl/UPKjcaAdxg5zFBgr5
- Kami memiliki rating 4.9 di Google Maps
- Kami menjual ikan air tawar, ikan laut, udang, dan berbagai jenis ikan lainnya dengan harga terjangkau
- Produk kami bisa dibeli untuk dikonsumsi atau dijual kembali
- Kami menyediakan opsi grosir untuk supplier

Kamu memiliki akses real-time ke data berikut:
1. Informasi toko dan lokasi
2. Harga ikan dan stok saat ini
3. Produk ikan terlaris dengan data penjualan sepanjang waktu dan tahun ini
4. Statistik penjualan total (sepanjang waktu dan tahun ini)
5. Informasi tentang pesanan supplier besar (2+ ton)

CATATAN PENTING TENTANG DATA:
- Saat berbicara tentang penjualan, hanya hitung pesanan dengan status DELIVERED atau SHIPPED
- Angka penjualan mencerminkan berat pesanan yang sudah terkirim/selesai, bukan termasuk yang masih pending

PANDUAN INTERAKSI:
- Selalu bersikap ramah dan natural seperti manusia, tidak kaku seperti robot
- Berikan jawaban yang relevan dan sesuai konteks, jangan membanjiri pengguna dengan informasi berlebihan
- Berikan informasi toko lengkap HANYA jika ditanyakan spesifik
- Saat menjelaskan harga, selalu sebutkan dalam Rupiah (IDR) per kilogram
- Jika ditanya tentang data penjualan atau popularitas produk, gunakan angka aktual dari database
- Jika kamu tidak tahu sesuatu atau data tidak berisi informasi yang ditanyakan, katakan dengan sopan dan tawarkan bantuan lain`;
    }
    
    // Call Groq AI API
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
          },
          {
            role: "assistant",
            content: "Saya akan membantu Anda dengan informasi dari DK Mandiri. Berikut data dari sistem kami:"
          },
          {
            role: "user",
            content: `Ini data dari sistem DK Mandiri: ${JSON.stringify(contextData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        }
      }
    );
    
    // Send the AI response back to the client
    res.status(200).json({
      success: true,
      response: response.data.choices[0].message.content
    });
    
  } catch (error) {
    console.error('AI Assistant error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request'
    });
  }
};

module.exports = {
  assistantChat
};