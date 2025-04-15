const { v4: uuidv4 } = require('uuid');

// Helper function to generate a random order number
const generateOrderNumber = () => {
  const timestamp = new Date().getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DKM${timestamp}${random}`;
};

// Helper function to get a random item from an array
const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

// Helper function to get random date in the past (up to maxDays ago)
const getRandomPastDate = (maxDays = 30) => {
  const date = new Date();
  const daysAgo = Math.floor(Math.random() * maxDays);
  date.setDate(date.getDate() - daysAgo);
  return date;
};

async function seedOrders(prisma) {
  // Get all users, excluding admin
  const users = await prisma.user.findMany({
    where: { role: 'USER' }
  });

  // Get all products
  const products = await prisma.product.findMany({
    include: { category: true }
  });

  // Get all addresses
  const addresses = await prisma.address.findMany();

  const shippingMethods = [
    'Pengiriman Reguler',
    'Pengiriman Express',
    'Pengiriman Lokal',
    'Ambil Sendiri'
  ];

  const paymentMethods = [
    'Transfer Bank',
    'COD',
    'E-Wallet',
    'Kartu Kredit'
  ];

  const orderStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  // Create 15 orders with varying statuses and dates
  const numOrders = 15;
  const createdOrders = [];

  for (let i = 0; i < numOrders; i++) {
    const user = getRandomItem(users);
    // Get an address for this user
    const userAddresses = addresses.filter(addr => addr.userId === user.id);
    const address = userAddresses.length > 0
      ? getRandomItem(userAddresses)
      : getRandomItem(addresses); // Fallback to any address
    
    const orderItems = [];
    // Add 1-5 products to each order
    const numProducts = 1 + Math.floor(Math.random() * 5);
    const usedProductIds = new Set();
    
    for (let j = 0; j < numProducts; j++) {
      let product;
      do {
        product = getRandomItem(products);
      } while (usedProductIds.has(product.id));
      
      usedProductIds.add(product.id);
      
      // Random weight between minOrderWeight and 2kg
      const maxWeight = Math.min(2000, product.weightInStock / 2); // Max 2kg or half of stock
      const weight = Math.max(
        Number(product.minOrderWeight),
        Math.round(Math.random() * maxWeight)
      );
      
      const pricePerUnit = Number(product.price);
      const costPerUnit = Number(product.costPrice);
      
      // Total price is price per kg * weight in kg
      const price = (pricePerUnit * weight) / 1000; // Convert from grams to kg for price
      const costPrice = (costPerUnit * weight) / 1000;
      
      orderItems.push({
        weight,
        price,
        costPrice,
        pricePerUnit,
        costPerUnit,
        productId: product.id
      });
    }
    
    // Calculate total amount
    const totalAmount = orderItems.reduce((sum, item) => sum + Number(item.price), 0);
    
    // Random shipping cost between 10000 and 30000
    const shippingCost = 10000 + Math.floor(Math.random() * 20000);
    
    // Order created date (random date in the past 30 days)
    const orderDate = getRandomPastDate(30);
    
    // Random status - weighted to have more completed orders
    const status = i < 10 
      ? getRandomItem(['DELIVERED', 'SHIPPED', 'PROCESSING']) 
      : getRandomItem(orderStatuses);
    
    // Generate order data
    const orderData = {
      orderNumber: generateOrderNumber(),
      orderDate,
      totalAmount: totalAmount + shippingCost,
      shippingCost,
      status,
      deliveryAddress: `${address.fullAddress}, ${address.district}, ${address.city}, ${address.province} ${address.postalCode}`,
      shippingMethod: getRandomItem(shippingMethods),
      userId: user.id,
      orderType: Math.random() > 0.2 ? 'ONLINE' : 'OFFLINE', // 80% online orders
      createdAt: orderDate,
      updatedAt: new Date()
    };
    
    // Create the order
    const order = await prisma.order.create({
      data: {
        ...orderData,
        orderItems: {
          create: orderItems
        }
      }
    });
    
    createdOrders.push(order);
    console.log(`Created order: ${order.orderNumber}`);
    
    // Create transaction for non-pending orders
    if (status !== 'PENDING' && status !== 'CANCELLED') {
      const transactionStatus = status === 'PROCESSING' 
        ? 'PENDING' 
        : 'SUCCESS';
      
      const transactionDate = new Date(orderDate);
      transactionDate.setHours(orderDate.getHours() + 2); // Transaction 2 hours after order
      
      const paymentMethod = getRandomItem(paymentMethods);
      const serviceFee = Math.round(totalAmount * 0.02); // 2% service fee
      
      const transaction = await prisma.transaction.create({
        data: {
          transactionDate,
          amount: totalAmount + shippingCost,
          serviceFee,
          paymentMethod,
          status: transactionStatus,
          paymentProof: paymentMethod === 'Transfer Bank' ? 'payment-proof.jpg' : null,
          completionDetails: status === 'DELIVERED' ? { deliveredAt: new Date() } : null,
          orderId: order.id
        }
      });
      
      console.log(`Created transaction for order: ${order.orderNumber}`);
      
      // Create shipping record for shipped/delivered orders
      if (status === 'SHIPPED' || status === 'DELIVERED') {
        const deliveryDate = new Date(transactionDate);
        deliveryDate.setDate(deliveryDate.getDate() + 1); // Delivery scheduled for next day
        
        const shipping = await prisma.shipping.create({
          data: {
            deliveryDate,
            deliveryStatus: status === 'DELIVERED' ? 'DELIVERED' : 'IN_DELIVERY',
            staffName: 'Kurniawan Delivery',
            notes: 'Hubungi pelanggan sebelum pengiriman',
            recipientName: status === 'DELIVERED' ? address.recipientName : null,
            orderId: order.id
          }
        });
        
        console.log(`Created shipping for order: ${order.orderNumber}`);
      }
    }
  }

  return createdOrders;
}

module.exports = {
  seedOrders
};