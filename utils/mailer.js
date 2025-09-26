import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    const port = Number(process.env.SMTP_PORT);
    const secure = port === 465; // SSL for 465, TLS otherwise

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
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
  }
};
