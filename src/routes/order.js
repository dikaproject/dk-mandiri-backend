const router = require('express').Router();
const { 
  createOrder, 
  getUserOrders, 
  getOrderDetails, 
  updateOrderStatus,
  updateShipping,
  getShippingDetails
} = require('../controllers/OrderController');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth);

router.post('/create', createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderDetails);
router.put('/:id/status', auth, adminOnly, updateOrderStatus);

// New shipping endpoints
router.put('/:orderId/shipping', auth, adminOnly, updateShipping);
router.get('/:orderId/shipping', getShippingDetails);

module.exports = router;