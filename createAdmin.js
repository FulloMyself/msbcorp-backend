// createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User'); // make sure the path is correct

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Admin details
    const name = 'Admin Name';
    const email = 'admin@msbfinance.com';
    const contact = '0000000000';
    const password = 'AdminPassword123'; // Change this to a strong password!

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await User.create({
      name,
      email,
      contact,
      password: hashedPassword,
      role: 'admin'
    });

    console.log('Admin user created successfully:');
    console.log(admin);

    process.exit();
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

createAdmin();
