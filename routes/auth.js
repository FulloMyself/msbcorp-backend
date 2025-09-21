const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Register Normal User
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  console.log("Register request body:", req.body);  // 👈 add this

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email exists' });

    const user = await User.create({ name, email, password });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("Register error:", err);   // 👈 add this
    res.status(500).json({ message: err.message });
  }
});

// Login (Normal + Admin)
router.post('/login', async (req,res)=>{
  const { email,password } = req.body;
  try {
    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ message: 'User not found' });

    const isMatch = await user.comparePassword(password);
    if(!isMatch) return res.status(400).json({ message: 'Incorrect password' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn:'2h' });
    res.json({ token, user: { id:user._id, name:user.name, email:user.email, role:user.role } });
  } catch(err){
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
