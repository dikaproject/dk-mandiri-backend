const router = require('express').Router();
const { CreateCategory, GetCategory, ShowCategory, UpdateCategory, DeleteCategory } = require('../controllers/CategoryController');

// Contoh route, misalnya GET /category
router.get('/', GetCategory);
router.post('/', CreateCategory);
router.get('/:id', ShowCategory);
router.put('/:id', UpdateCategory);
router.delete('/:id', DeleteCategory);


module.exports = router;
