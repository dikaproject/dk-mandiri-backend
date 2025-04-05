const router = require('express').Router();
const { getAnalytics } = require('../controllers/analyticsController');
const { auth, adminOnly } = require('../middleware/auth');

// Only admin can access analytics
router.get('/', auth, adminOnly, getAnalytics);

module.exports = router;