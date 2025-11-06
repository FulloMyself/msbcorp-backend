import express from 'express';
import { testEmailConfig, sendEmail } from '../utils/mailer.js';

const router = express.Router();

// Test email configuration
router.get('/email-config', async (req, res) => {
  try {
    const isWorking = await testEmailConfig();
    res.json({ 
      success: isWorking,
      message: isWorking ? 'SMTP connection successful' : 'SMTP connection failed'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Test sending an email
router.post('/send-test-email', async (req, res) => {
  try {
    const testResult = await sendEmail(
      process.env.SMTP_USER,  // send to ourselves
      'Test Email from MSB Finance',
      'This is a test email to verify the email configuration is working.'
    );
    
    res.json({
      success: true,
      message: 'Test email sent successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      details: {
        code: err.code,
        command: err.command
      }
    });
  }
});

export default router;