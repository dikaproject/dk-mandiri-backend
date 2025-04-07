const emailService = require('../services/emailService');

const submitContactForm = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email and message are required fields' 
      });
    }
    
    // Email validation (simple regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      });
    }
    
    // Send email
    const result = await emailService.sendContactEmail({ name, email, message });
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Your message has been sent successfully!'
      });
    } else {
      throw new Error(result.error || 'Failed to send email');
    }
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send your message. Please try again later.'
    });
  }
};

module.exports = { submitContactForm };