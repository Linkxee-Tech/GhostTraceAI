'use strict';

require('dotenv').config();
const { connect, disconnect } = require('./src/db/connection');
const { createUser } = require('./src/services/authService');
const User = require('./src/db/schemas/User');

async function seedAdmin() {
  try {
    await connect();
    
    // Check if an admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@ghosttrace.ai' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists: admin@ghosttrace.ai');
      await disconnect();
      process.exit(0);
    }

    // Create the default admin
    await createUser({
      email: 'admin@ghosttrace.ai',
      password: 'password123',
      name: 'GhostTrace Admin',
      role: 'admin'
    });

    console.log('✅ Default admin user successfully created!');
    console.log('--------------------------------------------------');
    console.log('Email:    admin@ghosttrace.ai');
    console.log('Password: password123');
    console.log('--------------------------------------------------');
    
  } catch (err) {
    console.error('❌ Failed to seed admin:', err.message);
  } finally {
    await disconnect();
    process.exit(0);
  }
}

seedAdmin();
