const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Group = require('../models/Group');
const Rating = require('../models/Rating');
const generateToken = require('../utils/generateToken');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('role').isIn(['student', 'teacher', 'parent', 'admin']).withMessage('Invalid role')
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

    const { firstName, lastName, password, role, groupId, parentType, teacherCode, parentPhone } = req.body;

    // Role-specific validations
    let userData = { firstName, lastName, password, role };

    if (role === 'student') {
      if (!groupId) {
        return res.status(400).json({
          success: false,
          message: 'Group is required for students'
        });
      }
      
      if (!parentPhone) {
        return res.status(400).json({
          success: false,
          message: 'Parent phone is required for students'
        });
      }
      
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(400).json({
          success: false,
          message: 'Invalid group selected'
        });
      }
      
      userData.group = groupId;
      userData.parentPhone = parentPhone;
    }

    if (role === 'parent') {
      if (!parentType || !['father', 'mother'].includes(parentType)) {
        return res.status(400).json({
          success: false,
          message: 'Parent type (father/mother) is required'
        });
      }
      userData.parentType = parentType;
    }

    if (role === 'teacher') {
      // Generate secure teacher verification code instead of hardcoded
      const validTeacherCodes = process.env.TEACHER_CODES ? process.env.TEACHER_CODES.split(',') : ['TEACHER2024'];
      if (!teacherCode || !validTeacherCodes.includes(teacherCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid teacher verification code'
        });
      }
    }

    const user = await User.create(userData);

    // Add student to group
    if (role === 'student') {
      await Group.findByIdAndUpdate(groupId, {
        $push: { students: user._id }
      });

      // Create initial rating record
      await Rating.create({
        student: user._id,
        group: groupId
      });
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          email: user.email
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Role-specific login with proper field validation
// @access  Public
router.post('/login', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('role').isIn(['student', 'teacher', 'parent', 'admin']).withMessage('Invalid role')
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

    const { firstName, lastName, password, role, studentId, teacherId, subject, parentType, childName, parentPhone, groupName } = req.body;

    console.log('Login attempt:', { firstName, lastName, role, studentId, teacherId, subject, parentType, childName, parentPhone, groupName });

    // Build role-specific query
    let query = {
      firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
      lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
      role
    };

    // Add role-specific fields to query
    if (role === 'student') {
      if (studentId) query.studentId = studentId;
      if (parentPhone) query.parentPhone = parentPhone;
      if (groupName) {
        // Find group by name and add to query
        const group = await Group.findOne({ name: { $regex: new RegExp(`^${groupName}$`, 'i') } });
        if (group) {
          query.group = group._id;
        }
      }
    }
    if (role === 'teacher' && teacherId) {
      query.teacherId = teacherId;
      if (subject) {
        query.subject = { $regex: new RegExp(`^${subject}$`, 'i') };
      }
    }
    if (role === 'parent' && parentType) {
      query.parentType = parentType;
      if (childName) {
        query.childName = { $regex: new RegExp(`^${childName}$`, 'i') };
      }
    }
    // Admin login - no additional fields needed

    console.log('Query:', query);

    // Find user
    const user = await User.findOne(query)
      .populate('group', 'name subject level')
      .populate('children', 'firstName lastName group')
      .populate('groupsTaught', 'name subject level');

    console.log('Found user:', user ? 'Yes' : 'No');

    if (!user) {
      let errorMessage = 'Foydalanuvchi topilmadi. ';
      if (role === 'student') {
        errorMessage += 'Ism, familiya, o\'quvchi ID va ota-ona telefon raqamini tekshiring.';
      } else if (role === 'teacher') {
        errorMessage += 'Ism, familiya, ustoz ID va fanni tekshiring.';
      } else if (role === 'parent') {
        errorMessage += 'Ism, familiya, turi va farzand ismini tekshiring.';
      } else if (role === 'admin') {
        errorMessage += 'Ism, familiya va parolni tekshiring.';
      }
      
      return res.status(401).json({
        success: false,
        message: errorMessage
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Hisob faol emas'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Noto\'g\'ri parol'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    console.log('Login successful for:', user.firstName, user.lastName);

    // Explicitly construct user response object
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      studentId: user.studentId,
      teacherId: user.teacherId,
      subject: user.subject,
      parentType: user.parentType,
      childName: user.childName,
      parentPhone: user.parentPhone,
      group: user.group ? {
        id: user.group._id,
        name: user.group.name,
        subject: user.group.subject,
        level: user.group.level
      } : null,
      children: user.children ? user.children.map(child => ({
        id: child._id,
        firstName: child.firstName,
        lastName: child.lastName
      })) : [],
      groupsTaught: user.groupsTaught ? user.groupsTaught.map(group => ({
        id: group._id,
        name: group.name,
        subject: group.subject,
        level: group.level
      })) : [],
      points: user.points,
      achievements: user.achievements,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    // Add personal information fields explicitly
    if (user.phone) userResponse.phone = user.phone;
    if (user.address) userResponse.address = user.address;
    if (user.birthDate) userResponse.birthDate = user.birthDate;
    if (user.occupation) userResponse.occupation = user.occupation;
    if (user.preferences) userResponse.preferences = user.preferences;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('group', 'name subject level')
      .populate('children', 'firstName lastName group')
      .populate('groupsTaught', 'name subject level');

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 })
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

    const { firstName, lastName } = req.body;
    const updateData = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;