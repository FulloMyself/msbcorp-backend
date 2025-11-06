import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

dotenv.config();

const MONGO = process.env.MONGO_URI;

async function seed() {
  try {
    if (!MONGO) throw new Error('MONGO_URI not set in .env');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const email = 'admin@msbfinance.com';
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Admin already exists:', email);
      console.log({ id: existing._id.toString(), email: existing.email });
      process.exit(0);
    }

    const password = 'AdminPassword123';
    const hashed = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name: 'Admin Seeded',
      email,
      contact: '+27000000000',
      password: hashed,
      role: 'admin'
    });

    console.log('Admin created:');
    console.log('email:', email);
    console.log('password:', password);
    console.log('id:', admin._id.toString());
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
