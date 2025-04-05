const prisma = require('../config/database');

// Get cart items for current user
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Tambahkan logging untuk debug
    console.log(`Fetching cart for user: ${userId}`);
    
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            weightInStock: true,
            minOrderWeight: true,
            images: {
              where: { isPrimary: true },
              select: { imageUrl: true },
              take: 1
            }
          }
        }
      }
    });
    
    console.log(`Found ${cartItems.length} cart items`);
    
    // Transform data untuk memudahkan konsumsi di frontend
    const transformedCart = cartItems.map(item => {
      // Logging untuk setiap item untuk debug
      console.log(`Processing cart item: ${item.id}, product: ${item.product.id}`);
      
      const totalPrice = parseFloat(item.product.price) * parseFloat(item.weight) / 1000;
      
      return {
        id: item.id,
        weight: item.weight, // Gunakan weight, frontend akan mengadaptasi
        product: {
          id: item.product.id,
          name: item.product.name,
          price: parseFloat(item.product.price), // Pastikan nilai numerik
          weightInStock: parseFloat(item.product.weightInStock),
          minOrderWeight: parseFloat(item.product.minOrderWeight),
          imageUrl: item.product.images[0]?.imageUrl || null
        },
        totalPrice: totalPrice
      };
    });
    
    const cartSummary = {
      items: transformedCart,
      totalItems: transformedCart.length,
      subtotal: transformedCart.reduce((sum, item) => sum + item.totalPrice, 0)
    };
    
    console.log('Cart data prepared successfully');
    res.status(200).json(cartSummary);
  } catch (error) {
    console.error('Error in getCart:', error);
    res.status(500).json({ message: error.message });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, weight } = req.body;

    // Validate product exists and has sufficient weight in stock
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.isAvailable) {
      return res.status(400).json({ message: 'Product is not available for sale' });
    }

    // Check if requested weight meets minimum order weight
    if (weight < parseFloat(product.minOrderWeight)) {
      return res.status(400).json({ 
        message: `Minimum order weight is ${product.minOrderWeight} grams` 
      });
    }

    // Check if enough weight in stock
    if (parseFloat(product.weightInStock) < weight) {
      return res.status(400).json({ 
        message: `Only ${product.weightInStock} grams available`
      });
    }

    // Check if item already in cart
    const existingCartItem = await prisma.cartItem.findFirst({
      where: { userId, productId }
    });

    let cartItem;

    if (existingCartItem) {
      // Update weight if item already exists
      const newWeight = parseFloat(existingCartItem.weight) + parseFloat(weight);
      
      if (newWeight > parseFloat(product.weightInStock)) {
        return res.status(400).json({ 
          message: `Cannot add more. Maximum available: ${product.weightInStock} grams`
        });
      }

      cartItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { weight: newWeight }
      });
    } else {
      // Create new cart item
      cartItem = await prisma.cartItem.create({
        data: { userId, productId, weight }
      });
    }

    res.status(200).json({ 
      message: 'Item added to cart',
      cartItem
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update cart item weight
const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { weight } = req.body;
    const userId = req.user.id;

    // Verify cart item belongs to user
    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
      include: { product: true }
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    if (cartItem.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this cart item' });
    }

    // Check if meets minimum weight
    if (parseFloat(weight) < parseFloat(cartItem.product.minOrderWeight)) {
      return res.status(400).json({ 
        message: `Minimum order weight is ${cartItem.product.minOrderWeight} grams` 
      });
    }

    // Check available weight in stock
    if (parseFloat(weight) > parseFloat(cartItem.product.weightInStock)) {
      return res.status(400).json({ message: `Only ${cartItem.product.weightInStock} grams available` });
    }

    const updatedCartItem = await prisma.cartItem.update({
      where: { id },
      data: { weight: parseFloat(weight) }
    });

    res.status(200).json(updatedCartItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify cart item belongs to user
    const cartItem = await prisma.cartItem.findUnique({
      where: { id }
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    if (cartItem.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to remove this cart item' });
    }

    await prisma.cartItem.delete({ where: { id } });

    res.status(200).json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Clear entire cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.cartItem.deleteMany({
      where: { userId }
    });

    res.status(200).json({ message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};