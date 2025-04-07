const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { auth } = require('../middleware/auth');
const { 
  getAllReviews, 
  createReview, 
  getReviewById, 
  deleteReview 
} = require('../controllers/communityController');

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/reviews');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'review-' + uniqueSuffix + ext);
  }
});

// Create multer upload instance
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Public routes
router.get('/', getAllReviews);
router.get('/:id', getReviewById);

// Create review route - authentication optional
router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    // If auth token is provided, authenticate user, otherwise continue as guest
    if (req.headers.authorization) {
      return auth(req, res, () => createReview(req, res));
    }
    createReview(req, res);
  } catch (error) {
    next(error);
  }
});

// Protected route - requires authentication
router.delete('/:id', auth, deleteReview);

module.exports = router;