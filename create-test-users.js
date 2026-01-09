const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
const User = require('./models/User');
const Group = require('./models/Group');

async function createTestUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Avval eski foydalanuvchilarni o'chirish (admin dan tashqari)
    await User.deleteMany({ role: { $ne: 'admin' } });
    console.log('✅ Eski foydalanuvchilar o\'chirildi');
    
    // Guruh yaratish
    let group = await Group.findOne({ name: 'Ingliz-A1' });
    if (!group) {
      group = await Group.create({
        name: 'Ingliz-A1',
        subject: 'Ingliz tili',
        level: 'beginner',
        description: 'Ingliz tili boshlang\'ich daraja'
      });
      console.log('✅ Guruh yaratildi: Ingliz-A1');
    }
    
    // O'qituvchi yaratish
    const teacher = await User.create({
      firstName: 'Aziz',
      lastName: 'Karimov',
      password: 'teacher123',
      role: 'teacher',
      teacherId: 'TEA001',
      subject: 'Ingliz tili'
    });
    console.log('✅ O\'qituvchi yaratildi: Aziz Karimov');
    
    // O'quvchi yaratish
    const student = await User.create({
      firstName: 'Ali',
      lastName: 'Valiyev',
      password: 'teacher123',
      role: 'student',
      studentId: 'STU001',
      parentPhone: '+998901234567',
      group: group._id
    });
    console.log('✅ O\'quvchi yaratildi: Ali Valiyev');
    
    // Ota-ona yaratish
    const parent = await User.create({
      firstName: 'Oybek',
      lastName: 'Valiyev',
      password: 'teacher123',
      role: 'parent',
      parentType: 'father',
      childName: 'Ali Valiyev',
      children: [student._id]
    });
    console.log('✅ Ota-ona yaratildi: Oybek Valiyev');
    
    // Guruhga o'quvchini qo'shish
    group.students = [student._id];
    await group.save();
    
    mongoose.connection.close();
    console.log('\n🎉 Barcha test hisoblar yaratildi!');
    
    console.log('\n🔑 TEST HISOBLAR:');
    console.log('Admin: Admin / Boshqaruvchi / Admin123!@#');
    console.log('O\'qituvchi: Aziz / Karimov / teacher123 (ID: TEA001, Fan: Ingliz tili)');
    console.log('O\'quvchi: Ali / Valiyev / teacher123 (ID: STU001, Tel: +998901234567, Guruh: Ingliz-A1)');
    console.log('Ota-ona: Oybek / Valiyev / teacher123 (Turi: Ota, Farzand: Ali Valiyev)');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestUsers();