const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
};

const Product = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        costPrice: true,  
        weightInStock: true,
        minOrderWeight: true,
        isAvailable: true,
        category: {
          select: { id: true, name: true },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            isPrimary: true,
          },
          orderBy: {
            isPrimary: 'desc'
          }
        },
        _count: {
          select: {
            images: true
          }
        }
      },
    });

    const transformedProducts = products.map(product => ({
      ...product,
      primaryImage: product.images.find(img => img.isPrimary)?.imageUrl || null,
      additionalImages: product.images.filter(img => !img.isPrimary).map(img => img.imageUrl),
      totalImages: product._count.images
    }));

    delete transformedProducts._count;

    res.status(200).json(transformedProducts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const CreateProduct = async (req, res) => {
  try {
    const { name, description, price, costPrice, weightInStock, minOrderWeight, isAvailable, categoryId } = req.body;

    if (costPrice > price) {
      return res.status(400).json({ message: 'Cost price cannot be greater than selling price' });
    }

    let slug = generateSlug(name);
    
    const existingProduct = await prisma.product.findFirst({
      where: { slug }
    });
    
    if (existingProduct) {
      slug = `${slug}-${Date.now()}`;
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price,
        costPrice,  // Add cost price to creation
        weightInStock,
        minOrderWeight,
        isAvailable,
        categoryId,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const GetProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        costPrice: true,  
        weightInStock: true,
        minOrderWeight: true,
        isAvailable: true,
        category: {
          select: { id: true, name: true },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            isPrimary: true,
          },
          orderBy: {
            isPrimary: 'desc'
          }
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const transformedProduct = {
      ...product,
      primaryImage: product.images.find(img => img.isPrimary)?.imageUrl || null,
      additionalImages: product.images.filter(img => !img.isPrimary).map(img => img.imageUrl),
      totalImages: product.images.length
    };

    res.status(200).json(transformedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const ShowProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        costPrice: true,  
        weightInStock: true,
        minOrderWeight: true,
        isAvailable: true,
        category: {
          select: { id: true, name: true },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            isPrimary: true,
          },
          orderBy: {
            isPrimary: 'desc'
          }
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const transformedProduct = {
      ...product,
      primaryImage: product.images.find(img => img.isPrimary)?.imageUrl || null,
      additionalImages: product.images.filter(img => !img.isPrimary).map(img => img.imageUrl),
      totalImages: product.images.length
    };

    res.status(200).json(transformedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const UpdateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, costPrice, weightInStock, minOrderWeight, isAvailable, categoryId } = req.body;

    if (price !== undefined && costPrice !== undefined && costPrice > price) {
      return res.status(400).json({ message: 'Cost price cannot be greater than selling price' });
    }

    const updateData = {};
    
    if (name) {
      let slug = generateSlug(name);
      
      const existingProduct = await prisma.product.findFirst({
        where: { 
          slug,
          id: { not: id }
        }
      });
      
      if (existingProduct) {
        slug = `${slug}-${Date.now()}`;
      }
      
      updateData.name = name;
      updateData.slug = slug;
    }

    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (costPrice !== undefined) updateData.costPrice = costPrice; 
    if (weightInStock !== undefined) updateData.weightInStock = weightInStock;
    if (minOrderWeight !== undefined) updateData.minOrderWeight = minOrderWeight;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const DeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!product)
      return res.status(404).json({ message: 'Product not found' });

    product.images.forEach((image) => {
      const fileName = path.basename(image.imageUrl);
      const filePath = path.join(__dirname, '..', 'uploads', 'product', fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Gagal menghapus file ${filePath}:`, err);
        }
      }
    });

    const deletedProduct = await prisma.product.delete({
      where: { id },
    });

    res.status(200).json(deletedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const GetTrendingProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    
    const trendingProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        costPrice: true, 
        weightInStock: true,
        minOrderWeight: true,
        isAvailable: true,
        category: {
          select: { id: true, name: true },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            isPrimary: true,
          },
          orderBy: {
            isPrimary: 'desc'
          }
        },
        _count: {
          select: {
            orderItems: true
          }
        },
        orderItems: {
          select: {
            weight: true,
            createdAt: true
          }
        }
      },
      where: {
        isAvailable: true
      },
      orderBy: {
        orderItems: {
          _count: 'desc'
        }
      },
      take: limit
    });

    const transformedProducts = trendingProducts.map(product => {
      // Hitung total berat yang terjual bulan ini
      const soldThisMonth = product.orderItems.filter(item => 
        new Date(item.createdAt) >= new Date(new Date().setDate(1))
      ).reduce((sum, item) => sum + Number(item.weight), 0);
      
      // Hitung total berat yang terjual keseluruhan
      const totalSold = product.orderItems.reduce(
        (sum, item) => sum + Number(item.weight), 
        0
      );
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        costPrice: Number(product.costPrice), // Include cost price
        weightInStock: Number(product.weightInStock),
        minOrderWeight: Number(product.minOrderWeight),
        category: product.category,
        primaryImage: product.images.find(img => img.isPrimary)?.imageUrl || null,
        additionalImages: product.images.filter(img => !img.isPrimary).map(img => img.imageUrl),
        soldThisMonth: soldThisMonth, // Simpan dalam gram (tidak perlu konversi)
        totalSold: totalSold, // Simpan dalam gram
        totalOrders: product._count.orderItems
      };
    });

    res.status(200).json(transformedProducts);
  } catch (error) {
    console.error('Error getting trending products:', error);
    res.status(500).json({ message: error.message });
  }
};

const UpdateProductStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { weightInStock } = req.body;
    
    // Validasi input
    if (weightInStock === undefined) {
      return res.status(400).json({ message: 'weightInStock is required' });
    }
    
    // Pastikan konversi ke tipe data yang benar (number)
    const numericStock = parseFloat(weightInStock);
    
    if (isNaN(numericStock)) {
      return res.status(400).json({ message: 'Invalid stock value' });
    }
    
    // Log untuk debugging
    console.log('Updating product stock:');
    console.log('- Product ID:', id);
    console.log('- New stock value:', numericStock);
    console.log('- Value type:', typeof numericStock);
    
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        weightInStock: numericStock // Simpan sebagai decimal di database
      },
      select: {
        id: true,
        name: true,
        weightInStock: true
      }
    });
    
    // Log hasil update
    console.log('Stock updated successfully:');
    console.log('- New stock in DB:', updatedProduct.weightInStock);
    
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  Product, 
  CreateProduct, 
  ShowProduct, 
  UpdateProduct, 
  DeleteProduct, 
  GetTrendingProducts, 
  GetProductBySlug,
  UpdateProductStock 
};
