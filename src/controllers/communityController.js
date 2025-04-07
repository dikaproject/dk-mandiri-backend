const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');

// Get all reviews
const getAllReviews = async (req, res) => {
  try {
    const reviews = await prisma.communityReview.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.status(200).json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create a new review
const createReview = async (req, res) => {
  try {
    const { name, email, message, rating } = req.body;
    
    // Validate required fields
    if (!name || !email || !message || !rating) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Check if user is authenticated
    let userId = null;
    if (req.user) {
      userId = req.user.id;
    }
    
    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/reviews/${req.file.filename}`;
    }
    
    const review = await prisma.communityReview.create({
      data: {
        name,
        email,
        message,
        rating: parseInt(rating),
        imageUrl,
        userId
      }
    });
    
    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single review by ID
const getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const review = await prisma.communityReview.findUnique({
      where: { id }
    });
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    res.status(200).json(review);
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if review exists
    const review = await prisma.communityReview.findUnique({
      where: { id }
    });
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check if user is authorized to delete (admin or review owner)
    if (req.user.role !== 'ADMIN' && review.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }
    
    // Delete image if exists
    if (review.imageUrl) {
      const imagePath = path.join(__dirname, '../../', review.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await prisma.communityReview.delete({
      where: { id }
    });
    
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllReviews,
  createReview,
  getReviewById,
  deleteReview
};