const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST || 'smtp.mailtrap.io',
      port: process.env.MAILTRAP_PORT || 2525,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASSWORD
      }
    });
  }

  async sendContactEmail(contactData) {
    try {
      const { name, email, message } = contactData;
      
      const mailOptions = {
        from: `"DK Mandiri Website" <contact@dkmandiri.id>`,
        to: process.env.ADMIN_EMAIL || 'admin@dkmandiri.id',
        replyTo: email,
        subject: `Contact Form Message from ${name}`,
        text: `
          Name: ${name}
          Email: ${email}
          
          Message:
          ${message}
        `,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #0284c7;">New Contact Message</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <div style="margin-top: 20px; border-left: 4px solid #0284c7; padding-left: 15px;">
              <p><strong>Message:</strong></p>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <div style="margin-top: 30px; font-size: 12px; color: #666;">
              <p>This message was sent from the DK Mandiri website contact form.</p>
            </div>
          </div>
        `
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();