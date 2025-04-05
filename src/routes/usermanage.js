const router = require('express').Router();
const { 
  getAllUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser,
  resetPassword
} = require('../controllers/usermanageController');
const { auth, adminOnly } = require('../middleware/auth');

// Protect all routes with admin middleware
router.use(auth, adminOnly);

// User management routes
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/reset-password', resetPassword);

module.exports = router;