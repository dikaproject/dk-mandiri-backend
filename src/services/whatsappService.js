const axios = require('axios');
const FormData = require('form-data');

class WhatsAppService {
  constructor() {
    this.apiUrl = 'https://api.fonnte.com/send'; // URL yang benar
    this.apiToken = process.env.FONNTE_TOKEN;    // Nama env variable yang benar
    this.senderNumber = process.env.FONTE_SENDER_NUMBER;
  }

  async sendOrderConfirmation(phone, orderData) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    try {
      // Pesan berbeda untuk order online vs offline
      let message = '';
      
      if (orderData.orderType === 'OFFLINE') {
        message = `Halo ${orderData.customerName},
  
Pesanan Anda di DK Mandiri telah berhasil dibuat!
  
*Detail Pesanan:*
No. Pesanan: ${orderData.orderNumber}
Tanggal: ${new Date(orderData.orderDate).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })}
Total: Rp ${orderData.totalAmount.toLocaleString('id-ID')}
  
Anda telah memilih untuk mengambil pesanan langsung di toko kami.
Harap melakukan Pembayaran terlebih dahulu, jika sudah silahkan datang ke toko kami. 
atau lakukan pembayaran di tempat.


Jl. Suryanegara, Mertangga, Jetis, Kec. Nusawungu, Kabupaten Cilacap, Jawa Tengah 53283
Maps Link : https://maps.app.goo.gl/yXSo2ToPjtyataHb6
  
Hubungi kami di 081227848422 jika ada pertanyaan.
Terima kasih telah berbelanja di DK Mandiri!
  `;
      } else {
        message = `Halo ${orderData.customerName},
  
Pesanan Anda di DK Mandiri telah berhasil dibuat!
  
*Detail Pesanan:*
No. Pesanan: ${orderData.orderNumber}
Tanggal: ${new Date(orderData.orderDate).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })}
Total: Rp ${orderData.totalAmount.toLocaleString('id-ID')}
  
Silahkan lakukan pembayaran untuk memproses pesanan Anda.
Tidak Merasa memesan? Hubungi kami segera!
  
Hubungi kami di 081227848422 jika ada pertanyaan.
Terima kasih telah berbelanja di DK Mandiri!
  `;
      }
  
      await this.sendMessage(formattedPhone, message);
      return { success: true };
    } catch (error) {
      console.error('WhatsApp notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPaymentConfirmation(phone, paymentData) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    try {
      const message = `
Halo ${paymentData.customerName},

Pembayaran untuk pesanan *#${paymentData.orderNumber}* telah kami terima!

*Detail Pembayaran:*
Metode: ${paymentData.paymentMethod}
Jumlah: Rp ${paymentData.amount.toLocaleString('id-ID')}
Tanggal: ${new Date(paymentData.paymentDate).toLocaleDateString('id-ID', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
})}

Pesanan Anda akan segera kami proses. Kami akan memberitahu Anda ketika pesanan telah dikirim.

Hubungi kami di 081227848422 jika ada pertanyaan.
Terima kasih!
`;

      await this.sendMessage(formattedPhone, message);
      return { success: true };
    } catch (error) {
      console.error('WhatsApp notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendShippingNotification(phone, shippingData) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    try {
      const message = `Halo ${shippingData.customerName},
Pesanan Anda *#${shippingData.orderNumber}* telah dikirim!
*Detail Pengiriman:*
Tanggal Pengiriman: ${new Date(shippingData.deliveryDate).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}
Status: ${shippingData.deliveryStatus}
Nama Pengirim: ${shippingData.staffName || 'Belum ditentukan'}
${shippingData.notes ? `Catatan: ${shippingData.notes}` : ''}

Pesanan Anda akan diantar oleh kurir kami. Mohon siapkan tanda terima ketika pesanan tiba.

Hubungi kami di 081227848422 jika ada pertanyaan.
Terima kasih telah berbelanja di DK Mandiri!`;
  
      await this.sendMessage(formattedPhone, message);
      return { success: true };
    } catch (error) {
      console.error('WhatsApp notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Format phone number to international format
  formatPhoneNumber(phone) {
    if (phone.startsWith('+')) return phone.substring(1);
    if (phone.startsWith('0')) return '62' + phone.substring(1);
    return phone;
  }

  // Send message via FontE API
  async sendMessage(to, message) {
    try {
      const formData = new FormData();
      formData.append('target', to);
      formData.append('message', message);
      formData.append('delay', '2');
      formData.append('countryCode', '62');

      const response = await axios({
        method: 'post',
        url: this.apiUrl,
        headers: {
          'Authorization': this.apiToken
          // Form data menangani headers sendiri
        },
        data: formData,
        timeout: 15000, // 15 seconds timeout
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });
      
      console.log('WhatsApp send response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', {
        message: error.message,
        code: error.code,
        response: error.response?.data
      });
      throw error;
    }
  }

  async sendPasswordReset(phone, userData) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    try {
      const message = `Halo ${userData.name},
Password akun DK Mandiri Anda telah direset.
*Password Baru Anda:* ${userData.newPassword}
  
Silahkan login dengan password baru dan segera ganti password Anda untuk keamanan.

Hubungi kami di 081227848422 jika ada pertanyaan.
Terima kasih.`;
  
      await this.sendMessage(formattedPhone, message);
      return { success: true };
    } catch (error) {
      console.error('WhatsApp notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendOrderCompleteNotification(phone, orderData) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    try {
      // Buat pesan yang khusus untuk tipe orderType
      let messageText;
      
      if (orderData.orderType === 'OFFLINE') {
        messageText = `Halo ${orderData.name},
        
Pesanan pengambilan langsung Anda di DK Mandiri telah *SELESAI* diproses!
  
*Detail Pesanan:*
No. Pesanan: ${orderData.orderId.slice(0, 8)}
Total: Rp ${orderData.amount.toLocaleString('id-ID')}
${orderData.completionDetails.staffName ? `Staf: ${orderData.completionDetails.staffName}` : ''}
${orderData.completionDetails.notes ? `\nCatatan: ${orderData.completionDetails.notes}` : ''}
  
Terima kasih telah berbelanja di DK Mandiri!
Jangan ragu untuk kembali berbelanja di toko kami lagi.`;
      } else {
        messageText = `Halo ${orderData.name},
        
Pesanan Anda di DK Mandiri telah *SELESAI* diproses!
  
*Detail Pesanan:*
No. Pesanan: ${orderData.orderId.slice(0, 8)}
Total: Rp ${orderData.amount.toLocaleString('id-ID')}
${orderData.completionDetails.staffName ? `Staf: ${orderData.completionDetails.staffName}` : ''}
${orderData.completionDetails.notes ? `\nCatatan: ${orderData.completionDetails.notes}` : ''}
  
Terima kasih telah berbelanja di DK Mandiri!
Jika Anda puas dengan layanan kami, mohon rekomendasikan kami ke keluarga dan teman.`;
      }
      
      await this.sendMessage(formattedPhone, messageText);
      return { success: true };
    } catch (error) {
      console.error('WhatsApp notification failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Update metode sendTransactionReceipt untuk mengirim PDF
  async sendTransactionReceiptLink(phone, receiptData, receiptUrl) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    try {
      // Kirim pesan teks dengan link
      const message = `Halo ${receiptData.customerName},
  
Berikut adalah bukti transaksi untuk pembelian Anda di DK Mandiri:
  
*Detail Transaksi:*
No. Transaksi: ${receiptData.transactionId.slice(0, 8)}
Tanggal: ${new Date(receiptData.date).toLocaleDateString('id-ID', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
})}
Total: Rp ${receiptData.amount.toLocaleString('id-ID')}
  
Untuk melihat atau mengunduh bukti pembayaran, silakan kunjungi link berikut:
${receiptUrl}
  
Link ini berlaku selama 24 jam.

Hubungi kami di 081227848422 jika ada pertanyaan.
Terima kasih telah berbelanja di DK Mandiri!`;
  
      await this.sendMessage(formattedPhone, message);
      return { success: true };
    } catch (error) {
      console.error('WhatsApp receipt notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPOSReceipt(phone, data) {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    try {
      // Format the items list
      const itemsList = data.items.map(item => 
        `• ${item.name} (${item.quantity}): Rp ${item.price.toLocaleString('id-ID')}`
      ).join('\n');
      
      const message = `*INVOICE DK MANDIRI*\n\n` +
        `Terima kasih atas pembelian Anda, ${data.customerName}!\n\n` +
        `*Detail Pembelian:*\n` +
        `No. Order: #${data.orderNumber}\n` +
        `Tanggal: ${data.date}\n` +
        `Kasir: ${data.staffName || 'Admin'}\n\n` +
        `*Daftar Produk:*\n${itemsList}\n\n` +
        `*Total: Rp ${data.totalAmount.toLocaleString('id-ID')}*\n` +
        `Metode Pembayaran: ${data.paymentMethod}\n\n` +
        `Untuk pertanyaan lebih lanjut, hubungi kami di 081227848422\n` +
        `Terima kasih telah berbelanja di DK Mandiri!\n\n` +
        `Jl. Suryanegara, Mertangga, Jetis, Kec. Nusawungu, Kabupaten Cilacap, Jawa Tengah 53283\n` +
        `Maps Link: https://maps.app.goo.gl/yXSo2ToPjtyataHb6`;
        
      // Send the message
      await this.sendMessage(formattedPhone, message);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send POS receipt to ${phone}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WhatsAppService();