const router = require('express').Router();
const { 
  Product, 
  CreateProduct, 
  ShowProduct, 
  UpdateProduct, 
  DeleteProduct,
  GetTrendingProducts,
  GetProductBySlug,
  UpdateProductStock
} = require('../controllers/ProductController');

router.get('/trending', GetTrendingProducts);
router.get('/slug/:slug', GetProductBySlug);
router.get('/', Product);
router.post('/', CreateProduct);
router.get('/:id', ShowProduct);
router.put('/:id', UpdateProduct);
router.delete('/:id', DeleteProduct);

router.patch('/:id/stock', UpdateProductStock);

module.exports = router;