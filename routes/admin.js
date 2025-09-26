import express from "express";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import Loan from "../models/Loan.js";
import Document from "../models/Document.js";
import User from "../models/User.js";

import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

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

// Get all users
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  const users = await User.find({ role: "user" }).select("-password");
  res.json(users);
});

// Get all loans
router.get("/loans", authMiddleware, adminMiddleware, async (req, res) => {
  const loans = await Loan.find().populate("user", "name email");
  res.json(loans);
});

// Get all documents
router.get("/documents", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const docs = await Document.find().populate("user", "name email");
    const results = await Promise.all(
      docs.map(async (doc) => {
        const command = new GetObjectCommand({ Bucket: BUCKET, Key: doc.fileName });
        const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
        return {
          ...doc.toObject(),
          url,
          user: {
            _id: doc.user?._id,
            name: doc.user?.name || "No Name",
            email: doc.user?.email || "No Email",
          },
        };
      })
    );
    res.json(results);
  } catch (err) {
    console.error("Admin documents error:", err);
    res.status(500).json({ error: "Error fetching documents" });
  }
});

// View a specific document
router.get("/documents/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: doc.fileName });
    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    res.json({ url, fileName: doc.fileName, user: doc.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching document" });
  }
});

// Delete a document
router.delete("/documents/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.fileName }));
    await Document.deleteOne({ _id: doc._id });

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting document" });
  }
});

// Approve/reject loan
router.patch("/loans/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!["Pending", "Approved", "Rejected"].includes(status))
    return res.status(400).json({ message: "Invalid status" });

  const loan = await Loan.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(loan);
});

// Approve/reject document
router.patch("/documents/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!["Pending", "Approved", "Rejected"].includes(status))
    return res.status(400).json({ message: "Invalid status" });

  const doc = await Document.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(doc);
});

export default router;
