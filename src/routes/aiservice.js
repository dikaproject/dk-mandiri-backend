const router = require('express').Router();
const { adminChat } = require('../controllers/aiserviceController');
const { auth, adminOnly } = require('../middleware/auth');

// Endpoint untuk chat dengan AI (hanya untuk admin)
router.post('/chat', auth, adminOnly, adminChat);

module.exports = router;