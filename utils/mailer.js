// Email configuration
const PHP_ENDPOINT = process.env.NODE_ENV === 'production'
  ? 'https://msbfinance.co.za/send-email.php'
  : 'http://localhost/send-email.php';

// Retry configuration
const RETRY_COUNT = 2;
const RETRY_DELAY = 3000; // 3 seconds

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Basic email configuration with detailed logging
const createTransporter = () => {
  console.log('📧 Using PHP mailer endpoint:', PHP_ENDPOINT);
  return true;
};

// Test the email configuration directly
export const testEmailConfig = async () => {
  try {
    console.log('🔄 Testing PHP mailer endpoint...');
    const response = await fetch(PHP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'test@msbfinance.co.za',
        subject: 'Test Email',
        message: 'This is a test email.'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('✅ PHP mailer test successful');
    return true;
  } catch (err) {
    console.error('❌ PHP mailer test failed:', {
      error: err.message
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
      
      // Send request to PHP endpoint
      const response = await fetch(PHP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          message: text
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to send email');
      }

      // Log success
      console.log('✅ Email sent successfully:', {
        to,
        subject,
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
    to,
    subject
  });

  // Re-throw last error for caller to handle
  throw lastError;
};