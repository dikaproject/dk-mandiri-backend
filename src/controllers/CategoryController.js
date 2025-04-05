const prisma = require('../config/database');

// Fungsi untuk generate slug dari nama kategori
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '') // Hapus karakter selain huruf, angka, dan spasi
    .replace(/\s+/g, '-')       // Ganti spasi dengan tanda minus
    .replace(/-+/g, '-')        // Hindari multiple tanda minus
    .replace(/^-|-$/g, '');     // Hapus tanda minus di awal dan akhir
};

const GetCategory = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const CreateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Generate slug dari nama
    let slug = generateSlug(name);

    // Cek apakah slug sudah ada
    const existingCategory = await prisma.category.findUnique({
      where: { slug }
    });

    // Jika slug sudah ada, tambahkan angka random
    if (existingCategory) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const ShowCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const UpdateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Generate slug dari nama
    let slug = generateSlug(name);

    // Cek apakah slug sudah ada (kecuali untuk kategori yang sedang diupdate)
    const existingCategory = await prisma.category.findFirst({
      where: {
        slug,
        id: {
          not: id
        }
      }
    });

    // Jika slug sudah ada, tambahkan angka random
    if (existingCategory) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const category = await prisma.category.update({
      where: {
        id,
      },
      data: {
        name,
        slug,
        description,
      },
    });

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const DeleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Cek apakah kategori memiliki produk terkait
    const categoryWithProducts = await prisma.product.findFirst({
      where: { categoryId: id }
    });

    if (categoryWithProducts) {
      return res.status(400).json({ 
        message: 'Cannot delete category that has associated products. Remove all products first.'
      });
    }

    const category = await prisma.category.delete({
      where: {
        id,
      },
    });

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = { GetCategory, CreateCategory, ShowCategory, UpdateCategory, DeleteCategory };