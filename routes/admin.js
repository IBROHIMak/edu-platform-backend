const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const Homework = require('../models/Homework');
const Rating = require('../models/Rating');

const router = express.Router();

// Admin middleware
const adminAuth = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      totalTeachers,
      totalStudents,
      totalParents,
      totalGroups,
      totalHomework,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'parent' }),
      Group.countDocuments(),
      Homework.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName role createdAt')
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalTeachers,
          totalStudents,
          totalParents,
          totalGroups,
          totalHomework
        },
        recentUsers
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers with their groups
// @access  Private (Admin only)
router.get('/teachers', auth, adminAuth, async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' })
      .populate('groupsTaught', 'name subject level students')
      .select('-password')
      .sort({ firstName: 1 });

    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const totalStudents = teacher.groupsTaught.reduce((sum, group) => sum + (group.students?.length || 0), 0);
        const totalHomework = await Homework.countDocuments({ createdBy: teacher._id });
        
        return {
          ...teacher.toObject(),
          stats: {
            totalGroups: teacher.groupsTaught.length,
            totalStudents,
            totalHomework
          }
        };
      })
    );

    res.json({
      success: true,
      data: { teachers: teachersWithStats }
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/teachers/:teacherId/groups
// @desc    Get teacher's groups with students
// @access  Private (Admin only)
router.get('/teachers/:teacherId/groups', auth, adminAuth, async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const teacher = await User.findById(teacherId).select('firstName lastName teacherId subject');
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const groups = await Group.find({ teacher: teacherId })
      .populate('students', 'firstName lastName studentId points')
      .populate('teacher', 'firstName lastName')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: { teacher, groups }
    });
  } catch (error) {
    console.error('Get teacher groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/groups/:groupId/students
// @desc    Get group students with parents
// @access  Private (Admin only)
router.get('/groups/:groupId/students', auth, adminAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findById(groupId)
      .populate('teacher', 'firstName lastName teacherId')
      .populate('students', 'firstName lastName studentId points achievements');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Get parents for each student
    const studentsWithParents = await Promise.all(
      group.students.map(async (student) => {
        const parents = await User.find({ 
          role: 'parent',
          children: student._id 
        }).select('firstName lastName parentType phone email');

        const rating = await Rating.findOne({ student: student._id, group: groupId });

        return {
          ...student.toObject(),
          parents,
          rating: rating ? {
            averageGrade: rating.averageGrade,
            attendance: rating.attendance,
            homeworkCompletion: rating.homeworkCompletion
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: { 
        group: {
          ...group.toObject(),
          students: studentsWithParents
        }
      }
    });
  } catch (error) {
    console.error('Get group students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/students/:studentId/parents
// @desc    Get student's parents
// @access  Private (Admin only)
router.get('/students/:studentId/parents', auth, adminAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await User.findById(studentId)
      .populate('group', 'name subject level')
      .select('-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const parents = await User.find({ 
      role: 'parent',
      children: studentId 
    }).select('-password');

    res.json({
      success: true,
      data: { student, parents }
    });
  } catch (error) {
    console.error('Get student parents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/message-parent
// @desc    Send message to parent
// @access  Private (Admin only)
router.post('/message-parent', [
  body('parentId').notEmpty().withMessage('Parent ID is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('content').trim().notEmpty().withMessage('Message content is required')
], auth, adminAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { parentId, subject, content } = req.body;

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      recipient: parentId,
      subject,
      content,
      type: 'admin_to_parent'
    });

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: { message }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private (Admin only)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('group', 'name subject')
      .populate('groupsTaught', 'name subject')
      .populate('children', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/users/:userId/status
// @desc    Update user status (activate/deactivate)
// @access  Private (Admin only)
router.put('/users/:userId/status', [
  body('isActive').isBoolean().withMessage('Status must be boolean')
], auth, adminAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Foydalanuvchi topilmadi'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get platform analytics
// @access  Private (Admin only)
router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const [
      userGrowth,
      homeworkStats,
      groupStats,
      activeUsers
    ] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              role: '$role'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Homework.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Group.aggregate([
        {
          $group: {
            _id: '$subject',
            count: { $sum: 1 },
            totalStudents: { $sum: { $size: '$students' } }
          }
        }
      ]),
      User.countDocuments({ 
        lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    res.json({
      success: true,
      data: {
        userGrowth,
        homeworkStats,
        groupStats,
        activeUsers
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/reports
// @desc    Get comprehensive reports
// @access  Private (Admin only)
router.get('/reports', auth, adminAuth, async (req, res) => {
  try {
    const { period = 'weekly' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'yearly':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const [
      totalStudents,
      activeStudents,
      completedHomework,
      parentLogins,
      attendanceData,
      homeworkStats
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ 
        role: 'student', 
        lastLogin: { $gte: startDate } 
      }),
      Homework.countDocuments({ 
        createdAt: { $gte: startDate },
        'submissions.0': { $exists: true }
      }),
      User.countDocuments({ 
        role: 'parent', 
        lastLogin: { $gte: startDate } 
      }),
      User.find({ role: 'student' })
        .select('firstName lastName')
        .limit(10),
      Homework.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$subject', count: { $sum: 1 } } }
      ])
    ]);

    // Calculate average grade (mock for now)
    const averageGrade = 4.2;

    const reportData = {
      [period]: {
        totalStudents,
        activeStudents,
        completedHomework,
        averageGrade,
        parentLogins
      },
      attendance: attendanceData.map(student => ({
        name: `${student.firstName} ${student.lastName}`,
        attendance: Math.floor(Math.random() * 20) + 80, // Mock data
        absences: Math.floor(Math.random() * 5)
      })),
      homework: homeworkStats.map(stat => ({
        subject: stat._id || 'Umumiy',
        completed: Math.floor(Math.random() * 30) + 70,
        pending: Math.floor(Math.random() * 30) + 10
      })),
      parentActivity: await User.find({ role: 'parent' })
        .select('firstName lastName lastLogin')
        .limit(10)
        .then(parents => parents.map(parent => ({
          name: `${parent.firstName} ${parent.lastName}`,
          lastLogin: parent.lastLogin || new Date(),
          messages: Math.floor(Math.random() * 10)
        })))
    };

    res.status(200).json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/bulk-message
// @desc    Send bulk message to users
// @access  Private (Admin only)
router.post('/bulk-message', [
  body('userIds').isArray().withMessage('User IDs must be an array'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').isIn(['notification', 'email', 'sms']).withMessage('Invalid message type')
], auth, adminAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { userIds, message, type } = req.body;

    // Create message records
    const messagePromises = userIds.map(userId => 
      Message.create({
        sender: req.user.id,
        recipient: userId,
        subject: 'Admin xabari',
        content: message,
        type: 'admin_broadcast'
      })
    );

    await Promise.all(messagePromises);

    res.status(200).json({
      success: true,
      message: 'Bulk message sent successfully',
      data: {
        sentCount: userIds.length
      }
    });
  } catch (error) {
    console.error('Bulk message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/users/:userId/reset-password
// @desc    Reset user password
// @access  Private (Admin only)
router.post('/users/:userId/reset-password', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Foydalanuvchi topilmadi'
      });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        newPassword
      }
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/users
// @desc    Create new user
// @access  Private (Admin only)
router.post('/users', auth, adminAuth, [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['student', 'teacher', 'parent']).withMessage('Invalid role'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('subject').optional().notEmpty().withMessage('Subject is required for teachers'),
  body('parentPhone').optional().notEmpty().withMessage('Parent phone is required for students')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { firstName, lastName, role, password, subject, groupId, parentPhone, parentType, childName } = req.body;

    // Create user data
    const userData = {
      firstName,
      lastName,
      role,
      password: password || 'Password123!',
      isActive: true
    };

    // Generate unique ID based on existing IDs to avoid duplicates
    let uniqueId = '';
    if (role === 'student') {
      // Find the highest existing student ID
      const existingStudents = await User.find({ role: 'student', studentId: { $exists: true } })
        .select('studentId')
        .sort({ studentId: -1 });
      
      let nextNumber = 1;
      if (existingStudents.length > 0) {
        // Extract number from the highest ID (e.g., STU003 -> 3)
        const highestId = existingStudents[0].studentId;
        const currentNumber = parseInt(highestId.replace('STU', ''));
        nextNumber = currentNumber + 1;
      }
      uniqueId = `STU${String(nextNumber).padStart(3, '0')}`;
    } else if (role === 'teacher') {
      // Find the highest existing teacher ID
      const existingTeachers = await User.find({ role: 'teacher', teacherId: { $exists: true } })
        .select('teacherId')
        .sort({ teacherId: -1 });
      
      let nextNumber = 1;
      if (existingTeachers.length > 0) {
        const highestId = existingTeachers[0].teacherId;
        const currentNumber = parseInt(highestId.replace('TEA', ''));
        nextNumber = currentNumber + 1;
      }
      uniqueId = `TEA${String(nextNumber).padStart(3, '0')}`;
    } else if (role === 'parent') {
      // Find the highest existing parent ID
      const existingParents = await User.find({ role: 'parent' })
        .select('_id')
        .sort({ createdAt: -1 });
      
      let nextNumber = 1;
      if (existingParents.length > 0) {
        nextNumber = existingParents.length + 1;
      }
      uniqueId = `PAR${String(nextNumber).padStart(3, '0')}`;
    }

    // Add role-specific fields
    if (role === 'student') {
      userData.studentId = uniqueId;
      if (groupId) {
        userData.group = groupId;
      }
      if (parentPhone) {
        userData.parentPhone = parentPhone;
      }
    } else if (role === 'teacher') {
      userData.teacherId = uniqueId;
      userData.subject = subject || 'English Language Teaching';
    } else if (role === 'parent') {
      userData.parentType = parentType;
      userData.childName = childName;
    }

    const user = new User(userData);
    await user.save();

    // If student is assigned to a group, update the group's students array
    if (role === 'student' && groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $push: { students: user._id }
      });
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: userResponse,
        credentials: {
          id: uniqueId,
          password: password || 'Password123!'
        }
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/groups
// @desc    Create new group
// @access  Private (Admin only)
router.post('/groups', auth, adminAuth, [
  body('name').notEmpty().withMessage('Group name is required'),
  body('level').notEmpty().withMessage('Level is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { name, subject, level, maxStudents, teacherId, description, students } = req.body;

    // Check if group name already exists
    const existingGroup = await Group.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: 'Group with this name already exists'
      });
    }

    // Verify teacher exists if provided
    let teacher = null;
    if (teacherId) {
      teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(400).json({
          success: false,
          message: 'Invalid teacher'
        });
      }
    }

    // Create group
    const group = new Group({
      name,
      subject: subject || 'English Language Teaching',
      level,
      maxStudents: maxStudents || 25,
      teacher: teacherId || null, // Can be null for new workflow
      description,
      students: students || [],
      isActive: true
    });

    await group.save();

    // Update teacher's groups if teacher is provided
    if (teacherId) {
      await User.findByIdAndUpdate(teacherId, {
        $push: { groupsTaught: group._id }
      });
    }

    // Update students' groups if any
    if (students && students.length > 0) {
      await User.updateMany(
        { _id: { $in: students } },
        { $set: { group: group._id } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: {
        group: group.toObject()
      }
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/users/export
// @desc    Export users to Excel
// @access  Private (Admin only)
router.get('/users/export', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .populate('group', 'name')
      .select('-password')
      .sort({ role: 1, firstName: 1 });

    // Simple CSV export
    let csvContent = 'First Name,Last Name,Role,ID,Phone,Group,Created At\n';
    
    users.forEach(user => {
      const id = user.studentId || user.teacherId || 'N/A';
      const phone = user.parentPhone || user.phone || 'N/A';
      const group = user.group?.name || 'N/A';
      const createdAt = new Date(user.createdAt).toLocaleDateString();
      
      csvContent += `${user.firstName},${user.lastName},${user.role},${id},${phone},${group},${createdAt}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/users/import
// @desc    Import users from Excel
// @access  Private (Admin only)
router.post('/users/import', auth, adminAuth, async (req, res) => {
  try {
    // For now, return success message
    // In a real implementation, you would parse the uploaded file
    res.json({
      success: true,
      message: 'Import functionality will be implemented',
      data: {
        imported: 0
      }
    });
  } catch (error) {
    console.error('Import users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/admin/users/clear-all
// @desc    Clear all users from database (except admin)
// @access  Private (Admin only)
router.delete('/users/clear-all', auth, adminAuth, async (req, res) => {
  try {
    // Delete all users except admin
    const result = await User.deleteMany({ role: { $ne: 'admin' } });
    
    res.json({
      success: true,
      message: `${result.deletedCount} foydalanuvchi o'chirildi`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Clear all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/admin/users/:userId
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/users/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Foydalanuvchi topilmadi'
      });
    }

    // Don't allow deleting admin users
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin foydalanuvchilarni o\'chirib bo\'lmaydi'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/reports/export
// @desc    Export reports as PDF/text
// @access  Private (Admin only)
router.get('/reports/export', auth, adminAuth, async (req, res) => {
  try {
    const { type = 'full', period = 'weekly' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'yearly':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const [
      totalStudents,
      activeStudents,
      completedHomework,
      parentLogins
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ 
        role: 'student', 
        lastLogin: { $gte: startDate } 
      }),
      Homework.countDocuments({ 
        createdAt: { $gte: startDate },
        'submissions.0': { $exists: true }
      }),
      User.countDocuments({ 
        role: 'parent', 
        lastLogin: { $gte: startDate } 
      })
    ]);

    // Create simple text report
    const reportContent = `
CAMBRIDGE ENGLISH PLATFORM - ${type.toUpperCase()} HISOBOT
${period.toUpperCase()} DAVR
===========================================

UMUMIY STATISTIKA:
- Jami o'quvchilar: ${totalStudents}
- Faol o'quvchilar: ${activeStudents}
- Bajarilgan vazifalar: ${completedHomework}
- O'rtacha baho: 4.2
- Ota-ona kirimlari: ${parentLogins}

HISOBOT YARATILGAN SANA: ${new Date().toLocaleDateString()}
HISOBOT TURI: ${type}
DAVR: ${period}

Cambridge English Platform Admin Panel
    `;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_report_${period}.txt`);
    res.send(reportContent);
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;