const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const { createSnapApi } = require('../config/midtrans');
const whatsappService = require('../services/whatsappService');

// Perbarui fungsi createOrder untuk menggunakan data dari address
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shippingMethod, deliveryAddressId, paymentMethod, shippingCost } = req.body;
    
    console.log('Creating order with:', { shippingMethod, deliveryAddressId, paymentMethod, shippingCost });

    // Get user cart items
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            costPrice: true,
            category: true
          }
        }
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Get user address if delivery is selected
    let address = null;
    if (shippingMethod !== 'pickup' && deliveryAddressId) {
      address = await prisma.address.findUnique({
        where: { id: deliveryAddressId },
      });

      if (!address) {
        return res.status(404).json({ message: 'Delivery address not found' });
      }
    }

    // Get user information
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate total amount - price is per kg, convert grams to kg
    const totalAmount = cartItems.reduce(
      (total, item) => total + (parseFloat(item.weight) / 1000 * parseFloat(item.product.price)),
      0
    );

    // Add service fee for online payments only
    let serviceFee = 0;
    if (paymentMethod === 'midtrans') {
      serviceFee = totalAmount * 0.035; // 3.5% service fee
    }
    
    const finalAmount = totalAmount + serviceFee + (parseFloat(shippingCost) || 0);

    // Format complete address
    let fullAddress = '';
    let recipientName = user.username;
    let recipientPhone = user.phone || '';

    if (address) {
      fullAddress = `${address.fullAddress}, ${address.district}, ${address.city}, ${address.province}, ${address.postalCode}`;
      recipientName = address.recipientName || user.username;
      recipientPhone = address.phone || user.phone || '';
    } else if (shippingMethod === 'pickup') {
      fullAddress = 'Pickup at Store';
    }

    // Create order with prisma transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Create order
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const orderType = shippingMethod === 'pickup' ? 'OFFLINE' : 'ONLINE';
      
      const order = await prisma.order.create({
        data: {
          orderNumber,
          totalAmount: finalAmount,
          status: 'PENDING',
          deliveryAddress: fullAddress,
          shippingMethod,
          shippingCost: parseFloat(shippingCost) || 0,
          userId,
          orderType,
          orderItems: {
            create: cartItems.map(item => ({
              weight: item.weight,
              price: parseFloat(item.weight) / 1000 * parseFloat(item.product.price),
              costPrice: parseFloat(item.weight) / 1000 * parseFloat(item.product.costPrice), // Tambahan ini
              pricePerUnit: item.product.price,
              costPerUnit: item.product.costPrice, // Tambahan ini
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

      // Update product weight in stock
      for (const item of cartItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            weightInStock: {
              decrement: parseFloat(item.weight)
            }
          }
        });
      }

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          amount: finalAmount,
          paymentMethod: paymentMethod || 'pending',
          status: 'PENDING',
          orderId: order.id,
          serviceFee: serviceFee
        }
      });

      // Create transaction history records
      await Promise.all(cartItems.map(item => 
        prisma.transactionHistory.create({
          data: {
            productName: item.product.name,
            categoryName: item.product.category?.name || 'Uncategorized',
            price: item.product.price,
            totalPrice: parseFloat(item.weight) / 1000 * parseFloat(item.product.price),
            quantity: parseFloat(item.weight),
            transactionId: transaction.id
          }
        })
      ));

      // Clear cart after order is created
      await prisma.cartItem.deleteMany({
        where: { userId }
      });

      let snapToken = null;
      
      // Only create Midtrans token if payment method is midtrans
      if (paymentMethod === 'midtrans') {
        try {
          // Format item prices to avoid decimal values for IDR
          const midtransItems = [];
          
          // Loop through cart items
          for (const item of cartItems) {
            const itemPrice = Math.round((parseFloat(item.weight) / 1000) * parseFloat(item.product.price));
            
            midtransItems.push({
              id: item.productId,
              price: itemPrice, // Rounded price
              quantity: 1, // Quantity always 1, price already reflects total
              name: `${item.product.name} (${item.weight}g)`.substring(0, 50)
            });
          }

          // Add service fee as separate item if applicable
          if (serviceFee > 0) {
            const roundedServiceFee = Math.round(serviceFee);
            midtransItems.push({
              id: 'service-fee',
              price: roundedServiceFee,
              quantity: 1,
              name: 'Biaya Layanan (3.5%)'
            });
          }

          // Calculate gross amount from rounded items
          const grossAmount = midtransItems.reduce((total, item) => total + (item.price * item.quantity), 0);

          const snap = createSnapApi();
          const parameter = {
            transaction_details: {
              order_id: orderNumber,
              gross_amount: grossAmount
            },
            item_details: midtransItems,
            customer_details: {
              first_name: recipientName,
              email: user.email,
              phone: recipientPhone || '-',
              billing_address: {
                first_name: recipientName,
                address: fullAddress
              },
              shipping_address: {
                first_name: recipientName,
                address: fullAddress
              }
            },
            callbacks: {
              finish: `${process.env.FRONTEND_URL}/order/${order.id}?status=success`,
              error: `${process.env.FRONTEND_URL}/order/${order.id}?status=error`,
              pending: `${process.env.FRONTEND_URL}/order/${order.id}?status=pending`
            }
          };

          snapToken = await snap.createTransactionToken(parameter);
          console.log("Midtrans token generated successfully");
        } catch (error) {
          console.error("Error generating Midtrans token:", error);
          // Continue even if token generation fails, just log the error
        }
      }

      // Send WhatsApp notification
      if (user.phone) {
        try {
          await whatsappService.sendOrderConfirmation(user.phone, {
            customerName: user.username,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            totalAmount: Number(order.totalAmount),
            orderType: order.orderType // Tambahkan orderType ke objek
          });
        } catch (error) {
          console.error('Failed to send WhatsApp notification:', error);
          // Tidak perlu gagalkan proses jika notifikasi gagal
        }
      }

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          orderDate: order.orderDate
        },
        snapToken: snapToken
      };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all orders for a user
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const whereClause = { userId };
    if (status) {
      whereClause.status = status;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: {
        orderDate: 'desc'
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        transaction: {
          select: {
            status: true,
            paymentMethod: true,
            serviceFee: true
          }
        }
      }
    });

    // Dapatkan semua product IDs untuk mendapatkan gambar
    const productIds = [];
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        productIds.push(item.productId);
      });
    });

    // Ambil semua gambar primer dalam satu query
    const productImages = await prisma.productImage.findMany({
      where: {
        productId: { in: productIds },
        isPrimary: true
      },
      select: {
        productId: true,
        imageUrl: true
      }
    });

    // Buat map untuk mempermudah akses
    const imageMap = {};
    productImages.forEach(img => {
      imageMap[img.productId] = img.imageUrl;
    });

    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.transaction?.status || 'PENDING',
      paymentMethod: order.transaction?.paymentMethod || 'Not Set',
      items: order.orderItems.map(item => ({
        id: item.id,
        productName: item.product.name,
        weight: item.weight,
        pricePerUnit: item.pricePerUnit,
        totalPrice: item.price,
        imageUrl: imageMap[item.productId] || null // Gunakan dari imageMap
      })),
      itemCount: order.orderItems.length
    }));

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true // Ubah untuk mengambil semua data product, tidak hanya field tertentu
          }
        },
        transaction: true,
        user: {
          select: {
            username: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order belongs to user or user is admin
    if (order.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    const productIds = order.orderItems.map(item => item.productId);
    const productImages = await prisma.productImage.findMany({
      where: {
        productId: {
          in: productIds
        },
        isPrimary: true
      },
      select: {
        productId: true,
        imageUrl: true
      }
    });

    // Buat map untuk mempermudah akses
    const imageMap = {};
    productImages.forEach(img => {
      imageMap[img.productId] = img.imageUrl;
    });

    const formattedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      totalAmount: order.totalAmount,
      status: order.status,
      deliveryAddress: order.deliveryAddress,
      shippingMethod: order.shippingMethod,
      customer: {
        name: order.user.username,
        email: order.user.email,
        phone: order.user.phone
      },
      items: order.orderItems.map(item => ({
        id: item.id,
        productName: item.product.name,
        weight: item.weight,
        pricePerUnit: item.pricePerUnit,
        totalPrice: item.price,
        imageUrl: imageMap[item.productId] || null 
      })),
      payment: order.transaction ? {
        id: order.transaction.id,
        status: order.transaction.status,
        method: order.transaction.paymentMethod,
        date: order.transaction.transactionDate,
        proofImage: order.transaction.paymentProof
      } : null,
      subtotal: parseFloat(order.totalAmount) - (order.transaction?.serviceFee || 0) - (order.shippingCost || 0),
      shippingCost: parseFloat(order.shippingCost) || 0,
      serviceCharge: order.transaction?.serviceFee || 0
    };

    res.status(200).json(formattedOrder);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update order status (Admin only)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, staffName, notes } = req.body;

    if (!['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        shipping: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update order with prisma transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Update order status
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: { status }
      });

      // If status is SHIPPED and we have staff info, create shipping record
      if (status === 'SHIPPED') {
        let shipping;
        const deliveryStatus = 'IN_DELIVERY';
        
        if (order.shipping) {
          shipping = await prisma.shipping.update({
            where: { orderId: id },
            data: {
              deliveryStatus,
              staffName: staffName || order.shipping.staffName,
              notes: notes || order.shipping.notes,
              updatedAt: new Date()
            }
          });
        } else {
          shipping = await prisma.shipping.create({
            data: {
              deliveryDate: new Date(),
              deliveryStatus,
              staffName,
              notes,
              orderId: id
            }
          });
        }

        // Send WhatsApp notification
        if (order.user.phone) {
          try {
            await whatsappService.sendShippingNotification(
              order.user.phone,
              {
                customerName: order.user.username,
                orderNumber: order.orderNumber,
                deliveryDate: shipping.deliveryDate,
                deliveryStatus,
                staffName: shipping.staffName,
                notes: shipping.notes
              }
            );
          } catch (error) {
            console.error('Failed to send WhatsApp notification:', error);
            // Send failure notification to admin
            await whatsappService.sendMessage(
              '6281227848422',
              `Failed to send shipping notification to customer for order ${order.orderNumber}. Error: ${error.message}`
            );
          }
        }

        return { ...updatedOrder, shipping };
      } else if (status === 'DELIVERED' && order.shipping) {
        // Update shipping status when order is delivered
        const shipping = await prisma.shipping.update({
          where: { orderId: id },
          data: { 
            deliveryStatus: 'DELIVERED',
            recipientName: req.body.recipientName || null,
            updatedAt: new Date()
          }
        });
        
        return { ...updatedOrder, shipping };
      }

      return updatedOrder;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateShipping = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryStatus, staffName, notes, recipientName, deliveryDate } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        shipping: true,
        user: true 
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let shipping;
    if (order.shipping) {
      shipping = await prisma.shipping.update({
        where: { orderId },
        data: {
          deliveryStatus: deliveryStatus || order.shipping.deliveryStatus,
          staffName: staffName || order.shipping.staffName,
          notes: notes !== undefined ? notes : order.shipping.notes,
          recipientName: recipientName || order.shipping.recipientName,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : order.shipping.deliveryDate,
          updatedAt: new Date()
        }
      });
    } else {
      shipping = await prisma.shipping.create({
        data: {
          deliveryStatus: deliveryStatus || 'PENDING',
          staffName,
          notes,
          recipientName,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          orderId
        }
      });

      // If this is a new shipping record, also update order status
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'SHIPPED' }
      });
    }

    // Notify customer via WhatsApp if status changed to IN_DELIVERY
    if ((deliveryStatus === 'IN_DELIVERY' || order.status === 'SHIPPED') && order.user.phone) {
      try {
        await whatsappService.sendShippingNotification(
          order.user.phone,
          {
            customerName: order.user.username,
            orderNumber: order.orderNumber,
            deliveryDate: shipping.deliveryDate,
            deliveryStatus: shipping.deliveryStatus,
            staffName: shipping.staffName,
            notes: shipping.notes
          }
        );
      } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
        await whatsappService.sendMessage(
          '6281227848422',
          `Failed to send shipping notification to customer for order ${order.orderNumber}. Error: ${error.message}`
        );
      }
    }

    res.status(200).json(shipping);
  } catch (error) {
    console.error('Error updating shipping:', error);
    res.status(500).json({ message: error.message });
  }
};

// Add new endpoint to get shipping details
const getShippingDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const shipping = await prisma.shipping.findUnique({
      where: { orderId }
    });

    if (!shipping) {
      return res.status(404).json({ message: 'Shipping information not found' });
    }

    res.status(200).json(shipping);
  } catch (error) {
    console.error('Error getting shipping details:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderDetails,
  updateOrderStatus,
  updateShipping,
  getShippingDetails
};