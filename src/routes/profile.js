const express = require('express');
const { auth } = require('../middleware/auth');
const {
  getUserProfile,
  updateProfile,
  changePassword,
  getUserOrders,
  getOrderDetails
} = require('../controllers/profileController');

const router = express.Router();

// Protected routes
router.get('/', auth, getUserProfile);
router.put('/update', auth, updateProfile);
router.put('/change-password', auth, changePassword);
router.get('/orders', auth, getUserOrders);
router.get('/orders/:orderId', auth, getOrderDetails);

module.exports = router;