const express = require('express');
const multer = require('multer');
const Loan = require('../models/Loan');
const Document = require('../models/Document');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

// Loan application
router.post('/apply-loan', auth, async (req,res)=>{
  const { amount } = req.body;
  if(amount < 300 || amount > 4000) return res.status(400).json({ message:'Loan must be R300-R4000' });
  const loan = await Loan.create({ user: req.user._id, amount });
  res.json(loan);
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null,'uploads/'),
  filename: (req,file,cb)=> cb(null, Date.now()+'-'+file.originalname)
});
const upload = multer({ storage });

// Upload document
router.post('/upload-document', auth, upload.single('document'), async (req,res)=>{
  const doc = await Document.create({ user:req.user._id, fileName:req.file.filename });
  res.json(doc);
});

// Get user's loans
router.get('/loans', auth, async (req,res)=>{
  const loans = await Loan.find({ user:req.user._id });
  res.json(loans);
});

// Get user's documents
router.get('/documents', auth, async (req,res)=>{
  const docs = await Document.find({ user:req.user._id });
  res.json(docs);
});

module.exports = router;
