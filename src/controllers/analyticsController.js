const prisma = require('../config/database');

// Helper function to get date range based on timeframe
const getDateRange = (timeframe) => {
  const endDate = new Date();
  const startDate = new Date();
  
  switch(timeframe) {
    case 'week':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case '3months':
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case '6months':
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case 'year':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    case '2years':
      startDate.setFullYear(endDate.getFullYear() - 2);
      break;
    default:
      startDate.setMonth(endDate.getMonth() - 1); // Default to 1 month
  }
  
  return { startDate, endDate };
};

// Helper function to format date for SQL queries
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Helper to generate period breakdown based on timeframe
const generatePeriods = (startDate, endDate, timeframe) => {
  const periods = [];
  const currentDate = new Date(startDate);
  
  // Format based on timeframe
  const formatPeriodLabel = (date, timeframe) => {
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    
    if (timeframe === 'week') {
      const day = date.getDate();
      return `${day} ${month}`;
    } else if (timeframe === 'month' || timeframe === '3months') {
      return `${month} ${year}`;
    } else {
      return `${month} ${year}`;
    }
  };
  
  // Determine increment based on timeframe
  const getNextDate = (date, timeframe) => {
    const newDate = new Date(date);
    if (timeframe === 'week') {
      newDate.setDate(date.getDate() + 1); // Daily for week
    } else if (timeframe === 'month' || timeframe === '3months') {
      newDate.setDate(date.getDate() + 7); // Weekly for 1-3 months
    } else if (timeframe === '6months') {
      newDate.setDate(1);
      newDate.setMonth(date.getMonth() + 1); // Monthly for 6 months
    } else {
      newDate.setDate(1);
      newDate.setMonth(date.getMonth() + 1); // Monthly for 1-2 years
    }
    return newDate;
  };
  
  while (currentDate <= endDate) {
    periods.push({
      label: formatPeriodLabel(currentDate, timeframe),
      start: new Date(currentDate),
      end: new Date(getNextDate(currentDate, timeframe))
    });
    
    currentDate.setTime(getNextDate(currentDate, timeframe).getTime());
  }
  
  return periods;
};

// Main analytics controller
const getAnalytics = async (req, res) => {
  try {
    const { timeframe = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(timeframe);
    
    // Format dates for SQL queries
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    // Get all data in parallel for efficiency
    const [
      // Total orders in period
      ordersData,
      
      // Order status counts
      orderStatusCounts,
      
      // Cancelled orders count
      cancelledOrders,
      
      // Top products by sales
      topProducts,
      
      // Transaction data with profit calculation
      transactionData,
      
      // Period breakdown for charts
      periodsData
    ] = await Promise.all([
      // Orders in the period
      prisma.order.findMany({
        where: {
          orderDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          transaction: {
            select: {
              amount: true,
              status: true
            }
          },
          orderItems: {
            select: {
              price: true,
              costPrice: true
            }
          }
        }
      }),
      
      // Order status counts
      prisma.order.groupBy({
        by: ['status'],
        where: {
          orderDate: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          id: true
        }
      }),
      
      // Count cancelled orders
      prisma.order.count({
        where: {
          orderDate: {
            gte: startDate,
            lte: endDate
          },
          status: 'CANCELLED'
        }
      }),
      
      // Top products by sales
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            orderDate: {
              gte: startDate,
              lte: endDate
            },
            status: {
              not: 'CANCELLED'
            }
          }
        },
        _sum: {
          price: true,
          costPrice: true,
          weight: true
        },
        _count: {
          id: true
        }
      }),
      
      // Transaction data with orders and items for profit calculation
      prisma.transaction.findMany({
        where: {
          transactionDate: {
            gte: startDate,
            lte: endDate
          },
          status: 'SUCCESS'
        },
        include: {
          order: {
            include: {
              user: {
                select: {
                  username: true
                }
              },
              orderItems: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      costPrice: true
                    }
                  }
                }
              }
            }
          }
        }
      }),
      
      // Get product names for top products
      prisma.product.findMany({
        select: {
          id: true,
          name: true
        }
      })
    ]);
    
    // Calculate summary statistics
    const totalOrders = ordersData.length;
    
    const totalSales = ordersData.reduce((sum, order) => {
      if (order.transaction && order.transaction.status === 'SUCCESS') {
        return sum + parseFloat(order.transaction.amount || 0);
      }
      return sum;
    }, 0);
    
    // Calculate actual profit using order items' costs
    const totalProfit = ordersData.reduce((sum, order) => {
      if (order.transaction && order.transaction.status === 'SUCCESS') {
        // Calculate profit for this order (sum of item prices - sum of item costs)
        const orderProfit = order.orderItems.reduce((itemSum, item) => {
          return itemSum + (parseFloat(item.price) - parseFloat(item.costPrice));
        }, 0);
        return sum + orderProfit;
      }
      return sum;
    }, 0);
    
    // Calculate average order value
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Calculate cancellation rate
    const cancellationRate = totalOrders > 0 
      ? ((cancelledOrders / totalOrders) * 100).toFixed(1) 
      : 0;
    
    // Format order status counts
    const ordersByStatus = orderStatusCounts.map(status => ({
      status: status.status.toLowerCase(),
      count: status._count.id
    }));
    
    // Format top products with names
    const productsMap = periodsData.reduce((map, product) => {
      map[product.id] = product.name;
      return map;
    }, {});
    
    const topProductsFormatted = topProducts
      .map(product => ({
        id: product.productId,
        name: productsMap[product.productId] || 'Unknown Product',
        totalSold: parseFloat(product._sum.weight || 0),
        revenue: parseFloat(product._sum.price || 0),
        cost: parseFloat(product._sum.costPrice || 0),
        profit: parseFloat(product._sum.price || 0) - parseFloat(product._sum.costPrice || 0)
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 products
    
    // Generate periods for breakdown
    const periods = generatePeriods(startDate, endDate, timeframe);
    
    // Calculate transaction data for each period
    const transactionsByTimeframe = periods.map(period => {
      const periodTransactions = transactionData.filter(t => {
        const tDate = new Date(t.transactionDate);
        return tDate >= period.start && tDate < period.end;
      });
      
      const periodOrders = periodTransactions.length;
      const periodSales = periodTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      // Calculate accurate profit for this period
      const periodProfit = periodTransactions.reduce((sum, t) => {
        // Sum up profit from all items in this transaction
        const transactionProfit = t.order.orderItems.reduce((itemSum, item) => {
          return itemSum + (parseFloat(item.price) - parseFloat(item.costPrice));
        }, 0);
        return sum + transactionProfit;
      }, 0);
      
      return {
        period: period.label,
        orders: periodOrders,
        sales: periodSales,
        profit: periodProfit
      };
    });
    
    // Format transaction details
    const transactionDetails = transactionData.map(t => {
      // Calculate accurate profit for this transaction
      const profit = t.order.orderItems.reduce((itemSum, item) => {
        return itemSum + (parseFloat(item.price) - parseFloat(item.costPrice));
      }, 0);
      
      // Check if this is a POS transaction and use the customerName from completionDetails
      let customerName = t.order.user.username;
      if (t.completionDetails && t.completionDetails.customerName) {
        customerName = t.completionDetails.customerName;
      }
      
      return {
        id: t.id,
        orderNumber: t.order.orderNumber,
        date: t.transactionDate,
        customer: customerName, // Use the determined customer name
        amount: parseFloat(t.amount),
        profit: profit,
        status: t.status.toLowerCase()
      };
    });
    
    // Return complete analytics data
    res.status(200).json({
      summary: {
        totalSales,
        totalOrders,
        totalProfit,
        averageOrderValue,
        cancellationRate
      },
      topProducts: topProductsFormatted,
      ordersByStatus,
      transactionsByTimeframe,
      transactionDetails
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAnalytics };