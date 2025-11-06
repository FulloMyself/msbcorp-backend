import nodemailer from "nodemailer";

// Email configuration with timeout and retry
const createTransporter = () => {
  const port = Number(process.env.SMTP_PORT);
  const secure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 5000, // 5 seconds timeout
    socketTimeout: 5000,
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Non-blocking email send with retry
export const sendEmail = (to, subject, text) => {
  // Don't block the main flow - return immediately
  setImmediate(async () => {
    const maxRetries = 2;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"MSB Finance" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text,
        });
        console.log(`📧 Email sent to ${to} (attempt ${attempts + 1})`);
        return; // Success - exit
      } catch (err) {
        attempts++;
        console.error(`❌ Email sending failed (attempt ${attempts}):`, err.message);
        if (attempts === maxRetries) {
          // Log final failure but don't throw - we don't want to break the app flow
          console.error('⚠️ All email retry attempts failed for:', { to, subject });
        }
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });
};
