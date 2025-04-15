const prisma = require('../config/database');
const whatsappService = require('../services/whatsappService');
const router = require('express').Router();
const multer = require('multer');
const { 
  handlePaymentNotification, 
  uploadPaymentProof, 
  verifyPayment,
  updateTransactionStatus,
  getAllTransactions,
} = require('../controllers/TransactionController');
const { auth, adminOnly } = require('../middleware/auth');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
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
            },
            shipping: true
          }
        }
      }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Format response similar to getAllTransactions
    const formattedTransaction = {
      id: transaction.id,
      amount: Number(transaction.amount),
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      paymentProof: transaction.paymentProof,
      transactionDate: transaction.transactionDate,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      serviceFee: transaction.serviceFee ? Number(transaction.serviceFee) : 0,
      orderId: transaction.orderId,
      completionDetails: transaction.completionDetails,
      order: {
        id: transaction.order.id,
        orderNumber: transaction.order.orderNumber,
        status: transaction.order.status,
        orderType: transaction.order.orderType,
        shippingCost: Number(transaction.order.shippingCost),
        deliveryAddress: transaction.order.deliveryAddress,
        shippingMethod: transaction.order.shippingMethod,
        user: {
          id: transaction.order.user.id,
          name: transaction.order.user.username,
          email: transaction.order.user.email,
          phone: transaction.order.user.phone
        },
        orderItems: transaction.order.orderItems.map(item => ({
          id: item.id,
          weight: Number(item.weight),
          price: Number(item.price),
          pricePerUnit: Number(item.pricePerUnit),
          product: {
            id: item.product.id,
            name: item.product.name,
            imageUrl: item.product.images[0]?.imageUrl || null
          }
        }))
      }
    };
    
    res.status(200).json(formattedTransaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/update-order', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, staffName, notes } = req.body;
    
    // Validasi data
    if (!orderStatus) {
      return res.status(400).json({ message: 'Order status is required' });
    }
    
    // Cari transaction berdasarkan ID
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { order: true }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: transaction.orderId },
      data: { 
        status: orderStatus,
        // Jika status DELIVERED, tambahkan completion details
        ...(orderStatus === 'DELIVERED' && {
          shipping: {
            upsert: {
              create: {
                deliveryStatus: 'DELIVERED',
                staffName: staffName || req.user.username,
                notes: notes || 'Order completed',
                deliveryDate: new Date()
              },
              update: {
                deliveryStatus: 'DELIVERED',
                staffName: staffName || req.user.username,
                notes: notes || 'Order completed',
                deliveryDate: new Date()
              }
            }
          }
        })
      }
    });
    
    // Jika perlu, update juga transaction completionDetails
    if (orderStatus === 'DELIVERED') {
      await prisma.transaction.update({
        where: { id },
        data: {
          completionDetails: {
            completedBy: staffName || req.user.username,
            completedAt: new Date(),
            notes: notes || 'Order completed'
          }
        }
      });
    }
    
    res.status(200).json({ 
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/validate-receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token not provided' });
    }
    
    // Cari token di database
    const receiptToken = await prisma.receiptToken.findFirst({
      where: {
        token: token,
        transactionId: id,
        expiresAt: {
          gt: new Date() // Pastikan token belum expired
        }
      },
      include: {
        transaction: {
          include: {
            order: {
              include: {
                user: {
                  select: {
                    username: true,
                    email: true,
                    phone: true
                  }
                },
                orderItems: {
                  include: {
                    product: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!receiptToken) {
      return res.status(200).json({ valid: false });
    }
    
    // Format data untuk frontend
    const transaction = {
      id: receiptToken.transaction.id,
      date: receiptToken.transaction.transactionDate,
      amount: Number(receiptToken.transaction.amount),
      status: receiptToken.transaction.status,
      paymentMethod: receiptToken.transaction.paymentMethod,
      timestamp: receiptToken.transaction.updatedAt.getTime(),
      pdfFilename: receiptToken.filename, // Tambahkan filename di sini
      orderDetails: {
        orderNumber: receiptToken.transaction.order.orderNumber,
        customerName: receiptToken.transaction.order.user.username,
        items: receiptToken.transaction.order.orderItems.map(item => ({
          name: item.product.name,
          quantity: Number(item.weight),
          price: Number(item.pricePerUnit),
          total: Number(item.price)
        }))
      }
    };
    
    res.status(200).json({ valid: true, transaction });
  } catch (error) {
    console.error('Error validating receipt token:', error);
    res.status(500).json({ valid: false, message: error.message });
  }
});

// Midtrans webhook - no auth required
router.post('/notification', handlePaymentNotification);

// User endpoints
router.use(auth);
router.post('/:transactionId/proof', upload.single('paymentProof'), uploadPaymentProof);

// Admin endpoints
router.put('/:transactionId/verify', auth, adminOnly, verifyPayment);
router.get('/', auth, adminOnly, getAllTransactions);

router.put('/:id/status', updateTransactionStatus);

router.get('/:id/receipt', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: true,
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
    
    // Untuk akses publik (memungkinkan download dari WA)
    // Generate unique secret token untuk URL
    const secretToken = crypto.randomBytes(16).toString('hex');
    
    // Simpan token dengan expiry date (24 jam)
    await prisma.receiptToken.create({
      data: {
        token: secretToken,
        transactionId: id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 jam
      }
    });
    
    const receiptUrl = `${process.env.FRONTEND_URL}/receipt/${id}?token=${secretToken}`;
    
    res.status(200).json({ 
      message: 'Receipt generated',
      receiptUrl 
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ message: 'Failed to generate receipt' });
  }
});

const generatePDF = async (transaction) => {
  const uploadsDir = path.join(__dirname, '../../uploads/receipts');
  await fs.ensureDir(uploadsDir);
  
  const filename = `receipt-${transaction.id.slice(0, 8)}-${Date.now()}.pdf`;
  const filePath = path.join(uploadsDir, filename);
  const publicPath = `/uploads/receipts/${filename}`;
  
  // Format tanggal dengan baik
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  let orderNumberClean = transaction.order.orderNumber;
  if (orderNumberClean.includes('-')) {
    const parts = orderNumberClean.split('-');
    orderNumberClean = parts[parts.length - 1];
  }
  
  const invoiceNumber = `INV/${orderNumberClean}/${new Date(transaction.createdAt).getFullYear()}`;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        bufferPages: true 
      });
      
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);
      
      // ===== HEADER SECTION =====
      // Informasi perusahaan di kiri
      doc.font('Helvetica-Bold').fontSize(22).text('DK MANDIRI', 50, 50);
      doc.font('Helvetica').fontSize(10);
      doc.text('Toko Ikan Segar Di Nusawungu', 50, 75);
      doc.text('Jl. Suryanegara, Mertangga, Jetis, No 004', 50, 90);
      doc.text('Jawa Tengah, Indonesia 53283', 50, 105);
      doc.text('Telp: 6281226795993 / WA: 0812-2679-5993', 50, 120);
      doc.text('Email: info@dkmandiri.id', 50, 135);
      
      // Informasi invoice di kanan
      doc.font('Helvetica-Bold').fontSize(16).text('INVOICE', 450, 50, { align: 'right' });
      doc.font('Helvetica').fontSize(10);
      doc.text(`No. Invoice:`, 450, 75, { align: 'right' });
      doc.text(`${invoiceNumber}`, 450, 90, { align: 'right' });
      doc.text(`Tanggal:`, 450, 105, { align: 'right' });
      doc.text(`${formatDate(transaction.createdAt)}`, 450, 120, { align: 'right' });
      doc.text(`Status: ${transaction.status === 'SUCCESS' ? 'LUNAS' : transaction.status}`, 450, 135, { align: 'right' });
      
      doc.moveTo(50, 160).lineTo(550, 160).lineWidth(1).stroke('#0284c7');
      
      const middlePoint = 300;
      
      // Kolom kiri - informasi pelanggan
      doc.font('Helvetica-Bold').fontSize(12).text('INFORMASI PELANGGAN', 50, 180);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Nama: ${transaction.order.user.username}`, 50, 200);
      
      // Mengoptimalkan penggunaan ruang
      let customerY = 215; // Start Y position
      
      if (transaction.order.user.phone) {
        doc.text(`Telepon: ${transaction.order.user.phone}`, 50, customerY);
        customerY += 15;
      }
      
      if (transaction.order.user.email) {
        doc.text(`Email: ${transaction.order.user.email}`, 50, customerY);
        customerY += 15;
      }
      
      // Alamat pengiriman jika ada (dengan kontrol ukuran lebih baik)
      if (transaction.order.deliveryAddress) {
        doc.font('Helvetica-Bold').text('Alamat Pengiriman:', 50, customerY);
        customerY += 15;
        doc.font('Helvetica');
        
        // Batasi panjang alamat dan jumlah baris untuk menghemat ruang
        const addressLines = transaction.order.deliveryAddress.match(/.{1,40}(\s|$)/g) || [];
        addressLines.slice(0, 3).forEach(line => { // Batasi maksimum 3 baris
          doc.text(line.trim(), 50, customerY);
          customerY += 15;
        });
      }
      
      // Kolom kanan - informasi transaksi
      doc.font('Helvetica-Bold').fontSize(12).text('INFORMASI TRANSAKSI', middlePoint, 180);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Order ID: #${transaction.order.orderNumber}`, middlePoint, 200);
      doc.text(`Metode Pembayaran: ${transaction.paymentMethod}`, middlePoint, 215);
      doc.text(`Metode Pengiriman: ${transaction.order.shippingMethod || 'Standard'}`, middlePoint, 230);
      
      // ===== TABEL PRODUK =====
      // Hitung posisi Y yang tepat untuk tabel berdasarkan konten pelanggan sebelumnya
      const tableTop = Math.max(customerY + 10, 280);
      doc.font('Helvetica-Bold').fontSize(11);
      
      // Header dengan background
      doc.rect(50, tableTop, 500, 25).fill('#f0f9ff');
      doc.fillColor('#000000');
      doc.text('Produk', 60, tableTop + 8);
      doc.text('Berat', 300, tableTop + 8, { width: 50, align: 'right' });
      doc.text('Harga/kg', 370, tableTop + 8, { width: 80, align: 'right' });
      doc.text('Total', 470, tableTop + 8, { width: 70, align: 'right' });
      
      // Items dengan kontrol ukuran lebih baik
      let y = tableTop + 30;
      let currentPage = 1;
      const itemsPerPage = 15; // Jumlah item maksimal per halaman
      let itemsOnCurrentPage = 0;
      
      // Hitung tinggi total yang dibutuhkan untuk menampilkan semua items
      const items = transaction.order.orderItems;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        itemsOnCurrentPage++;
        
        // Cek jika mendekati batas bawah halaman
        if (y > 700 && i < items.length - 1) {
          // Jika halaman sudah hampir penuh, dan masih ada item lagi, tambahkan halaman baru
          y = 50; // Reset Y ke posisi awal di halaman baru
          itemsOnCurrentPage = 0;
          continue;
        }
        
        // Striped rows (alternate row colors)
        if (i % 2 === 0) {
          doc.rect(50, y - 5, 500, 25).fill('#f9fafb');
          doc.fillColor('#000000');
        }
        
        doc.font('Helvetica').fontSize(10);
        
        // Wrap long product names with better spacing control
        const maxWidth = 230;
        const productName = item.product.name;
        const truncatedName = productName.length > 30 ? 
          productName.substring(0, 28) + '...' : productName;
        
        doc.text(truncatedName, 60, y);
        doc.text(`${(Number(item.weight) / 1000).toFixed(2)} kg`, 300, y, { width: 50, align: 'right' });
        doc.text(formatToIDR(item.pricePerUnit), 370, y, { width: 80, align: 'right' });
        doc.text(formatToIDR(item.price), 470, y, { width: 70, align: 'right' });
        
        y += 25; // Fixed height untuk setiap baris, untuk konsistensi
      }
      
      // Jika posisi Y terlalu rendah, kita perlu pindah ke halaman berikutnya untuk summary
      if (y > 650) {
        y = 50;
      }
      
      // Summary section with light background
      const summaryY = y + 15;
      doc.rect(300, summaryY, 250, 100).fill('#f9fafb');
      doc.fillColor('#000000');
      
      // Draw borders
      doc.lineWidth(0.5).rect(300, summaryY, 250, 100).stroke('#e5e7eb');
      
      doc.font('Helvetica').fontSize(10);
      let currentY = summaryY + 15;
      
      // Subtotal
      doc.text('Subtotal', 320, currentY);
      doc.text(formatToIDR(Number(transaction.amount) - Number(transaction.serviceFee || 0) - Number(transaction.order.shippingCost || 0)), 470, currentY, { width: 70, align: 'right' });
      
      // Shipping cost
      currentY += 20;
      doc.text('Biaya Pengiriman', 320, currentY);
      doc.text(formatToIDR(transaction.order.shippingCost || 0), 470, currentY, { width: 70, align: 'right' });
      
      // Service fee if exists
      if (transaction.serviceFee && Number(transaction.serviceFee) > 0) {
        currentY += 20;
        doc.text('Biaya Layanan', 320, currentY);
        doc.text(formatToIDR(transaction.serviceFee), 470, currentY, { width: 70, align: 'right' });
      }
      
      // Total with bold font
      currentY += 25;
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('TOTAL', 320, currentY);
      doc.text(formatToIDR(transaction.amount), 470, currentY, { width: 70, align: 'right' });
      
      // ===== METODE PEMBAYARAN =====
      const paymentY = summaryY + 120;
      if (transaction.status !== 'SUCCESS') {
        doc.font('Helvetica-Bold').fontSize(11).text('METODE PEMBAYARAN', 50, paymentY);
        doc.font('Helvetica').fontSize(10);
        
        // Informasi rekening toko
        doc.text('Silakan transfer ke salah satu rekening berikut:', 50, paymentY + 20);
        
        // Bank Mandiri
        doc.text('BANK MANDIRI', 50, paymentY + 55);
        doc.text('No. Rekening: 0987654321', 150, paymentY + 55);
        doc.text('Atas Nama: Saryo', 300, paymentY + 55);
        
        // QRIS
        doc.text('QRIS', 50, paymentY + 70);
        doc.text('Scan kode QRIS di toko atau minta ke admin', 150, paymentY + 70);
      }
      
      // ===== CATATAN & FOOTER =====
      const noteY = Math.min(paymentY + 100, 750);
      doc.font('Helvetica-Bold').fontSize(10).text('Catatan:', 50, noteY);
      doc.font('Helvetica').fontSize(9);
      doc.text('1. Invoice ini merupakan bukti pembayaran yang sah.', 50, noteY + 15);
      doc.text('2. Produk yang sudah dibeli tidak dapat ditukar atau dikembalikan.', 50, noteY + 30);
      doc.text('3. Silakan hubungi kami jika ada pertanyaan mengenai pesanan Anda.', 50, noteY + 45);
      
      // Footer
      doc.font('Helvetica').fontSize(9);
      const footerY = doc.page.height - 50;
      doc.text('DK MANDIRI © 2024 - Semua hak dilindungi undang-undang.', 50, footerY, { align: 'center' });
      doc.text('Hubungi kami: 0852-9988-7766 | info@dk-mandiri.com', 50, footerY + 15, { align: 'center' });
      
      // Finishing border
      doc.rect(50, doc.page.height - 70, 500, 2).fill('#0284c7');
      
      // Hapus halaman kosong yang tidak perlu
      const range = doc.bufferedPageRange();
      // Jika hanya ada satu halaman maka kita tidak perlu melakukan apa-apa
      
      doc.end();
      
      writeStream.on('finish', () => {
        resolve({ path: filePath, publicPath });
      });
    } catch (error) {
      reject(error);
    }
  });
  
  function formatToIDR(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }
};

router.get('/:id/generate-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    
    // Validasi token
    const validToken = await prisma.receiptToken.findFirst({
      where: {
        token,
        transactionId: id,
        expiresAt: {
          gt: new Date()
        }
      }
    });
    
    if (!validToken) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: true,
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
    
    // Generate PDF receipt
    const { publicPath } = await generatePDF(transaction);
    
    // Redirect to PDF
    res.redirect(`/uploads/receipts/${path.basename(publicPath)}`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: error.message });
  }
});

// Send receipt via WhatsApp
router.post('/:id/send-receipt', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: true,
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
    
    if (!transaction.order.user.phone) {
      return res.status(400).json({ message: 'User does not have a phone number' });
    }
    
    // Generate PDF terlebih dahulu
    const { publicPath } = await generatePDF(transaction);
    const filename = path.basename(publicPath);
    
    // Generate unique secret token untuk URL
    const secretToken = crypto.randomBytes(16).toString('hex');
    
    // Simpan token dengan expiry date (24 jam) dan filename PDF
    await prisma.receiptToken.create({
      data: {
        token: secretToken,
        transactionId: id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 jam
        filename: filename // Simpan nama file PDF
      }
    });
    
    const receiptUrl = `${process.env.FRONTEND_URL}/receipts/${id}?token=${secretToken}`;
    
    // Kirim receipt melalui WhatsApp sebagai link
    const result = await whatsappService.sendTransactionReceiptLink(
      transaction.order.user.phone,
      {
        customerName: transaction.order.user.username,
        transactionId: transaction.id,
        date: transaction.createdAt,
        amount: Number(transaction.amount)
      },
      receiptUrl
    );
    
    if (!result.success) {
      return res.status(500).json({ message: 'Failed to send receipt link via WhatsApp' });
    }
    
    res.status(200).json({ 
      message: 'Receipt link sent successfully',
      receiptUrl,
      pdfPath: publicPath
    });
  } catch (error) {
    console.error('Error sending receipt link:', error);
    res.status(500).json({ message: error.message });
  }
});





module.exports = router;