const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const whatsappService = require('../services/whatsappService');

const createPOSTransaction = async (req, res) => {
  const {
    orderNumber,
    customerName,
    customerPhone,
    deliveryAddress,
    paymentMethod,
    totalAmount,
    orderItems,
    shippingMethod,
    staffName,
    isPOS = true
  } = req.body;

  try {
    // Create unique IDs
    const orderId = uuidv4();
    const transactionId = uuidv4();

    // Check if customer exists as user
    let userId = null;
    if (customerPhone) {
      const user = await prisma.user.findFirst({
        where: { phone: customerPhone }
      });
      
      userId = user?.id;
    }
    
    // Jika tidak ditemukan user, gunakan admin user dari request
    if (!userId && !req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat membuat transaksi: User ID tidak ditemukan'
      });
    }

    // Create order with type OFFLINE
    const order = await prisma.order.create({
      data: {
        id: orderId,
        orderNumber,
        totalAmount: parseFloat(totalAmount),
        status: 'DELIVERED', // POS transactions are completed immediately
        deliveryAddress: deliveryAddress || 'In-store purchase',
        shippingMethod: shippingMethod || 'pickup',
        orderType: 'OFFLINE',
        userId: userId || req.user.id, // Perbaikan disini - gunakan req.user.id bukan req.userId
        orderItems: {
          create: orderItems.map(item => ({
            weight: parseFloat(item.weight),
            price: parseFloat(item.weight / 1000 * item.pricePerUnit),
            pricePerUnit: parseFloat(item.pricePerUnit),
            costPrice: parseFloat(item.weight / 1000 * item.costPerUnit),
            costPerUnit: parseFloat(item.costPerUnit),
            productId: item.productId
          }))
        }
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        user: true
      }
    });

    // Create transaction with enhanced completion details
    const transaction = await prisma.transaction.create({
      data: {
        id: transactionId,
        amount: parseFloat(totalAmount),
        paymentMethod,
        status: 'SUCCESS',
        orderId,
        completionDetails: {
          completedBy: staffName,
          completedAt: new Date(),
          notes: 'POS Transaction',
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || null  // Store the phone number
        }
      },
      include: {
        order: {
          include: {
            orderItems: {
              include: {
                product: true
              }
            },
            user: true
          }
        }
      }
    });

    for (const item of order.orderItems) {
      await prisma.transactionHistory.create({
        data: {
          productName: item.product.name,
          categoryName: item.product.category?.name || 'Uncategorized',
          price: parseFloat(item.pricePerUnit),
          totalPrice: parseFloat(item.price),
          quantity: Math.round(parseFloat(item.weight) / 1000 * 100) / 100, // Convert to kg with 2 decimal places
          transactionId: transactionId
        }
      });
    }

    // Update product inventory
    for (const item of orderItems) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          weightInStock: {
            decrement: parseFloat(item.weight)
          }
        }
      });
    }

    // Send WhatsApp notification if customer phone provided
    if (customerPhone) {
      try {
        await whatsappService.sendOrderCompleteNotification(
          customerPhone,
          {
            name: customerName || 'Valued Customer',
            orderId: orderId,
            orderType: 'OFFLINE',
            amount: parseFloat(totalAmount),
            completionDetails: {
              staffName,
              completedAt: new Date(),
              notes: 'POS Transaction'
            }
          }
        );
      } catch (notifError) {
        console.error('WhatsApp notification failed:', notifError);
        // Don't fail the transaction if notification fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Transaction processed successfully',
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        paymentMethod: transaction.paymentMethod,
        status: transaction.status,
        orderNumber: order.orderNumber,
        orderItems: order.orderItems
      }
    });

  } catch (error) {
    console.error('POS Transaction error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const PosAdmin = (req, res) => {
  res.json({ message: 'POS Admin Route' });
};

const sendPOSReceipt = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    // Get transaction details
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        order: {
          include: {
            orderItems: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Get customer phone and name from completionDetails
    let customerPhone = null;
    let customerName = 'Valued Customer';
    
    if (transaction.completionDetails) {
      const details = typeof transaction.completionDetails === 'string'
        ? JSON.parse(transaction.completionDetails)
        : transaction.completionDetails;
        
      customerPhone = details.customerPhone;
      customerName = details.customerName || customerName;
    }
    
    if (!customerPhone) {
      return res.status(400).json({ message: 'Customer phone number not found' });
    }
    
    // Format items for receipt
    const items = transaction.order.orderItems.map(item => ({
      name: item.product.name,
      quantity: `${Number(item.weight) / 1000} kg`,
      price: Number(item.price)
    }));
    
    // Send WhatsApp receipt
    const result = await whatsappService.sendPOSReceipt(
      customerPhone,
      {
        customerName,
        orderNumber: transaction.order.orderNumber,
        date: new Date(transaction.transactionDate).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        items,
        totalAmount: Number(transaction.amount),
        paymentMethod: transaction.paymentMethod,
        staffName: transaction.completionDetails.completedBy || 'Staff'
      }
    );
    
    if (!result.success) {
      return res.status(500).json({ message: 'Failed to send receipt: ' + (result.error || 'Unknown error') });
    }
    
    res.status(200).json({ message: 'Receipt sent successfully' });
    
  } catch (error) {
    console.error('Error sending POS receipt:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  PosAdmin,
  createPOSTransaction,
  sendPOSReceipt
};