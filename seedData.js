const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const User = require('./models/User');
const Group = require('./models/Group');
const Reward = require('./models/Reward');
const Competition = require('./models/Competition');
const Rating = require('./models/Rating');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eduplatform');
    console.log('Connected to MongoDB');

    // Only create admin if no admin exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      console.log('Creating admin user...');
      const admin = await User.create({
        firstName: 'Admin',
        lastName: 'Boshqaruvchi',
        password: 'Admin123!@#',
        role: 'admin',
        isActive: true
      });
      console.log('✅ Admin user created');
    } else {
      console.log('ℹ️ Admin user already exists, skipping creation');
      // Update existing admin password to meet new requirements
      console.log('Updating admin password to meet new security requirements...');
      existingAdmin.password = 'Admin123!@#';
      await existingAdmin.save();
      console.log('✅ Admin password updated');
    }

    // Don't create demo users automatically
    console.log('ℹ️ Skipping demo users creation - use admin panel to create users');
    
    console.log('✅ Seed data completed');
    console.log('\n=== ADMIN LOGIN ===');
    console.log('Ism: Admin | Familiya: Boshqaruvchi');
    console.log('Password: Admin123!@#');
    console.log('Role: admin');
    console.log('\n=== APPLICATION URLS ===');
    console.log('Frontend: http://localhost:3001');
    console.log('Backend API: http://localhost:5002');
    
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedData();