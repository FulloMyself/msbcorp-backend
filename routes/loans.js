import { Router } from 'express';
import Loan from '../models/Loan.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { sendEmail } from '../utils/mailer.js';
import { getLoanApplicationEmailTemplate } from '../utils/emailTemplates.js';

const router = Router();

// Apply for a loan
router.post('/apply', authMiddleware, async (req, res) => {
    const { amount, term, bankDetails } = req.body;
    
    try {
        // Basic validation
        if (!amount || !term || !bankDetails) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide all required loan details' 
            });
        }

        // Create the loan
        const loan = await Loan.create({
            user: req.user.id,
            amount,
            term,
            bankDetails,
            interestRate: 30, // 30% as shown in the calculator
            status: 'Pending'
        });

        // Populate user details for email
        const populatedLoan = await Loan.findById(loan._id)
            .populate('user', 'name email contact');

        // Send confirmation email to user
        await sendEmail(
            req.user.email,
            'Loan Application Received - MSB Finance',
            getLoanApplicationEmailTemplate(populatedLoan, populatedLoan.user, false)
        );

        // Send notification to admin
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@msbfinance.co.za';
        await sendEmail(
            adminEmail,
            'New Loan Application Received',
            getLoanApplicationEmailTemplate(populatedLoan, populatedLoan.user, true)
        );

        res.json({
            success: true,
            message: 'Loan application submitted successfully',
            loan: {
                id: loan._id,
                amount: loan.amount,
                term: loan.term,
                status: loan.status,
                createdAt: loan.createdAt
            }
        });

    } catch (err) {
        console.error('Loan application error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to submit loan application. Please try again.'
        });
    }
});

export default router;