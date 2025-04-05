const prisma = require('../config/database');
const { generateToken } = require('../utils/jwt');
const bcrypt = require('bcrypt');

const register = async (req, res) => {
  try {
      const { email, password, username, phone } = req.body;
      
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
          return res.status(400).json({ message: 'Email already registered' });
      }

      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
          return res.status(400).json({ message: 'Username already taken' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
          data: { 
              email, 
              password: hashedPassword, 
              username,
              phone,
              role: "USER"
          },
          select: {
              id: true,
              email: true,
              username: true,
              phone: true,
              role: true
          }
      });

      const token = generateToken(user);
      res.status(201).json({ user, token });
  } catch (error) {
      res.status(400).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { login, password } = req.body; // login can be email or username
    
    // Find user by email or username
    const user = await prisma.user.findFirst({ 
      where: {
        OR: [
          { email: login },
          { username: login }
        ]
      },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        password: true
      }
    });
    
    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    const { password: _, ...userWithoutPassword } = user;
    const token = generateToken(userWithoutPassword);
    
    res.json({ 
      user: userWithoutPassword, 
      token 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        addresses: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
  
  module.exports = { register, login, getProfile };