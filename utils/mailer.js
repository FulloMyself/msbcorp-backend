// utils/mailer.js
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", // or your domain’s SMTP server
      port: 465,
      secure: true, // true for port 465, false for 587
      auth: {
        user: process.env.EMAIL_USER, // e.g. info@msbfinance.co.za
        pass: process.env.EMAIL_PASS, // your email password / app password
      },
    });

    await transporter.sendMail({
      from: `"MSB Finance" <${process.env.EMAIL_USER}>`,
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
