const express = require('express');
const Loan = require('../models/Loan');
const Document = require('../models/Document');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const router = express.Router();

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
router.get('/documents', auth, admin, async (req,res)=>{
  const docs = await Document.find().populate('user','name email');
  res.json(docs);
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
