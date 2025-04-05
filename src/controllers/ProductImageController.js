const prisma = require('../config/database');

const GetProductImage = async (req, res) => {
  try {
    const productImages = await prisma.productImage.findMany({
      select: {
        id: true,
        imageUrl: true,
        isPrimary: true,
        createdAt: true,
        product: {
          select: { id: true, name: true },
        },
      },
    });
    res.status(200).json(productImages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Endpoint untuk create multiple images dengan primaryIndex menentukan index gambar yang primary
const CreateProductImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    const { productId, primaryIndex } = req.body;
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }
    // Jika ada primaryIndex (misalnya "0" artinya file pertama), update gambar yang sudah ada
    if (primaryIndex !== undefined) {
      await prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });
    }

    const primaryIdx = primaryIndex !== undefined ? parseInt(primaryIndex) : -1;
    const createPromises = req.files.map((file, idx) => {
      const imageUrl =
        req.protocol +
        '://' +
        req.get('host') +
        '/uploads/product/' +
        file.filename;
      return prisma.productImage.create({
        data: {
          imageUrl,
          isPrimary: idx === primaryIdx,
          productId,
        },
      });
    });

    const images = await Promise.all(createPromises);
    res.status(201).json({
      message: 'Product images created successfully',
      images,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const ShowProductImage = async (req, res) => {
  try {
    const { id } = req.params;
    const productImage = await prisma.productImage.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrl: true,
        isPrimary: true,
        createdAt: true,
        product: {
          select: { id: true, name: true },
        },
      },
    });
    if (!productImage)
      return res.status(404).json({ message: 'Product image not found' });
    res.status(200).json(productImage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const UpdateProductImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPrimary } = req.body; 
    const existingImage = await prisma.productImage.findUnique({ where: { id } });

    if (!existingImage)
      return res.status(404).json({ message: 'Product image not found' });

    let imageUrl = existingImage.imageUrl;
    if (req.file) {
      imageUrl =
        req.protocol +
        '://' +
        req.get('host') +
        '/uploads/product/' +
        req.file.filename;
    }

    if (isPrimary && (isPrimary === 'true' || isPrimary === true)) {
      await prisma.productImage.updateMany({
        where: { productId: existingImage.productId },
        data: { isPrimary: false },
      });
    }

    const updatedImage = await prisma.productImage.update({
      where: { id },
      data: {
        imageUrl,
        isPrimary:
          isPrimary !== undefined
            ? isPrimary === 'true' || isPrimary === true
            : existingImage.isPrimary,
      },
    });

    res.status(200).json({
      message: 'Product image updated successfully',
      productImage: updatedImage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const DeleteProductImage = async (req, res) => {
  try {
    const { id } = req.params;
    const existingImage = await prisma.productImage.findUnique({ where: { id } });
    if (!existingImage)
      return res.status(404).json({ message: 'Product image not found' });

    await prisma.productImage.delete({ where: { id } });

    // Jika gambar dihapus adalah primary, set gambar baru sebagai primary (misal gambar pertama berdasarkan createdAt)
    if (existingImage.isPrimary) {
      const anotherImage = await prisma.productImage.findFirst({
        where: { productId: existingImage.productId },
        orderBy: { createdAt: 'asc' },
      });
      if (anotherImage) {
        await prisma.productImage.update({
          where: { id: anotherImage.id },
          data: { isPrimary: true },
        });
      }
    }
    res.status(200).json({ message: 'Product image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  GetProductImage,
  CreateProductImages,
  ShowProductImage,
  UpdateProductImage,
  DeleteProductImage,
};