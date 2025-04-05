const router = require('express').Router();
const { PosAdmin, createPOSTransaction, sendPOSReceipt } = require('../controllers/PosAdminController');
const { auth, adminOnly } = require('../middleware/auth');

// Check POS status
router.get('/', auth, adminOnly, PosAdmin);

// Create POS Transaction
router.post('/transaction', auth, adminOnly, createPOSTransaction);

// Send POS receipt via WhatsApp
router.post('/send-receipt/:transactionId', auth, adminOnly, sendPOSReceipt);

module.exports = router;