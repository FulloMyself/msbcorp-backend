import nodemailer from "nodemailer";

// Retry configuration
const RETRY_COUNT = 2;
const RETRY_DELAY = 3000; // 3 seconds
const CONNECTION_TIMEOUT = 15000; // 15 seconds
const SOCKET_TIMEOUT = 30000; // 30 seconds

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Basic email configuration with detailed logging
const createTransporter = () => {
  // Get configuration from environment
  const config = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  };

  // Log configuration check
  console.log('📧 Checking email configuration:', {
    host: config.host,
    port: config.port,
    user: config.user,
    hasPassword: Boolean(config.pass)
  });

  // Validate required fields
  if (!config.host || !config.port || !config.user || !config.pass) {
    console.error('❌ Missing email configuration:', {
      missingHost: !config.host,
      missingPort: !config.port,
      missingUser: !config.user,
      missingPass: !config.pass
    });
    throw new Error('Missing email configuration');
  }

  // Create transporter with enhanced reliability config
  return nodemailer.createTransport({
    host: config.host,
    port: Number(config.port),
    secure: true,  // use SSL
    auth: {
      user: config.user,
      pass: config.pass
    },
    connectionTimeout: CONNECTION_TIMEOUT,
    socketTimeout: SOCKET_TIMEOUT,
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000, // 1 second
    rateLimit: 5, // 5 messages per rateDelta
    tls: {
      rejectUnauthorized: false // allow self-signed certs
    }
  });
};

// Test the email configuration directly
export const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    console.log('🔄 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection test successful');
    return true;
  } catch (err) {
    console.error('❌ SMTP connection test failed:', {
      error: err.message,
      code: err.code,
      command: err.command,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT
    });
    return false;
  }
};

// Robust email sending function with retries
export const sendEmail = async (to, subject, text) => {
  let lastError;
  
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      console.log(`📧 Preparing to send email (attempt ${attempt}/${RETRY_COUNT}):`, { to, subject });
      
      // Create transporter (pooled connections will be reused)
      const transporter = createTransporter();
      
      // Prepare mail options
      const mailOptions = {
        from: {
          name: 'MSB Finance',
          address: process.env.SMTP_USER
        },
        to,
        subject,
        text,
        priority: 'high'
      };

      // Attempt to send with timeout promise
      const info = await Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), SOCKET_TIMEOUT)
        )
      ]);

      // Log success
      console.log('✅ Email sent successfully:', {
        to,
        subject,
        messageId: info.messageId,
        response: info.response,
        attempt
      });

      return true;
    } catch (err) {
      lastError = err;
      // Log error with attempt number
      console.error(`❌ Email sending failed (attempt ${attempt}):`, err.message);

      // If we have retries left, wait before trying again
      if (attempt < RETRY_COUNT) {
        await delay(RETRY_DELAY);
      }
    }
  }

  // If we get here, all attempts failed
  console.warn('⚠️ All email retry attempts failed for:', { to, subject });
  
  // Log detailed final error
  console.error('❌ Email sending failed after all retries:', {
    error: lastError.message,
    code: lastError.code,
    command: lastError.command,
    to,
    subject,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT
  });

  // Re-throw last error for caller to handle
  throw lastError;
};