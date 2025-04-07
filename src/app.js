const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const addressRoutes = require('./routes/address');
const productRoutes = require('./routes/product');
const categoryRoutes = require('./routes/category');
const productImageRoutes = require('./routes/productimage');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const transactionRoutes = require('./routes/transaction');
const admindashRoutes = require('./routes/admindash');
const userManageRoutes = require('./routes/usermanage');
const analyticsRoutes = require('./routes/analytics');
const posadmin = require('./routes/posadmin');
const assistantRoutes = require('./routes/assistant');
const communityRoutes = require('./routes/community');
const contactRoutes = require('./routes/contact');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/uploads', (req, res, next) => {
  console.log('File requested:', req.path);
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/uploads', (req, res, next) => {
  console.log('File requested:', req.path);
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-images', productImageRoutes);
app.use('/api/cart', cartRoutes); 
app.use('/api/order', orderRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/dashboard', admindashRoutes);
app.use('/api/users', userManageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pos', posadmin);
app.use('/api/assistant', assistantRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/contact', contactRoutes);


// Error Handler
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;