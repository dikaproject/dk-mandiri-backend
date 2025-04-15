const prisma = require('../config/database');
const whatsappService = require('../services/whatsappService');
const { createSnapApi } = require('../config/midtrans');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Handle Midtrans notification
const handlePaymentNotification = async (req, res) => {
  try {
    const notificationJson = req.body;

    const orderNumber = notificationJson.order_id;
    const transactionStatus = notificationJson.transaction_status;
    const fraudStatus = notificationJson.fraud_status;
    const paymentType = notificationJson.payment_type;

    let paymentStatus;
    if (transactionStatus === 'capture'){
      if (fraudStatus === 'challenge'){
        paymentStatus = 'PENDING';
      } else if (fraudStatus === 'accept'){
        paymentStatus = 'SUCCESS';
      }
    } else if (transactionStatus === 'settlement'){
      paymentStatus = 'SUCCESS';
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire'){
      paymentStatus = 'FAILED';
    } else if (transactionStatus === 'pending'){
      paymentStatus = 'PENDING';
    }

    // Find order by orderNumber
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        transaction: true,
        user: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: order.transaction.id },
      data: {
        status: paymentStatus,
        paymentMethod: paymentType
      }
    });

    // Update order status if payment successful
    if (paymentStatus === 'SUCCESS') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PROCESSING' }
      });

      // Send notification to user
      if (order.user.phone) {
        await whatsappService.sendPaymentConfirmation(
          order.user.phone,
          {
            customerName: order.user.username,
            orderNumber: order.orderNumber,
            amount: Number(order.totalAmount),
            paymentMethod: paymentType,
            paymentDate: new Date()
          }
        );
      }
    }

    res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error('Error handling payment notification:', error);
    res.status(500).json({ message: error.message });
  }
};

// Upload payment proof for manual payment
const uploadPaymentProof = async (req, res) => {
  try {
    console.log('Upload payment proof request received:', {
      transactionId: req.params.transactionId,
      fileExists: !!req.file
    });

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { transactionId } = req.params;
    const userId = req.user.id;

    // Find transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        order: true
      }
    });

    if (!transaction) {
      console.log(`Transaction not found: ${transactionId}`);
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check if user owns this transaction
    if (transaction.order.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Save file
    const fileExt = path.extname(req.file.originalname);
    const fileName = `payment_${transactionId}_${uuidv4()}${fileExt}`;
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'payments', fileName);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, req.file.buffer);
    
    // Update transaction with proof
    const publicPath = `/uploads/payments/${fileName}`;
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentProof: publicPath,
        status: 'PENDING' // Admin will verify and update to SUCCESS
      }
    });

    res.status(200).json({ 
      message: 'Payment proof uploaded successfully',
      path: publicPath
    });
  } catch (error) {
    console.error('Error uploading payment proof:', error);
    res.status(500).json({ message: error.message });
  }
};

// Verify payment (Admin only)
const verifyPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;

    if (!['SUCCESS', 'FAILED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        order: {
          include: {
            user: true
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status }
    });

    // Update order status if payment verified
    if (status === 'SUCCESS') {
      await prisma.order.update({
        where: { id: transaction.order.id },
        data: { status: 'PROCESSING' }
      });

      // Send notification to user
      if (transaction.order.user.phone) {
        await whatsappService.sendPaymentConfirmation(
          transaction.order.user.phone,
          {
            customerName: transaction.order.user.username,
            orderNumber: transaction.order.orderNumber,
            amount: Number(transaction.amount),
            paymentMethod: transaction.paymentMethod || 'Manual Transfer',
            paymentDate: new Date()
          }
        );
      }
    } else if (status === 'FAILED') {
      await prisma.order.update({
        where: { id: transaction.order.id },
        data: { status: 'CANCELLED' }
      });
    }

    res.status(200).json(updatedTransaction);
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    // Support both status and orderStatus field names for backward compatibility
    const status = req.body.status || req.body.orderStatus;
    const { staffName, notes } = req.body;
    
    if (!status || !['SHIPPED', 'SUCCESS', 'CANCELLED', 'DELIVERED', 'PROCESSING'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Find transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    const transactionStatusMap = {
      'SHIPPED': 'SUCCESS',
      'SUCCESS': 'SUCCESS',
      'DELIVERED': 'SUCCESS',
      'PROCESSING': 'SUCCESS',
      'CANCELLED': 'FAILED'
    };
    
    // Update transaction data
    const updateData = {
      status: transactionStatusMap[status] || transaction.status
    };
    
    // Process based on status
    if (status === 'SHIPPED') {
      // Create or update shipping record
      await prisma.shipping.upsert({
        where: { orderId: transaction.order.id },
        update: {
          deliveryStatus: 'Sedang Di Antarkan',
          staffName: staffName,
          notes: notes || null,
          deliveryDate: new Date()
        },
        create: {
          deliveryStatus: 'Sedang Di Antarkan',
          staffName: staffName,
          notes: notes || null,
          orderId: transaction.order.id,
          deliveryDate: new Date()
        }
      });
      
      // Also update order status
      await prisma.order.update({
        where: { id: transaction.order.id },
        data: { status: 'SHIPPED' }
      });
      
      // Send notification via WhatsApp if user has a phone
      if (transaction.order.user.phone) {
        try {
          await whatsappService.sendShippingNotification(
            transaction.order.user.phone,
            {
              customerName: transaction.order.user.username,
              orderNumber: transaction.order.orderNumber,
              deliveryDate: new Date(),
              deliveryStatus: 'Sedang Di Antarkan',
              staffName: staffName || 'Staff',
              notes: notes || ''
            }
          );
        } catch (notifError) {
          console.error('Failed to send shipping notification:', notifError);
          // Don't fail transaction update if notification fails
        }
      }
    } else if (status === 'DELIVERED' || status === 'SUCCESS') {
      // Add completionDetails for SUCCESS/DELIVERED status
      updateData.completionDetails = {
        completedBy: staffName || 'Admin',
        notes: notes || '',
        completedAt: new Date()
      };
      
      // Update order status
      await prisma.order.update({
        where: { id: transaction.order.id },
        data: { status: 'DELIVERED' }
      });
      
      // Send completion notification
      if (transaction.order.user.phone) {
        try {
          await whatsappService.sendOrderCompleteNotification(
            transaction.order.user.phone,
            {
              name: transaction.order.user.username,
              orderId: transaction.order.id,
              amount: Number(transaction.amount),
              orderType: transaction.order.orderType, 
              completionDetails: {
                staffName: staffName || 'Admin',
                notes: notes || '',
                completedAt: new Date()
              }
            }
          );
        } catch (notifError) {
          console.error('Failed to send order completion notification:', notifError);
        }
      }
    } else if (status === 'CANCELLED') {
      // Update order status for CANCELLED
      await prisma.order.update({
        where: { id: transaction.order.id },
        data: { status: 'CANCELLED' }
      });
    } else if (status === 'PROCESSING') {
      // Update order status for PROCESSING
      await prisma.order.update({
        where: { id: transaction.order.id },
        data: { status: 'PROCESSING' }
      });
    }
    
    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: updateData
    });
    
    res.status(200).json(updatedTransaction);
  } catch (error) {
    console.error('Transaction status update error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                phone: true
              }
            },
            orderItems: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                      select: { imageUrl: true }
                    }
                  }
                }
              }
            }
          }
        },
        history: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform data untuk kecocokan dengan frontend type
    const transformedTransactions = transactions.map(transaction => {
      // Extract customer name from different sources based on transaction type
      let customerName = transaction.order.user.username;
      
      // For POS/OFFLINE transactions, get customer name from completionDetails
      if (transaction.order.orderType === 'OFFLINE' && transaction.completionDetails) {
        try {
          const details = typeof transaction.completionDetails === 'string' 
            ? JSON.parse(transaction.completionDetails) 
            : transaction.completionDetails;
            
          if (details && details.customerName) {
            customerName = details.customerName;
          }
        } catch (e) {
          console.error('Error parsing completionDetails:', e);
        }
      }

      return {
        id: transaction.id,
        amount: Number(transaction.amount),
        paymentMethod: transaction.paymentMethod,
        status: transaction.status,
        paymentProof: transaction.paymentProof,
        transactionDate: transaction.transactionDate,
        createdAt: transaction.createdAt,
        orderId: transaction.orderId,
        order: {
          id: transaction.order.id,
          orderNumber: transaction.order.orderNumber,
          orderType: transaction.order.orderType || 'ONLINE',
          shippingAddress: transaction.order.deliveryAddress,
          user: {
            id: transaction.order.user.id,
            name: customerName, // Use the extracted customer name
            email: transaction.order.user.email,
            phone: transaction.order.user.phone
          },
          orderItems: transaction.order.orderItems.map(item => ({
            id: item.id,
            weight: Number(item.weight),
            price: Number(item.price),
            product: {
              id: item.product.id,
              name: item.product.name,
              imageUrl: item.product.images[0]?.imageUrl || null
            }
          }))
        },
        shippingDetails: transaction.shippingDetails,
        completionDetails: transaction.completionDetails
      };
    });

    res.status(200).json(transformedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  handlePaymentNotification,
  uploadPaymentProof,
  verifyPayment,
  updateTransactionStatus,
  getAllTransactions,
  updateTransactionStatus
};