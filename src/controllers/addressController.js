const prisma = require('../config/database');

// Get all addresses for logged in user
const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { isPrimary: 'desc' } // Primary addresses first
    });
    
    res.status(200).json(addresses);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get specific address by ID
const getAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const address = await prisma.address.findFirst({
      where: { 
        id,
        userId // Ensure user can only access their own addresses
      }
    });
    
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    res.status(200).json(address);
  } catch (error) {
    console.error('Error fetching address:', error);
    res.status(500).json({ message: error.message });
  }
};

// Add new address
const addAddress = async (req, res) => {
  try {
    const { province, city, district, postalCode, fullAddress, isPrimary, recipientName, phone } = req.body;
    const userId = req.user.id;

    // If new address is primary, update all other addresses to non-primary
    if (isPrimary) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isPrimary: false }
      });
    }

    // If this is the first address, make it primary by default
    const addressCount = await prisma.address.count({
      where: { userId }
    });

    const address = await prisma.address.create({
      data: {
        province,
        city,
        district,
        postalCode,
        fullAddress,
        recipientName,
        phone,
        isPrimary: isPrimary || addressCount === 0, // First address is primary by default
        userId
      }
    });

    res.status(201).json(address);
  } catch (error) {
    console.error('Error creating address:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update fungsi updateAddress untuk menerima recipientName dan phone
const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { province, city, district, postalCode, fullAddress, isPrimary, recipientName, phone } = req.body;
    const userId = req.user.id;
    
    // First check if the address exists and belongs to the user
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id,
        userId
      }
    });
    
    if (!existingAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    // If updating to primary, set all other addresses to non-primary
    if (isPrimary) {
      await prisma.address.updateMany({
        where: { 
          userId,
          id: { not: id } 
        },
        data: { isPrimary: false }
      });
    }
    
    // Update the address
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        province: province || existingAddress.province,
        city: city || existingAddress.city,
        district: district || existingAddress.district,
        postalCode: postalCode || existingAddress.postalCode,
        fullAddress: fullAddress || existingAddress.fullAddress,
        recipientName: recipientName !== undefined ? recipientName : existingAddress.recipientName,
        phone: phone !== undefined ? phone : existingAddress.phone,
        isPrimary: isPrimary !== undefined ? isPrimary : existingAddress.isPrimary
      }
    });
    
    res.status(200).json(updatedAddress);
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete address
const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if the address exists and belongs to the user
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id,
        userId
      }
    });
    
    if (!existingAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    // Delete the address
    await prisma.address.delete({
      where: { id }
    });

    // If deleted address was primary, set another address as primary if available
    if (existingAddress.isPrimary) {
      const anotherAddress = await prisma.address.findFirst({
        where: { userId }
      });
      
      if (anotherAddress) {
        await prisma.address.update({
          where: { id: anotherAddress.id },
          data: { isPrimary: true }
        });
      }
    }
    
    res.status(200).json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ message: error.message });
  }
};

// Set address as default (primary)
const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if the address exists and belongs to the user
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id,
        userId
      }
    });
    
    if (!existingAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    // Set all addresses to non-primary
    await prisma.address.updateMany({
      where: { userId },
      data: { isPrimary: false }
    });
    
    // Set specified address as primary
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: { isPrimary: true }
    });
    
    res.status(200).json(updatedAddress);
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  getUserAddresses,
  getAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};