const router = require('express').Router();
const upload = require('../config/multer');
const {
  GetProductImage,
  CreateProductImages,
  ShowProductImage,
  UpdateProductImage,
  DeleteProductImage,
} = require('../controllers/ProductImageController');

router.get('/', GetProductImage);

router.get('/:id', ShowProductImage);

router.post(
  '/upload',
  upload.array('images', 10),
  CreateProductImages
);

router.put('/:id', upload.single('image'), UpdateProductImage);

router.put('/:id/primary', UpdateProductImage);

router.delete('/:id', DeleteProductImage);

module.exports = router;