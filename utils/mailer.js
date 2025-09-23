// utils/mailer.js
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,        // e.g., mail.msbfinance.co.za
      port: Number(process.env.SMTP_PORT), // 465 for SSL, 587 for TLS
      secure: Number(process.env.SMTP_PORT) === 465, // true for SSL (465), false for TLS (587)
      auth: {
        user: process.env.SMTP_USER,      // full Afrihost email, e.g., info@msbfinance.co.za
        pass: process.env.SMTP_PASS       // email password from cPanel
      },
      tls: {
        rejectUnauthorized: false // helps avoid SSL cert issues
      }
    });

    await transporter.sendMail({
      from: `"MSB Finance" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });

    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    throw err;
  }
};
