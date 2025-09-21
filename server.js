require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');


const app = express();

// ===== CORS setup =====
const allowedOrigins = [
  "http://localhost:5500",           // local dev via Live Server
  "http://127.0.0.1:5500",           // local dev
  "http://localhost:3000",           // React dev server (optional)
  "https://fullomyself.github.io"    // production frontend
];

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests (e.g., Postman)
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed for this origin"));
    }
  },
  credentials: true,
};

// Apply CORS globally (handles preflight automatically)
app.use(cors(corsOptions));

// ===== Middleware =====
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // serve uploaded files

// ===== API Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// ===== Serve frontend for any unmatched route =====
// Serve frontend static files first
app.use(express.static(path.join(__dirname, 'frontend')));

// Catch-all route (Express 5 compatible)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});


// ===== Connect to MongoDB and start server =====
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
