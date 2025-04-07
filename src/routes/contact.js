const router = require('express').Router();
const { submitContactForm } = require('../controllers/contactController');

router.post('/submit', submitContactForm);

module.exports = router;