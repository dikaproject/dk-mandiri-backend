const router = require('express').Router();
const { admindash } = require('../controllers/admindashController');
const { auth, adminOnly } = require('../middleware/auth');

// Hanya admin yang dapat mengakses dashboard
router.get('/', auth, adminOnly, admindash);

module.exports = router;