// userRoutes.js
import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import User from "../models/User.js";
import Loan from "../models/Loan.js";
import Document from "../models/Document.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { sendEmail } from "../utils/mailer.js";

dotenv.config();

// -----------------
// AWS S3 Config
// -----------------
const BUCKET = process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// -----------------
// Multer setup
// -----------------
const upload = multer();

const router = express.Router();

// -----------------
// Get current user
// -----------------
router.get("/me", authMiddleware, async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------
// Update user details (Email + Password)
// -----------------
router.post("/update-details", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, currentPassword, newPassword, confirmNewPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Update email if provided
    if (email) {
      user.email = email;
    }

    // ✅ Handle password update securely
    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      if (!newPassword || !confirmNewPassword) {
        return res.status(400).json({ message: "New password and confirmation are required" });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: "New password and confirmation do not match" });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({ message: "Details updated successfully" });
  } catch (err) {
    console.error("Error updating details:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// -----------------
// Apply loan
// -----------------
router.post("/apply-loan", authMiddleware, async (req, res) => {
  const { amount, bankDetails, term } = req.body;

  // Validate input
  if (!amount || amount < 300 || amount > 4000) {
    return res.status(400).json({ message: "Loan must be R300-R4000" });
  }

  const requiredFields = ["bankName", "accountNumber", "branchCode", "accountHolder"];
  for (const field of requiredFields) {
    if (!bankDetails?.[field]) {
      return res.status(400).json({ message: "All bank details are required" });
    }
  }

  try {
    // Create loan
    const loan = await Loan.create({
      user: req.user.id,
      amount,
      term: term || 12,
      bankDetails,
    });

    // Prepare email messages
    const adminMessage = `
A new loan application has been submitted.

Applicant: ${req.user.name} (${req.user.email})
Loan Amount: R${amount}

Bank Details:
- Bank Name: ${bankDetails.bankName}
- Account Number: ${bankDetails.accountNumber}
- Branch Code: ${bankDetails.branchCode}
- Account Holder: ${bankDetails.accountHolder}
    `;
    const userMessage = `
Dear ${req.user.name},

Your loan application for R${amount} has been received and is pending verification.
Our team will review it and get back to you shortly.

Thank you,
MSB Finance
    `;

    // Send emails with proper error handling
    try {
      // Send admin notification first
      await sendEmail(
        process.env.SMTP_USER,
        "New Loan Application",
        adminMessage
      );
      console.log('✅ Admin notification sent successfully');

      // Send user confirmation
      await sendEmail(
        req.user.email,
        "Loan Application Received",
        userMessage
      );
      console.log('✅ User confirmation sent successfully');
    } catch (emailErr) {
      console.error('⚠️ Email sending failed:', emailErr);
      // Don't fail the request, but let the client know about email status
      return res.json({
        success: true,
        loan,
        message: "Loan application submitted successfully, but confirmation email could not be sent. Our team will contact you shortly."
      });
    }

    res.json({ success: true, loan, message: "Loan applied and email notifications sent successfully." });
  } catch (err) {
    console.error("Loan application error:", err);
    res.status(500).json({ success: false, message: "Failed to apply loan" });
  }
});

// -----------------
// Upload document
// -----------------
router.post("/upload-document", authMiddleware, upload.single("document"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const key = `${Date.now()}-${uuidv4()}-${req.file.originalname}`;
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };

  try {
    const uploader = new Upload({ client: s3, params });
    await uploader.done();

    const doc = await Document.create({
      user: req.user.id,
      fileName: key,
    });

    res.json(doc);
  } catch (err) {
    console.error("S3 upload failed:", err);
    res.status(500).json({ message: "S3 upload failed" });
  }
});

// -----------------
// Download document
// -----------------
router.get("/documents/:id/download", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (doc.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: doc.fileName });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ url, fileName: doc.fileName });
  } catch (err) {
    console.error("Failed to generate download link:", err);
    res.status(500).json({ message: "Failed to generate download link" });
  }
});

// -----------------
// Delete document
// -----------------
router.delete("/documents/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (doc.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.fileName }));
    await doc.deleteOne();
    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error("Failed to delete document:", err);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// -----------------
// Get user's loans
// -----------------
router.get("/loans", authMiddleware, async (req, res) => {
  try {
    const loans = await Loan.find({ user: req.user.id });
    res.json(loans);
  } catch (err) {
    console.error("Failed to fetch loans:", err);
    res.status(500).json({ message: "Failed to fetch loans" });
  }
});

// -----------------
// Get user's documents
// -----------------
router.get("/documents", authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ user: req.user.id });

    const signedDocs = await Promise.all(
      docs.map(async (d) => {
        const command = new GetObjectCommand({ Bucket: BUCKET, Key: d.fileName });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return { ...d.toObject(), signedUrl: url };
      })
    );

    res.json(signedDocs);
  } catch (err) {
    console.error("Failed to load documents:", err);
    res.status(500).json({ message: "Failed to load documents" });
  }
});

export default router;
