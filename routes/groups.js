const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Group = require('../models/Group');
const User = require('../models/User');

const router = express.Router();

// @route   GET /api/groups
// @desc    Get all groups
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ isActive: true })
      .populate('teacher', 'firstName lastName teacherId subject')
      .populate('students', 'firstName lastName studentId')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: { groups }
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/groups/:id
// @desc    Get single group
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('teacher', 'firstName lastName teacherId subject')
      .populate('students', 'firstName lastName studentId parentPhone');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    res.json({
      success: true,
      data: { group }
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/groups
// @desc    Create new group
// @access  Private (Admin/Teacher)
router.post('/', [
  body('name').notEmpty().withMessage('Group name is required'),
  body('level').isIn(['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced']).withMessage('Invalid level')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { name, subject, level, teacherId, maxStudents, description, students } = req.body;

    // Check if group name already exists
    const existingGroup = await Group.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: 'Group with this name already exists'
      });
    }

    // Verify teacher if provided
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
      teacher: teacherId || null, // Can be null for new workflow
      maxStudents: maxStudents || 25,
      description,
      students: students || []
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

    // Populate the response
    if (teacherId) {
      await group.populate('teacher', 'firstName lastName teacherId subject');
    }
    if (students && students.length > 0) {
      await group.populate('students', 'firstName lastName studentId');
    }

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: { group }
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/groups/:id/students
// @desc    Add students to group
// @access  Private (Admin/Teacher)
router.post('/:id/students', [
  body('studentIds').isArray().withMessage('Student IDs must be an array')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { studentIds } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if adding students would exceed max capacity
    if (group.students.length + studentIds.length > group.maxStudents) {
      return res.status(400).json({
        success: false,
        message: `Cannot add students. Group capacity is ${group.maxStudents}`
      });
    }

    // Verify all students exist and are actually students
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student'
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some student IDs are invalid'
      });
    }

    // Add students to group (avoid duplicates)
    const newStudentIds = studentIds.filter(id => !group.students.includes(id));
    group.students.push(...newStudentIds);
    await group.save();

    // Update students' group field
    await User.updateMany(
      { _id: { $in: newStudentIds } },
      { $set: { group: group._id } }
    );

    await group.populate('students', 'firstName lastName studentId');

    res.json({
      success: true,
      message: `${newStudentIds.length} students added to group`,
      data: { group }
    });
  } catch (error) {
    console.error('Add students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/groups/:id/students/:studentId
// @desc    Remove student from group
// @access  Private (Admin/Teacher)
router.delete('/:id/students/:studentId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Remove student from group
    group.students = group.students.filter(
      studentId => studentId.toString() !== req.params.studentId
    );
    await group.save();

    // Update student's group field
    await User.findByIdAndUpdate(req.params.studentId, {
      $unset: { group: 1 }
    });

    res.json({
      success: true,
      message: 'Student removed from group'
    });
  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/groups/:id/assign-teacher
// @desc    Assign teacher to group
// @access  Private (Admin only)
router.put('/:id/assign-teacher', [
  body('teacherId').notEmpty().withMessage('Teacher ID is required')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { teacherId } = req.body;
    const groupId = req.params.id;

    // Verify teacher exists
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Update group with teacher
    const group = await Group.findByIdAndUpdate(
      groupId,
      { 
        teacher: teacherId,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('teacher', 'firstName lastName teacherId subject');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Add group to teacher's groupsTaught array
    await User.findByIdAndUpdate(teacherId, {
      $addToSet: { groupsTaught: groupId }
    });

    res.json({
      success: true,
      message: 'Teacher assigned to group successfully',
      data: { group }
    });
  } catch (error) {
    console.error('Assign teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/groups/:id/remove-teacher
// @desc    Remove teacher from group
// @access  Private (Admin only)
router.put('/:id/remove-teacher', auth, async (req, res) => {
  try {
    const groupId = req.params.id;

    // Get current group to find teacher
    const currentGroup = await Group.findById(groupId);
    if (!currentGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const teacherId = currentGroup.teacher;

    // Remove teacher from group
    const group = await Group.findByIdAndUpdate(
      groupId,
      { 
        $unset: { teacher: 1 },
        updatedAt: new Date()
      },
      { new: true }
    );

    // Remove group from teacher's groupsTaught array
    if (teacherId) {
      await User.findByIdAndUpdate(teacherId, {
        $pull: { groupsTaught: groupId }
      });
    }

    res.json({
      success: true,
      message: 'Teacher removed from group successfully',
      data: { group }
    });
  } catch (error) {
    console.error('Remove teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/groups/:id/add-students
// @desc    Add students to group
// @access  Private (Admin only)
router.put('/:id/add-students', [
  body('studentIds').isArray().withMessage('Student IDs must be an array')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { studentIds } = req.body;
    const groupId = req.params.id;

    // Verify all students exist and are students
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student'
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some students not found or invalid'
      });
    }

    // Add students to group
    const group = await Group.findByIdAndUpdate(
      groupId,
      { 
        $addToSet: { students: { $each: studentIds } },
        updatedAt: new Date()
      },
      { new: true }
    ).populate('students', 'firstName lastName studentId');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Update students' group field
    await User.updateMany(
      { _id: { $in: studentIds } },
      { 
        group: groupId,
        updatedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: `${studentIds.length} students added to group successfully`,
      data: { group }
    });
  } catch (error) {
    console.error('Add students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/groups/:id/remove-students
// @desc    Remove students from group
// @access  Private (Admin only)
router.put('/:id/remove-students', [
  body('studentIds').isArray().withMessage('Student IDs must be an array')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { studentIds } = req.body;
    const groupId = req.params.id;

    // Remove students from group
    const group = await Group.findByIdAndUpdate(
      groupId,
      { 
        $pull: { students: { $in: studentIds } },
        updatedAt: new Date()
      },
      { new: true }
    ).populate('students', 'firstName lastName studentId');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Remove group from students
    await User.updateMany(
      { _id: { $in: studentIds } },
      { 
        $unset: { group: 1 },
        updatedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: `${studentIds.length} students removed from group successfully`,
      data: { group }
    });
  } catch (error) {
    console.error('Remove students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;