const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3'); // optional if you want direct streaming
require('dotenv').config();

const Loan = require('../models/Loan');
const Document = require('../models/Document');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// AWS S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
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
router.post('/upload-document', auth, multer().single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${Date.now()}-${req.file.originalname}`,
    Body: req.file.buffer,
    ContentType: req.file.mimetype
  };

  try {
    const upload = new Upload({
      client: s3,
      params
    });

    const result = await upload.done();

    // Save to DB
    const doc = await Document.create({
      user: req.user._id,
      fileName: params.Key,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`
    });

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'S3 upload failed' });
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
router.get('/documents', auth, async (req,res)=>{
  try {
    const docs = await Document.find({ user:req.user._id });

    const signedDocs = await Promise.all(docs.map(async d => {
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: d.fileName
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

      return {
        ...d.toObject(),
        signedUrl: url
      };
    }));

    res.json(signedDocs);
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load documents' });
  }
});

module.exports = router;
