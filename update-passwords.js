const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
const User = require('./models/User');

async function updatePasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // O'qituvchining parolini Teacher123! ga o'zgartirish
    const teacher = await User.findOne({ firstName: 'Malika', lastName: 'Tosheva', role: 'teacher' });
    if (teacher) {
      teacher.password = 'Teacher123!';
      await teacher.save();
      console.log('✅ Teacher password updated to: Teacher123!');
    }
    
    // Barcha studentlarning parolini Student123! ga o'zgartirish
    const students = await User.find({ role: 'student' });
    for (const student of students) {
      student.password = 'Student123!';
      await student.save();
      console.log('✅ Student ' + student.firstName + ' ' + student.lastName + ' - Password: Student123!');
    }
    
    // Admin parolini saqlash
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
      admin.password = 'Admin123!@#';
      await admin.save();
      console.log('✅ Admin password kept: Admin123!@#');
    }
    
    mongoose.connection.close();
    console.log('🎉 Barcha parollar yangilandi!');
    
    console.log('\n📋 YANGI LOGIN MA\'LUMOTLARI:');
    console.log('Admin: Admin / Boshqaruvchi / Admin123!@#');
    console.log('Teacher: Malika / Tosheva / Teacher123!');
    console.log('Student: Ali / Valiyev / Student123!');
    console.log('Student: Jasur / Karimov / Student123!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updatePasswords();