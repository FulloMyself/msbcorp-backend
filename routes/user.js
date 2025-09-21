const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const Loan = require('../models/Loan');
const Document = require('../models/Document');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// AWS S3 configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Multer S3 storage
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'private', // use 'public-read' if you want public URLs
    key: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  })
});

// -----------------
// Loan application
// -----------------
router.post('/apply-loan', auth, async (req, res) => {
  const { amount } = req.body;
  if (amount < 300 || amount > 4000)
    return res.status(400).json({ message: 'Loan must be R300-R4000' });

  try {
    const loan = await Loan.create({ user: req.user._id, amount });
    res.json(loan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error applying loan' });
  }
});

// -----------------
// Upload document
// -----------------
router.post('/upload-document', auth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const doc = await Document.create({
      user: req.user._id,
      fileName: req.file.key,
      status: 'Pending'
    });

    // Generate signed URL for access
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: req.file.key,
      Expires: 60 * 60 // 1 hour
    });

    res.json({ ...doc.toObject(), url: signedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error uploading document' });
  }
});

// -----------------
// Get user's loans
// -----------------
router.get('/loans', auth, async (req, res) => {
  try {
    const loans = await Loan.find({ user: req.user._id });
    res.json(loans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch loans' });
  }
});

// -----------------
// Get user's documents
// -----------------
router.get('/documents', auth, async (req, res) => {
  try {
    const docs = await Document.find({ user: req.user._id });

    // Map each document to include signed URL
    const docsWithUrls = docs.map(d => {
      const url = s3.getSignedUrl('getObject', {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: d.fileName,
        Expires: 60 * 60
      });
      return { ...d.toObject(), url };
    });

    res.json(docsWithUrls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

module.exports = router;
