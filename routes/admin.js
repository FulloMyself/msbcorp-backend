const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Loan = require('../models/Loan');
const Document = require('../models/Document');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const router = express.Router();

const BUCKET = process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;


// Get all users
router.get('/users', auth, admin, async (req,res)=>{
  const users = await User.find({ role:'user' }).select('-password');
  res.json(users);
});

// Get all loans
router.get('/loans', auth, admin, async (req,res)=>{
  const loans = await Loan.find().populate('user','name email');
  res.json(loans);
});

// Get all documents
// Admin: list all documents with signed URLs
router.get('/documents', auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const docs = await Document.find().populate("user", "email");
    const results = await Promise.all(
      docs.map(async (doc) => {
        const command = new GetObjectCommand({
          Bucket: BUCKET,
          Key: doc.fileName,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

        return {
          ...doc.toObject(),
          url,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching documents" });
  }
});

// ✅ Admin: View a specific document
router.get('/documents/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Create a signed URL for the file
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: doc.fileName,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 }); // 5 mins
    res.json({ url, fileName: doc.fileName, user: doc.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching document' });
  }
});


// Approve/reject loan
router.patch('/loans/:id', auth, admin, async (req,res)=>{
  const { status } = req.body;
  if(!['Pending','Approved','Rejected'].includes(status)) return res.status(400).json({ message:'Invalid status' });
  const loan = await Loan.findByIdAndUpdate(req.params.id,{ status },{ new:true });
  res.json(loan);
});

// Approve/reject document
router.patch('/documents/:id', auth, admin, async (req,res)=>{
  const { status } = req.body;
  if(!['Pending','Approved','Rejected'].includes(status)) return res.status(400).json({ message:'Invalid status' });
  const doc = await Document.findByIdAndUpdate(req.params.id,{ status },{ new:true });
  res.json(doc);
});

module.exports = router;
