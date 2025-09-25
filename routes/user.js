import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";

import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";

import { sendEmail } from "../utils/mailer.js";
import Loan from "../models/Loan.js";
import Document from "../models/Document.js";
import authMiddleware from "../middleware/authMiddleware.js";

dotenv.config();

const BUCKET = process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;

const router = express.Router();

// AWS S3 client
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Multer S3 storage
const upload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    acl: "private",
    key: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  })
});

// Update user details (Phone + Password)
router.put("/update-details", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // set by authMiddleware
    const { contact, currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Update contact if provided
    if (contact) user.contact = contact;

    // Update password if provided
    if (newPassword) {
      if (!currentPassword)
        return res.status(400).json({ message: "Current password required" });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch)
        return res.status(400).json({ message: "Current password incorrect" });

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    return res.json({ message: "Details updated successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// -----------------
// Apply loan & send notifications
// -----------------
router.post("/apply-loan", authMiddleware, async (req, res) => {
  const { amount, bankDetails } = req.body;

  if (!amount || amount < 300 || amount > 4000) {
    return res.status(400).json({ message: "Loan must be R300-R4000" });
  }

  if (!bankDetails || !bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.branchCode || !bankDetails.accountHolder) {
    return res.status(400).json({ message: "All bank details are required" });
  }

  try {
    // 1️⃣ Create loan
    const loan = await Loan.create({
      user: req.user._id,
      amount,
      bankDetails,
    });

    // 2️⃣ Send emails
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

    await sendEmail(process.env.SMTP_USER, "New Loan Application", adminMessage);
    await sendEmail(req.user.email, "Loan Application Received", userMessage);

    // 3️⃣ Return the created loan
    res.json({ success: true, loan, message: "Loan applied and notifications sent" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to apply loan" });
  }
});

// -----------------
// Upload document
// -----------------
router.post("/upload-document", authMiddleware, multer().single("document"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const params = {
    Bucket: BUCKET,
    Key: `${Date.now()}-${req.file.originalname}`,
    Body: req.file.buffer,
    ContentType: req.file.mimetype
  };

  try {
    const upload = new Upload({ client: s3, params });
    const result = await upload.done();

    const doc = await Document.create({
      user: req.user._id,
      fileName: params.Key,
      url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${params.Key}`
    });

    res.json(doc);
  } catch (err) {
    console.error(err);
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
    if (doc.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: doc.fileName });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ url, fileName: doc.fileName });
  } catch (err) {
    console.error(err);
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
    if (doc.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.fileName }));
    await doc.deleteOne();

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// -----------------
// Get user's loans
// -----------------
router.get("/loans", authMiddleware, async (req, res) => {
  try {
    const loans = await Loan.find({ user: req.user._id });
    res.json(loans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch loans" });
  }
});

// -----------------
// Get user's documents
// -----------------
router.get("/documents", authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ user: req.user._id });

    const signedDocs = await Promise.all(
      docs.map(async (d) => {
        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: d.fileName
        });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return { ...d.toObject(), signedUrl: url };
      })
    );

    res.json(signedDocs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load documents" });
  }
});

export default router;
