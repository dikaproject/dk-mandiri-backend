const prisma = require('../config/database');

const admindash = async (req, res) => {
  try {
    // Get dashboard statistics
    const [
      productCount,
      orderCount,
      userCount,
      recentTransactions,
      monthlySales
    ] = await Promise.all([
      // Count total products
      prisma.product.count(),
      
      // Count total orders
      prisma.order.count(),
      
      // Count total users
      prisma.user.count(),
      
      // Get recent transactions with related data
      prisma.transaction.findMany({
        take: 10,
        orderBy: {
          transactionDate: 'desc'
        },
        include: {
          order: {
            include: {
              user: {
                select: {
                  username: true
                }
              }
            }
          }
        }
      }),
      
      // Get total sales amount for trend calculation
      prisma.$queryRaw`
        SELECT 
          MONTH(transactionDate) as month,
          YEAR(transactionDate) as year,
          SUM(amount) as total
        FROM transactions
        WHERE 
          status = 'SUCCESS' AND
          transactionDate >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
        GROUP BY MONTH(transactionDate), YEAR(transactionDate)
        ORDER BY year DESC, month DESC
      `
    ]);

    // Calculate total sales
    const totalSales = await prisma.transaction.aggregate({
      where: {
        status: 'SUCCESS'
      },
      _sum: {
        amount: true
      }
    });

    // Calculate sales trends (comparing with previous month)
    let salesTrend = {
      value: 0,
      isPositive: true
    };

    if (monthlySales.length >= 2) {
      const currentMonth = parseFloat(monthlySales[0].total);
      const prevMonth = parseFloat(monthlySales[1].total);
      
      if (prevMonth > 0) {
        const percentChange = ((currentMonth - prevMonth) / prevMonth) * 100;
        salesTrend = {
          value: Math.abs(percentChange).toFixed(1),
          isPositive: percentChange >= 0
        };
      }
    }

    // Calculate other trends
    const productTrend = { value: 5, isPositive: true }; // Placeholder - would need historical data
    const orderTrend = { value: 8, isPositive: true };   // Placeholder
    const userTrend = { value: 12, isPositive: true };   // Placeholder
    
    // Format and transform transaction data for the frontend
    const formattedTransactions = recentTransactions.map(t => {
      // Extract customer name from different sources based on transaction type
      let customerName = t.order.user.username;
      
      // For POS/OFFLINE transactions, get customer name from completionDetails
      if (t.order.orderType === 'OFFLINE' && t.completionDetails) {
        try {
          const details = typeof t.completionDetails === 'string' 
            ? JSON.parse(t.completionDetails) 
            : t.completionDetails;
            
          if (details && details.customerName) {
            customerName = details.customerName;
          }
        } catch (e) {
          console.error('Error parsing completionDetails:', e);
        }
      }
      
      return {
        id: t.id,
        orderNumber: t.order.orderNumber,
        date: t.transactionDate,
        customer: customerName, // Use the extracted customer name
        amount: parseFloat(t.amount),
        status: t.status.toLowerCase()
      };
    });

    res.status(200).json({
      stats: {
        products: {
          value: productCount,
          trend: productTrend
        },
        orders: {
          value: orderCount,
          trend: orderTrend
        },
        sales: {
          value: parseFloat(totalSales._sum.amount || 0),
          trend: salesTrend
        },
        users: {
          value: userCount,
          trend: userTrend
        }
      },
      recentTransactions: formattedTransactions
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { admindash };