const router = require('express').Router();
const { assistantChat } = require('../controllers/assistantController');
const { auth } = require('../middleware/auth');

// Public endpoint for the assistant chat
router.post('/chat', assistantChat);

// Protected endpoint for authenticated users (optional)
// This could provide more personalized responses based on user history
router.post('/chat/personalized', auth, assistantChat);

module.exports = router;