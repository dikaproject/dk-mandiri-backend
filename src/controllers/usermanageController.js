const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const whatsappService = require('../services/whatsappService');

const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true, // Ubah dari name ke username
        phone: true,
        role: true,
        isVerified: true, // Ubah dari isActive ke isVerified
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform data untuk kecocokan dengan frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.username, // Map username ke name untuk frontend
      phone: user.phone || '',
      role: user.role,
      isActive: user.isVerified, // Map isVerified ke isActive untuk frontend
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.status(200).json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Transform untuk frontend
    const transformedUser = {
      id: user.id,
      email: user.email,
      name: user.username,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json(transformedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, name, phone, password, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username: name, // Gunakan username alih-alih name
        phone,
        password: hashedPassword,
        role: role || 'USER',
        isVerified: true // Gunakan isVerified alih-alih isActive
      },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform untuk frontend
    const transformedUser = {
      id: user.id,
      email: user.email,
      name: user.username,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(201).json(transformedUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, phone, role, isActive } = req.body;

    // Check if email is taken by another user
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id },
        },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use by another user' });
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: {
        email,
        username: name, // Gunakan username alih-alih name
        phone,
        role,
        isVerified: isActive // Gunakan isVerified alih-alih isActive
      },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform untuk frontend
    const transformedUser = {
      id: user.id,
      email: user.email,
      name: user.username,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json(transformedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reset user password
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ambil data user termasuk nomor telepon
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        username: true,
        phone: true,
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate random 4-digit number
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const newPassword = `Dkmandiri-RST${randomDigits}`;
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });
    
    let notificationSent = false;
    let notificationError = null;
    
    // Cek apakah user punya nomor telepon
    if (user.phone) {
      // Kirim notifikasi WhatsApp dengan password baru
      const notificationResult = await whatsappService.sendPasswordReset(user.phone, {
        name: user.username,
        newPassword
      });
      
      notificationSent = notificationResult.success;
      if (!notificationResult.success) {
        notificationError = notificationResult.error;
      }
    }
    
    res.status(200).json({ 
      message: notificationSent 
        ? 'Password reset successfully and sent via WhatsApp' 
        : 'Password reset successfully',
      newPassword,
      notificationSent,
      notificationError,
      hasPhone: !!user.phone
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword
};