const validateRegister = (req, res, next) => {
  const { email, password, username, phone } = req.body;
  
  // Check required fields
  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, password, and username are required' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  // Validate username
  if (username.length < 3) {
    return res.status(400).json({ message: 'Username must be at least 3 characters' });
  }

  // Validate password
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  // Validate phone if provided
  if (phone) {
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid Indonesian phone number format' });
    }
  }

  next();
};

const validateAddress = (req, res, next) => {
  const { province, city, district, postalCode, fullAddress } = req.body;
  
  // Check required fields
  if (!province || !city || !district || !postalCode || !fullAddress) {
    return res.status(400).json({ 
      message: 'Province, city, district, postal code, and full address are required' 
    });
  }
  
  // Validate postal code format (numerical, 5 digits)
  if (!/^\d{5}$/.test(postalCode)) {
    return res.status(400).json({ message: 'Postal code must be a 5-digit number' });
  }
  
  // Validate phone number if provided
  const { phone } = req.body;
  if (phone && !/^\d{10,15}$/.test(phone.replace(/[\s\-+]/g, ''))) {
    return res.status(400).json({ message: 'Please provide a valid phone number' });
  }
  
  next();
};

module.exports = { validateRegister, validateAddress };