const router = require('express').Router();
const { 
  getUserAddresses,
  getAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} = require('../controllers/addressController');
const { validateAddress } = require('../middleware/validation');
const { auth } = require('../middleware/auth');

router.use(auth);

// Get all addresses for current user
router.get('/', getUserAddresses);

// Get specific address
router.get('/:id', getAddress);

// Create address with validation
router.post('/add', validateAddress, addAddress);

// Update address with validation
router.put('/:id', validateAddress, updateAddress);

// Delete address
router.delete('/:id', deleteAddress);

// Set address as default (primary)
router.put('/:id/default', setDefaultAddress);

module.exports = router;