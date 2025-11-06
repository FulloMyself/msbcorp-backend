import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

// ===== Import Models =====
import User from "./models/User.js";

// ===== Import Routes =====
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();

// ===== Fix __dirname for ES modules =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CORS setup ====
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://msbfinance.co.za',
  'https://msbfinance.co.za',
  'http://www.msbfinance.co.za',
  'https://www.msbfinance.co.za',
  'https://msbcorp-backend.onrender.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (e.g., curl, mobile apps)
    if (!origin) return callback(null, true);

    // allow exact matches
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // allow any subdomain of msbfinance.co.za (if you want)
    try {
      const url = new URL(origin);
      if (url.hostname.endsWith('.msbfinance.co.za') || url.hostname === 'msbfinance.co.za') {
        return callback(null, true);
      }
    } catch (e) {
      // invalid origin format; fall through to block
    }

    console.log('Blocked origin:', origin);
    callback(new Error('CORS not allowed for this origin'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// Also ensure we respond to preflight explicitly (optional - cors should do this)
app.options('*', cors());

// ===== Middleware =====
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== API Routes =====
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);

// ===== Serve frontend (only if it exists) =====
const frontendPath = path.join(__dirname, "frontend");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  // Catch-all route for frontend (exclude /api/*)
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.log('⚠️ Frontend folder not found, skipping static file serving.');
}

// ===== Error Handling Middleware =====
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || "Internal server error" });
});

// ===== Admin Seeder =====
const ensureAdminExists = async () => {
  try {
    const email = "info@msbfinance.co.za";
    const existingAdmin = await User.findOne({ email });

    if (!existingAdmin) {
      const password = "Admin@123"; // ⚠️ Replace or move to .env
      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = new User({
        name: "MSB Finance Admin",
        email,
        contact: "+27711227059", // ✅ Update with real number
        password: hashedPassword,
        role: "admin",
      });

      await admin.save();
      console.log("✅ Admin account created:", email);
      console.log("🔑 Temporary password:", password);
    } else {
      console.log("ℹ️ Admin already exists:", email);
    }
  } catch (err) {
    console.error("❌ Error ensuring admin exists:", err.message);
  }
};

// ===== Connect to MongoDB and Start Server =====
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(async () => {
    console.log("✅ MongoDB connected");

    // Ensure the collections exist and seed admin
    await ensureAdminExists();

    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));
